import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';
import { createApp } from '../../src/server/app.js';
import { TorrentStore } from '../../src/server/services/store.js';

describe('HTTP Streaming and Secure Download routes', () => {
  let tempConfigDir: string;
  let tempDownloadDir: string;
  let store: TorrentStore;
  let app: any;
  const testHash = '0123456789abcdef0123456789abcdef01234567';

  beforeEach(async () => {
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-stream-cfg-'));
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-stream-dl-'));
    store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });
    await store.init();

    // Mock engine with files
    const sampleContent = Buffer.from('0123456789'.repeat(100)); // 1000 bytes
    const htmlContent = Buffer.from('<h1>Evil</h1>');
    const exeContent = Buffer.alloc(500);

    const mockFiles = [
      {
        name: 'video.mp4',
        path: 'video.mp4',
        length: 1000,
        createReadStream: (range?: { start?: number; end?: number }) => {
          const start = range?.start ?? 0;
          const end = (range?.end ?? 999) + 1;
          return Readable.from([sampleContent.subarray(start, end)]);
        }
      },
      {
        name: 'dangerous.html',
        path: 'dangerous.html',
        length: htmlContent.length,
        createReadStream: () => Readable.from([htmlContent])
      },
      {
        name: 'setup.exe',
        path: 'setup.exe',
        length: exeContent.length,
        createReadStream: () => Readable.from([exeContent])
      }
    ];

    const mockEngine: any = {
      infoHash: testHash,
      ready: true,
      torrent: { name: 'Mock Media', length: 1000 + htmlContent.length + exeContent.length, pieces: [] },
      files: mockFiles,
      swarm: { wires: [], downloadSpeed: () => 0 }
    };

    (store as any).torrents.set(testHash, mockEngine);
    (store as any).metadata.set(testHash, { infoHash: testHash, name: 'Mock Media', addedAt: 1, pinned: false });

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

  it('should serve standard GET (200 OK) and HEAD (200 OK without body)', async () => {
    const getRes = await request(app).get(`/torrents/${testHash}/files/0`);
    expect(getRes.status).toBe(200);
    expect(getRes.headers['content-length']).toBe('1000');
    expect(getRes.headers['accept-ranges']).toBe('bytes');
    expect(getRes.headers['content-type']).toContain('video/mp4');
    expect(getRes.body.length).toBe(1000);

    const headRes = await request(app).head(`/torrents/${testHash}/files/0`);
    expect(headRes.status).toBe(200);
    expect(headRes.headers['content-length']).toBe('1000');
    expect(headRes.text).toBeUndefined();
  });

  it('should support byte Range requests -> 206 Partial Content', async () => {
    const res = await request(app)
      .get(`/torrents/${testHash}/files/0`)
      .set('Range', 'bytes=0-99');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-99/1000');
    expect(res.headers['content-length']).toBe('100');
    expect(res.body.length).toBe(100);
  });

  it('should handle out-of-bounds Range with 416 Range Not Satisfiable without crashing', async () => {
    const res = await request(app)
      .get(`/torrents/${testHash}/files/0`)
      .set('Range', 'bytes=99999999-');

    expect(res.status).toBe(416);
    expect(res.headers['content-range']).toBe('bytes */1000');
  });

  it('should attach Content-Security-Policy sandbox and Content-Disposition: attachment on .html and .exe files', async () => {
    // .html
    const htmlRes = await request(app).get(`/torrents/${testHash}/files/1`);
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers['x-content-type-options']).toBe('nosniff');
    expect(htmlRes.headers['content-security-policy']).toContain('sandbox');
    expect(htmlRes.headers['content-disposition']).toContain('attachment');

    // .exe
    const exeRes = await request(app).get(`/torrents/${testHash}/files/2`);
    expect(exeRes.status).toBe(200);
    expect(exeRes.headers['content-security-policy']).toContain('sandbox');
    expect(exeRes.headers['content-disposition']).toContain('attachment');
  });

  it('should stream directly from disk if engine is not ready (!engine.ready)', async () => {
    const unreadyHash = '1111111111222222222233333333334444444444';
    const torrentDlDir = path.join(tempDownloadDir, unreadyHash);
    await fs.mkdir(torrentDlDir, { recursive: true });
    await fs.writeFile(path.join(torrentDlDir, 'complete.mp4'), Buffer.from('DISK_STREAM_CONTENT_12345'));

    // Engine is NOT ready
    const unreadyEngine: any = {
      infoHash: unreadyHash,
      ready: false,
      torrent: null,
      files: []
    };
    (store as any).torrents.set(unreadyHash, unreadyEngine);
    (store as any).metadata.set(unreadyHash, {
      infoHash: unreadyHash,
      name: 'Unready Movie',
      addedAt: 1,
      pinned: false,
      files: [
        { index: 0, name: 'complete.mp4', path: 'complete.mp4', length: 25, selected: true }
      ]
    });

    const res = await request(app).get(`/torrents/${unreadyHash}/files/0`);
    expect(res.status).toBe(200);
    expect(res.body.toString('utf-8')).toBe('DISK_STREAM_CONTENT_12345');
    expect(res.headers['content-length']).toBe('25');
  });

  it('should reject subtitle requests with 413 PayloadTooLarge if file > 10MB', async () => {
    const hugeSubFile = {
      name: 'huge.srt',
      path: 'huge.srt',
      length: 15 * 1024 * 1024, // 15MB
      createReadStream: () => Readable.from([])
    };
    const engineWithHugeSub: any = {
      infoHash: testHash,
      ready: true,
      torrent: { name: 'Sub Test', pieces: [] },
      files: [hugeSubFile]
    };
    (store as any).torrents.set(testHash, engineWithHugeSub);

    const res = await request(app).get(`/torrents/${testHash}/subtitles/0`);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('PayloadTooLarge');
  });

  it('should dynamically select bitfield pieces with high priority (10) on Range request seek', async () => {
    let selectedPieces: any = null;
    const seekableFile = {
      name: 'movie.mp4',
      path: 'movie.mp4',
      length: 10000000,
      offset: 500000,
      createReadStream: (range?: { start?: number; end?: number }) => {
        return Readable.from([Buffer.alloc((range?.end ?? 999) - (range?.start ?? 0) + 1)]);
      }
    };

    const activeEngine: any = {
      infoHash: testHash,
      ready: true,
      torrent: {
        name: 'Seekable Movie',
        pieceLength: 100000,
        pieces: new Array(150).fill(0)
      },
      files: [seekableFile],
      select: (from: number, to: number, priority: number) => {
        selectedPieces = { from, to, priority };
      }
    };
    (store as any).torrents.set(testHash, activeEngine);

    // Seek at byte 250000 of the file -> offset (500000) + 250000 = 750000 -> piece = 7
    const res = await request(app)
      .get(`/torrents/${testHash}/files/0`)
      .set('Range', 'bytes=250000-299999');

    expect(res.status).toBe(206);
    expect(selectedPieces).toEqual({
      from: 7,
      to: 12, // targetStartPiece (7) + 5
      priority: 10
    });
  });
});

