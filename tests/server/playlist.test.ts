import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../../src/server/app.js';
import { TorrentStore } from '../../src/server/services/store.js';

describe('M3U Playlists (per-torrent and global TV playlist)', () => {
  let tempConfigDir: string;
  let tempDownloadDir: string;
  let store: TorrentStore;
  let app: any;
  const hash1 = '1111111111111111111111111111111111111111';
  const hash2 = '2222222222222222222222222222222222222222';

  beforeEach(async () => {
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-m3u-cfg-'));
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-m3u-dl-'));
    store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });
    await store.init();

    const engine1: any = {
      infoHash: hash1,
      ready: true,
      torrent: { name: 'Dune Part 2', length: 5000 },
      files: [
        { name: 'Dune2.1080p.mkv', path: 'Dune2.1080p.mkv', length: 4800 },
        { name: 'setup.exe', path: 'setup.exe', length: 150 }, // Should be excluded!
        { name: 'info.nfo', path: 'info.nfo', length: 50 } // Should be excluded!
      ],
      swarm: { wires: [], downloadSpeed: () => 0 }
    };

    const engine2: any = {
      infoHash: hash2,
      ready: true,
      torrent: { name: 'Daft Punk Album', length: 1000 },
      files: [
        { name: 'track01.flac', path: 'track01.flac', length: 500 },
        { name: 'cover.jpg', path: 'cover.jpg', length: 500 } // Excluded from audio/video
      ],
      swarm: { wires: [], downloadSpeed: () => 0 }
    };

    (store as any).torrents.set(hash1, engine1);
    (store as any).torrents.set(hash2, engine2);
    (store as any).metadata.set(hash1, { infoHash: hash1, name: 'Dune Part 2', addedAt: 1, pinned: false });
    (store as any).metadata.set(hash2, { infoHash: hash2, name: 'Daft Punk Album', addedAt: 2, pinned: false });

    app = createApp({ store, enableLogging: false });
  });

  afterEach(async () => {
    await store.destroyAll();
    try {
      await fs.rm(tempConfigDir, { recursive: true, force: true });
      await fs.rm(tempDownloadDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should exclude .nfo and .exe files from per-torrent M3U playlist', async () => {
    const res = await request(app).get(`/torrents/${hash1}/files`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/x-mpegurl');

    const m3uText = res.text || (res.body ? res.body.toString('utf-8') : '');
    expect(m3uText).toContain('#EXTM3U');
    expect(m3uText).toContain('Dune2.1080p.mkv');
    expect(m3uText).toContain(`/torrents/${hash1}/files/0`);

    // Must NOT contain .exe or .nfo
    expect(m3uText).not.toContain('setup.exe');
    expect(m3uText).not.toContain('info.nfo');
  });

  it('should generate valid global /playlist.m3u grouping media from all ready torrents', async () => {
    const res = await request(app).get('/playlist.m3u');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/x-mpegurl');

    const m3uText = res.text || (res.body ? res.body.toString('utf-8') : '');
    expect(m3uText).toContain('#EXTM3U');

    // Torrent 1 media
    expect(m3uText).toContain('#EXTGRP:Dune Part 2');
    expect(m3uText).toContain('Dune2.1080p.mkv');
    expect(m3uText).toContain(`/torrents/${hash1}/files/0`);

    // Torrent 2 media
    expect(m3uText).toContain('#EXTGRP:Daft Punk Album');
    expect(m3uText).toContain('track01.flac');
    expect(m3uText).toContain(`/torrents/${hash2}/files/0`);

    // Non-media must be excluded
    expect(m3uText).not.toContain('setup.exe');
    expect(m3uText).not.toContain('info.nfo');
    expect(m3uText).not.toContain('cover.jpg');
  });
});
