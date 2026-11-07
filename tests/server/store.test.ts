import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { TorrentStore } from '../../src/server/services/store.js';
import * as engineModule from '../../src/server/services/engine.js';

describe('Torrent Store Service', () => {
  let tempConfigDir: string;
  let tempDownloadDir: string;
  const sampleHash = '0123456789abcdef0123456789abcdef01234567';
  const sampleMagnet = `magnet:?xt=urn:btih:${sampleHash}&dn=TestTorrent`;

  beforeEach(async () => {
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-config-'));
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-download-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempConfigDir, { recursive: true, force: true });
      await fs.rm(tempDownloadDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('should add a torrent, persist pinned state, and reload correctly after restart', async () => {
    const store1 = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });

    await store1.init();

    const infoHash = await store1.add(sampleMagnet);
    expect(infoHash).toBe(sampleHash);

    // Default pinned should be false
    expect(store1.getMetadata(infoHash)?.pinned).toBe(false);

    // Toggle pin to true
    const pinnedState = store1.togglePin(infoHash);
    expect(pinnedState).toBe(true);
    expect(store1.getMetadata(infoHash)?.pinned).toBe(true);

    // Save
    await store1.save();
    await store1.destroyAll();

    // Verify storage file exists and contains valid JSON
    const content = await fs.readFile(path.join(tempConfigDir, 'torrents.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed[sampleHash].pinned).toBe(true);

    // Restart store (store2) from the same directory
    const store2 = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });

    await store2.init();
    expect(store2.get(sampleHash)).toBeDefined();
    expect(store2.getMetadata(sampleHash)?.pinned).toBe(true);

    await store2.destroyAll();
  });

  it('should survive and recover gracefully when torrents.json is malformed/corrupted', async () => {
    // Write corrupted JSON into torrents.json
    await fs.mkdir(tempConfigDir, { recursive: true });
    const storageFile = path.join(tempConfigDir, 'torrents.json');
    await fs.writeFile(storageFile, '{ invalid json truncated', 'utf-8');

    const store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });

    // Should not throw or crash
    await expect(store.init()).resolves.toBeUndefined();
    expect(store.list().length).toBe(0);

    // Should have created a .bak copy
    const bakExists = await fs
      .access(`${storageFile}.bak`)
      .then(() => true)
      .catch(() => false);
    expect(bakExists).toBe(true);

    await store.destroyAll();
  });

  it('should not throw when removing an inexistent infoHash', async () => {
    const store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });

    await store.init();
    await expect(store.remove('non_existent_hash_12345')).resolves.toBeUndefined();
    await store.destroyAll();
  });

  it('should isolate download directory by infoHash when calling createTorrentEngine', async () => {
    const createTorrentEngineSpy = vi.spyOn(engineModule, 'createTorrentEngine');

    const store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });

    await store.init();
    const infoHash = await store.add(sampleMagnet);

    expect(createTorrentEngineSpy).toHaveBeenCalled();
    const lastCall = createTorrentEngineSpy.mock.calls[createTorrentEngineSpy.mock.calls.length - 1];
    const opts = lastCall[1];

    expect(opts?.path).toBe(path.join(tempDownloadDir, infoHash));
    expect(opts?.tmp).toBe(tempDownloadDir);

    await store.destroyAll();
    createTorrentEngineSpy.mockRestore();
  });

  it('should retain cached files, length and downloadedBytes in serializeTorrent immediately after reboot', async () => {
    const { serializeTorrent } = await import('../../src/server/services/serializer.js');

    // 1. Manually write a torrents.json with cached files
    const testHash = '0123456789abcdef0123456789abcdef01234567';
    const initialData = {
      [testHash]: {
        infoHash: testHash,
        name: 'Big Movie 2026',
        length: 83000000000,
        category: 'video',
        addedAt: Date.now(),
        pinned: true,
        paused: false,
        downloadedBytes: 41500000000,
        isFullyDownloaded: false,
        files: [
          {
            index: 0,
            name: 'Big Movie 2026.mkv',
            path: 'Big Movie 2026.mkv',
            length: 83000000000,
            selected: true
          }
        ]
      }
    };

    await fs.mkdir(tempConfigDir, { recursive: true });
    await fs.writeFile(
      path.join(tempConfigDir, 'torrents.json'),
      JSON.stringify(initialData),
      'utf-8'
    );

    const store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });

    await store.init();
    const engine = store.get(testHash);
    expect(engine).toBeDefined();

    // Engine is NOT yet ready (verifying pieces)
    expect(engine!.ready).toBe(false);

    const meta = store.getMetadata(testHash);
    expect(meta).toBeDefined();

    // serializeTorrent should provide the full list of files and size from cache!
    const dto = serializeTorrent(engine!, meta);
    expect(dto.name).toBe('Big Movie 2026');
    expect(dto.length).toBe(83000000000);
    expect(dto.category).toBe('video');
    expect(dto.files.length).toBe(1);
    expect(dto.files[0].name).toBe('Big Movie 2026.mkv');
    expect(dto.files[0].length).toBe(83000000000);
    expect(dto.stats.downloaded).toBe(41500000000);
    expect(dto.downloadedPercentage).toBe(50);

    await store.destroyAll();
  });

  it('should immediately pre-fill meta.files, length and category in store.add() before ready', async () => {
    const parseTorrentModule = await import('../../src/server/services/torrent-parser.js');
    const fakeInfoHash = 'aabbccddeeff00112233445566778899aabbccdd';
    const parseSpy = vi.spyOn(parseTorrentModule, 'parseTorrentInput').mockResolvedValueOnce({
      parsed: {
        infoHash: fakeInfoHash,
        name: 'Immediate Torrent',
        length: 5000000,
        files: [
          { name: 'movie.mp4', path: 'movie.mp4', length: 4900000 },
          { name: 'movie.nfo', path: 'movie.nfo', length: 100000 }
        ]
      } as any,
      source: `magnet:?xt=urn:btih:${fakeInfoHash}`
    });

    const store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });
    await store.init();

    const infoHash = await store.add(`magnet:?xt=urn:btih:${fakeInfoHash}`);
    expect(infoHash).toBe(fakeInfoHash);

    const meta = store.getMetadata(fakeInfoHash);
    expect(meta).toBeDefined();
    expect(meta?.name).toBe('Immediate Torrent');
    expect(meta?.length).toBe(5000000);
    expect(meta?.category).toBe('video');
    expect(meta?.files?.length).toBe(2);
    expect(meta?.files?.[0].name).toBe('movie.mp4');
    expect(meta?.files?.[0].selected).toBe(true);
    expect(meta?.files?.[1].name).toBe('movie.nfo');

    await store.destroyAll();
    parseSpy.mockRestore();
  });

  it('should accurately calculate total allocated and downloaded bytes across torrents', async () => {
    const store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });
    await store.init();

    // Directly populate metadata with 2 sample torrents
    (store as any).metadata.set('hash1', {
      infoHash: 'hash1',
      name: 'Movie 1',
      length: 10 * 1024 * 1024,
      addedAt: Date.now(),
      pinned: false,
      downloadedBytes: 10 * 1024 * 1024,
      isFullyDownloaded: true
    });

    (store as any).metadata.set('hash2', {
      infoHash: 'hash2',
      name: 'Series 1',
      length: 50 * 1024 * 1024,
      addedAt: Date.now(),
      pinned: false,
      downloadedBytes: 5 * 1024 * 1024,
      isFullyDownloaded: false,
      files: [
        { index: 0, name: 'ep1.mp4', path: 'ep1.mp4', length: 25 * 1024 * 1024, selected: true },
        { index: 1, name: 'ep2.mp4', path: 'ep2.mp4', length: 25 * 1024 * 1024, selected: false }
      ]
    });

    // hash1 = 10 MB, hash2 selected = 25 MB (ep1 selected, ep2 deselected) -> Total = 35 MB
    expect(store.getTorrentAllocatedBytes('hash1')).toBe(10 * 1024 * 1024);
    expect(store.getTorrentAllocatedBytes('hash2')).toBe(25 * 1024 * 1024);
    expect(store.getTotalAllocatedBytes()).toBe(35 * 1024 * 1024);

    // Total excluding hash2 should be hash1 only
    expect(store.getTotalAllocatedBytes('hash2')).toBe(10 * 1024 * 1024);

    // Downloaded: hash1 is fully downloaded (10 MB), hash2 has 5 MB downloaded -> Total = 15 MB
    expect(store.getTotalDownloadedBytes()).toBe(15 * 1024 * 1024);

    await store.destroyAll();
  });
});
