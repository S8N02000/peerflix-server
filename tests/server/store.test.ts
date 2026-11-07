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
});
