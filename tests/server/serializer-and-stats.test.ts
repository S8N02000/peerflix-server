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
