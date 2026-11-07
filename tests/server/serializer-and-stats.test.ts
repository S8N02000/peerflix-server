import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  calculateTorrentStats,
  serializeTorrent,
  isFileComplete
} from '../../src/server/services/serializer.js';
import type { TorrentEngine } from '../../src/server/services/engine.js';
import { TorrentStore } from '../../src/server/services/store.js';
import { createApp } from '../../src/server/app.js';

describe('Serializer, Stats, and System routes', () => {
  it('should calculate stats and serialize safely when torrent.torrent is null without crashing', () => {
    const unreadyEngine: any = {
      infoHash: '0123456789abcdef0123456789abcdef01234567',
      ready: false,
      torrent: null,
      files: [],
      swarm: {
        wires: [],
        downloadSpeed: () => 0
      }
    };

    const stats = calculateTorrentStats(unreadyEngine as TorrentEngine);
    expect(stats.eta).toBe(0);
    expect(stats.progress).toBe(0);
    expect(stats.downloaded).toBe(0);
    expect(stats.uploaded).toBe(0);
    expect(stats.speed.down).toBe(0);
    expect(stats.peers.total).toBe(0);

    const serialized = serializeTorrent(unreadyEngine as TorrentEngine);
    expect(serialized.ready).toBe(false);
    expect(serialized.isFullyDownloaded).toBe(false);
    expect(serialized.files).toEqual([]);
    expect(serialized.downloadedPercentage).toBe(0);
  });

  it('should accurately calculate file completeness and torrent isFullyDownloaded via bitfield', () => {
    // 4 pieces, pieceLength 1000
    // File 1: offset 0, length 2000 -> pieces 0, 1
    // File 2: offset 2000, length 2000 -> pieces 2, 3
    const fakeBitfield = {
      get: (pieceIndex: number) => {
        // Pieces 0 and 1 are verified (File 1 complete)
        // Piece 2 is verified, piece 3 is NOT (File 2 incomplete)
        return pieceIndex === 0 || pieceIndex === 1 || pieceIndex === 2;
      }
    };

    const engineWithFiles: any = {
      infoHash: 'abcdef0123456789abcdef0123456789abcdef01',
      ready: true,
      bitfield: fakeBitfield,
      torrent: {
        name: 'Dual Files Torrent',
        length: 4000,
        pieceLength: 1000,
        pieces: [1, 2, 3, 4]
      },
      files: [
        { name: 'file1.mp4', path: 'file1.mp4', offset: 0, length: 2000, selected: true },
        { name: 'file2.mp4', path: 'file2.mp4', offset: 2000, length: 2000, selected: true }
      ],
      swarm: { wires: [], downloadSpeed: () => 500000 }
    };

    expect(isFileComplete(engineWithFiles.files[0], engineWithFiles)).toBe(true);
    expect(isFileComplete(engineWithFiles.files[1], engineWithFiles)).toBe(false);

    const serialized = serializeTorrent(engineWithFiles);
    expect(serialized.files[0].isComplete).toBe(true);
    expect(serialized.files[1].isComplete).toBe(false);
    expect(serialized.isFullyDownloaded).toBe(false); // Because file 2 is not complete yet

    // Complete piece 3
    const fullyDownloadedBitfield = { get: () => true };
    engineWithFiles.bitfield = fullyDownloadedBitfield;

    const fullySerialized = serializeTorrent(engineWithFiles);
    expect(fullySerialized.files[0].isComplete).toBe(true);
    expect(fullySerialized.files[1].isComplete).toBe(true);
    expect(fullySerialized.isFullyDownloaded).toBe(true);
  });

  it('should display downloadedPercentage with 1 decimal and ensure calculateTorrentStats is strictly monotonic', () => {
    let piecesVerified = 1;
    const fakeBitfield = {
      get: (pieceIndex: number) => pieceIndex < piecesVerified
    };

    const engine: any = {
      infoHash: '1111222233334444555566667777888899990000',
      ready: true,
      bitfield: fakeBitfield,
      torrent: {
        name: 'Monotonic Test Torrent',
        length: 10000,
        pieceLength: 250,
        pieces: new Array(40).fill(1)
      },
      files: [{ name: 'test.mkv', length: 10000, offset: 0, selected: true }],
      swarm: { wires: [], downloadSpeed: () => 1000 }
    };

    // 1 piece verified out of 40 = 2.5%
    const stats1 = calculateTorrentStats(engine);
    expect(stats1.downloaded).toBe(250);
    expect(stats1.progress).toBe(0.025);
    expect(stats1.seq).toBe(1);

    // serializeTorrent internally calls calculateTorrentStats (seq -> 2)
    const serialized1 = serializeTorrent(engine);
    expect(serialized1.downloadedPercentage).toBe(2.5);
    expect(serialized1.stats.seq).toBe(2);

    // Simulate bitfield glitch or out-of-order count (0 pieces)
    piecesVerified = 0;
    const statsGlitch = calculateTorrentStats(engine);
    // Even if bitfield returned 0, monotonic safeguard preserves the previous max
    expect(statsGlitch.downloaded).toBe(250);
    expect(statsGlitch.seq).toBe(3);

    // Increase to 2 pieces = 5.0%
    piecesVerified = 2;
    const stats2 = calculateTorrentStats(engine);
    expect(stats2.downloaded).toBe(500);
    expect(stats2.seq).toBe(4);

    const serialized2 = serializeTorrent(engine);
    expect(serialized2.downloadedPercentage).toBe(5.0);
    expect(serialized2.stats.seq).toBe(5);
  });

  describe('Integration with API routes (/pin and /system/status)', () => {
    let tempConfigDir: string;
    let tempDownloadDir: string;
    let store: TorrentStore;
    let app: any;
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    beforeEach(async () => {
      tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-serial-cfg-'));
      tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-serial-dl-'));
      store = new TorrentStore({
        configPath: tempConfigDir,
        downloadPath: tempDownloadDir
      });
      await store.init();
      await store.add(`magnet:?xt=urn:btih:${testHash}&dn=TestPin`);
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

    it('should toggle pin state via POST /torrents/:infoHash/pin', async () => {
      // Initially false
      expect(store.getMetadata(testHash)?.pinned).toBe(false);

      const pinRes1 = await request(app).post(`/torrents/${testHash}/pin`);
      expect(pinRes1.status).toBe(200);
      expect(pinRes1.body.pinned).toBe(true);

      const pinRes2 = await request(app).post(`/torrents/${testHash}/pin`);
      expect(pinRes2.status).toBe(200);
      expect(pinRes2.body.pinned).toBe(false);
    });

    it('should return system status with disk stats and nextCleanAt via GET /system/status', async () => {
      const res = await request(app).get('/system/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('disk');
      expect(res.body.disk).toHaveProperty('freeBytes');
      expect(res.body.disk).toHaveProperty('totalBytes');
      expect(res.body).toHaveProperty('nextCleanAt');
      expect(typeof res.body.nextCleanAt).toBe('string');
      expect(res.body).toHaveProperty('totalDownSpeed');
    });
  });
});
