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

    // Torrent 1 media (categorized as Films)
    expect(m3uText).toContain('#EXTGRP:Films');
    expect(m3uText).toContain('group-title="Films"');
    expect(m3uText).toContain('Dune Part 2');
    expect(m3uText).toContain(`/torrents/${hash1}/files/0`);

    // Torrent 2 media (categorized as Musique)
    expect(m3uText).toContain('#EXTGRP:Musique');
    expect(m3uText).toContain('group-title="Musique"');
    expect(m3uText).toContain('track01');
    expect(m3uText).toContain(`/torrents/${hash2}/files/0`);

    // Non-media must be excluded
    expect(m3uText).not.toContain('setup.exe');
    expect(m3uText).not.toContain('info.nfo');
    expect(m3uText).not.toContain('cover.jpg');

    // Test category filtering via query params
    const resFilms = await request(app).get('/playlist.m3u?category=films');
    const textFilms = resFilms.text || (resFilms.body ? resFilms.body.toString('utf-8') : '');
    expect(textFilms).toContain('Dune Part 2');
    expect(textFilms).not.toContain('track01');
  });

  it('should generate M3U playlists using cached metadata when engine.ready is false (reboot fallback)', async () => {
    const unreadyHash = '3333333333333333333333333333333333333333';
    const unreadyEngine: any = {
      infoHash: unreadyHash,
      ready: false,
      torrent: null,
      files: [],
      swarm: { wires: [], downloadSpeed: () => 0 }
    };

    (store as any).torrents.set(unreadyHash, unreadyEngine);
    (store as any).metadata.set(unreadyHash, {
      infoHash: unreadyHash,
      name: 'Oppenheimer 2023',
      addedAt: 3,
      pinned: false,
      files: [
        { index: 0, name: 'Oppenheimer.2160p.mkv', path: 'Oppenheimer.2160p.mkv', length: 10000, selected: true },
        { index: 1, name: 'bonus.mp4', path: 'bonus.mp4', length: 500, selected: true },
        { index: 2, name: 'readme.txt', path: 'readme.txt', length: 10, selected: false }
      ]
    });

    // Test per-torrent M3U
    const resTorrent = await request(app).get(`/torrents/${unreadyHash}/files`);
    expect(resTorrent.status).toBe(200);
    const textTorrent = resTorrent.text || resTorrent.body.toString('utf-8');
    expect(textTorrent).toContain('Oppenheimer.2160p.mkv');
    expect(textTorrent).toContain(`/torrents/${unreadyHash}/files/0`);
    expect(textTorrent).toContain('bonus.mp4');
    expect(textTorrent).toContain(`/torrents/${unreadyHash}/files/1`);
    expect(textTorrent).not.toContain('readme.txt');

    // Test global /playlist.m3u
    const resGlobal = await request(app).get('/playlist.m3u');
    expect(resGlobal.status).toBe(200);
    const textGlobal = resGlobal.text || resGlobal.body.toString('utf-8');
    expect(textGlobal).toContain('#EXTGRP:Films');
    expect(textGlobal).toContain('Oppenheimer 2023');
    expect(textGlobal).toContain(`/torrents/${unreadyHash}/files/0`);
  });

  it('should intelligently group TV series by show and season with clean titles and VOD attributes', async () => {
    const seriesHash = '4444444444444444444444444444444444444444';
    const seriesEngine: any = {
      infoHash: seriesHash,
      ready: true,
      torrent: { name: 'Made.in.Abyss.S01.VOSTFR.1080p.BluRay-FRiTCHi571', length: 10000 },
      files: [
        { name: 'Made.in.Abyss.S01E01.VOSTFR.1080p.mkv', path: 'Made.in.Abyss.S01E01.VOSTFR.1080p.mkv', length: 5000 },
        { name: 'Made.in.Abyss.S01E02.VOSTFR.1080p.mkv', path: 'Made.in.Abyss.S01E02.VOSTFR.1080p.mkv', length: 5000 }
      ],
      swarm: { wires: [], downloadSpeed: () => 0 }
    };

    (store as any).torrents.set(seriesHash, seriesEngine);
    (store as any).metadata.set(seriesHash, {
      infoHash: seriesHash,
      name: 'Made.in.Abyss.S01.VOSTFR.1080p.BluRay-FRiTCHi571',
      addedAt: 4,
      pinned: false
    });

    const res = await request(app).get('/playlist.m3u');
    expect(res.status).toBe(200);
    const m3u = res.text || (res.body ? res.body.toString('utf-8') : '');

    // Check VOD header
    expect(m3u).toContain('#EXT-X-PLAYLIST-TYPE:VOD');

    // Check show and season grouping
    expect(m3u).toContain('group-title="Made in Abyss - S01"');
    expect(m3u).toContain('#EXTGRP:Made in Abyss - S01');

    // Check clean titles
    expect(m3u).toContain('tvg-name="Made in Abyss - S01E01"');
    expect(m3u).toContain('tvg-name="Made in Abyss - S01E02"');

    // Check VOD metadata attributes
    expect(m3u).toContain('series="Made in Abyss"');
    expect(m3u).toContain('season="1"');
    expect(m3u).toContain('episode="1"');
    expect(m3u).toContain('episode="2"');

    // Test ?grouping=category fallback
    const resCat = await request(app).get('/playlist.m3u?grouping=category');
    expect(resCat.status).toBe(200);
    const textCat = resCat.text || (resCat.body ? resCat.body.toString('utf-8') : '');
    expect(textCat).toContain('group-title="Séries TV"');

    // Test ?category=series filter
    const resSeries = await request(app).get('/playlist.m3u?category=series');
    expect(resSeries.status).toBe(200);
    const textSeries = resSeries.text || (resSeries.body ? resSeries.body.toString('utf-8') : '');
    expect(textSeries).toContain('Made in Abyss');
    expect(textSeries).not.toContain('Dune Part 2');
  });
});
