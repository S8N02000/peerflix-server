import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import parseTorrent, { toTorrentFile } from 'parse-torrent';
import { createApp } from '../../src/server/app.js';
import { TorrentStore } from '../../src/server/services/store.js';

describe('Torrent upload and addition routes', () => {
  let tempConfigDir: string;
  let tempDownloadDir: string;
  let store: TorrentStore;
  let app: any;

  beforeEach(async () => {
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-upload-cfg-'));
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-upload-dl-'));
    store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });
    await store.init();
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

  it('should upload a valid .torrent buffer -> status 200 + { infoHash }', async () => {
    const rawBuf = toTorrentFile({
      info: {
        name: 'valid_test.mp4',
        'piece length': 16384,
        pieces: Buffer.alloc(20),
        length: 1000
      }
    } as any);
    const validTorrentBuffer = Buffer.from(rawBuf);

    const res = await request(app)
      .post('/upload')
      .attach('file', validTorrentBuffer, 'valid_test.torrent');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('infoHash');
    expect(res.body.infoHash).toHaveLength(40);
  });

  it('should reject a fake .torrent file -> status 400 Bad Request', async () => {
    const fakeBuffer = Buffer.from('this is just a random non-bencoded string');

    const res = await request(app)
      .post('/upload')
      .attach('file', fakeBuffer, 'fake.torrent');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should reject file upload exceeding size limit (20MB) -> status 413 Payload Too Large', async () => {
    const hugeBuffer = Buffer.alloc(21 * 1024 * 1024); // 21 MB

    const res = await request(app)
      .post('/upload')
      .attach('file', hugeBuffer, 'huge.torrent');

    expect(res.status).toBe(413);
  });

  it('should accept valid magnet in POST /torrents vs reject /etc/passwd path traversal', async () => {
    const validMagnet = 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=MagnetTest';

    const validRes = await request(app)
      .post('/torrents')
      .send({ link: validMagnet });

    expect(validRes.status).toBe(200);
    expect(validRes.body.infoHash).toBe('0123456789abcdef0123456789abcdef01234567');

    const maliciousRes = await request(app)
      .post('/torrents')
      .send({ link: '/etc/passwd' });

    expect(maliciousRes.status).toBe(400);
    expect(maliciousRes.body.error).toBe('SecurityError');
  });
});
