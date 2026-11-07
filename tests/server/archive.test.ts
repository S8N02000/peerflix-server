import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { Readable } from 'node:stream';
import { createApp } from '../../src/server/app.js';
import { TorrentStore } from '../../src/server/services/store.js';

const binaryParser = (res: any, cb: (err: any, res: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
  res.on('error', (err: any) => cb(err, Buffer.concat(chunks)));
};

describe('ZIP Archive streaming and subfolder filtering', () => {
  let tempConfigDir: string;
  let tempDownloadDir: string;
  let store: TorrentStore;
  let app: any;
  const testHash = '0123456789abcdef0123456789abcdef01234567';

  beforeEach(async () => {
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-zip-cfg-'));
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-zip-dl-'));
    store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });
    await store.init();

    const mockFiles = [
      {
        name: 'setup.exe',
        path: 'Game/setup.exe',
        length: 50,
        selected: true,
        createReadStream: () => Readable.from([Buffer.from('setup_content')])
      },
      {
        name: 'crack.dll',
        path: 'Game/Crack/crack.dll',
        length: 30,
        selected: true,
        createReadStream: () => Readable.from([Buffer.from('crack_content')])
      },
      {
        name: 'readme.txt',
        path: 'Game/Crack/readme.txt',
        length: 20,
        selected: true,
        createReadStream: () => Readable.from([Buffer.from('readme_content')])
      }
    ];

    const mockEngine: any = {
      infoHash: testHash,
      ready: true,
      torrent: { name: 'SuperGame', length: 100, pieces: [] },
      files: mockFiles,
      swarm: { wires: [], downloadSpeed: () => 0 }
    };

    (store as any).torrents.set(testHash, mockEngine);
    (store as any).metadata.set(testHash, { infoHash: testHash, name: 'SuperGame', addedAt: 1, pinned: false });

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

  it('should download full zip and include all files', async () => {
    const res = await request(app)
      .get(`/torrents/${testHash}/archive`)
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('SuperGame.zip');

    const zipBuffer = res.body as Buffer;
    expect(Buffer.isBuffer(zipBuffer)).toBe(true);

    const zipString = zipBuffer.toString('binary');
    expect(zipString).toContain('setup.exe');
    expect(zipString).toContain('crack.dll');
    expect(zipString).toContain('readme.txt');
  });

  it('should filter zip by subfolder ?folder=Game/Crack and include only crack files', async () => {
    const res = await request(app)
      .get(`/torrents/${testHash}/archive?folder=Game/Crack`)
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('Crack.zip');

    const zipBuffer = res.body as Buffer;
    const zipString = zipBuffer.toString('binary');

    expect(zipString).toContain('crack.dll');
    expect(zipString).toContain('readme.txt');
    expect(zipString).not.toContain('setup.exe');
  });

  it('should survive and abort cleanly on premature client socket disconnection without crashing', async () => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    await new Promise<void>((resolve) => {
      const clientReq = http.get(`http://127.0.0.1:${port}/torrents/${testHash}/archive`, (res) => {
        // Destroy client stream right after receiving headers
        clientReq.destroy();
        setTimeout(resolve, 50);
      });
      clientReq.on('error', () => {
        // Expected client destroy error
        resolve();
      });
    });

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
