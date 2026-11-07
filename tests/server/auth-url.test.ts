import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { TorrentStore } from '../../src/server/services/store.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('HTTP Basic Auth and Authenticated URLs', () => {
  const tempDir = path.join(os.tmpdir(), `peerflix-auth-test-${Date.now()}`);
  const sampleMagnet = 'magnet:?xt=urn:btih:3f4e15694c9ef89fc285f5e8be6d2a45a6c3826f&dn=AuthMovie';

  it('should include user:pass in m3u and systemStatus when Authorization header is present', async () => {
    const store = new TorrentStore({
      configPath: path.join(tempDir, 'config'),
      downloadPath: path.join(tempDir, 'downloads')
    });
    await store.init();
    const infoHash = await store.add(sampleMagnet);

    const app = createApp({ store, enableLogging: false });

    // 1. GET /system/status with Basic Auth (user:pass123!)
    const basicAuthHeader = 'Basic ' + Buffer.from('user:pass123!').toString('base64');

    const statusRes = await request(app)
      .get('/system/status')
      .set('Authorization', basicAuthHeader);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.authenticatedOrigin).toContain('user:pass123%21@');

    // 2. GET /torrents/:infoHash/files/:fileIndex/vlc.m3u with Basic Auth
    // Mock files in engine so vlc.m3u finds the file
    const engine = store.get(infoHash)!;
    engine.files = [{ index: 0, name: 'AuthMovie.mp4', path: 'AuthMovie.mp4', length: 5000 }] as any[];

    const vlcRes = await request(app)
      .get(`/torrents/${infoHash}/files/0/vlc.m3u`)
      .buffer(true)
      .parse((res, callback) => {
        let text = '';
        res.on('data', (chunk) => { text += chunk.toString(); });
        res.on('end', () => callback(null, text));
      })
      .set('Authorization', basicAuthHeader);

    expect(vlcRes.status).toBe(200);
    const content = typeof vlcRes.body === 'string' ? vlcRes.body : vlcRes.text;
    expect(content).toContain('http://user:pass123%21@');
    expect(content).toContain(`/torrents/${infoHash}/files/0`);

    // 3. GET /torrents/:infoHash/files/:fileIndex/vlc.m3u WITHOUT Basic Auth
    const vlcNoAuthRes = await request(app)
      .get(`/torrents/${infoHash}/files/0/vlc.m3u`)
      .buffer(true)
      .parse((res, callback) => {
        let text = '';
        res.on('data', (chunk) => { text += chunk.toString(); });
        res.on('end', () => callback(null, text));
      });

    expect(vlcNoAuthRes.status).toBe(200);
    const noAuthContent = typeof vlcNoAuthRes.body === 'string' ? vlcNoAuthRes.body : vlcNoAuthRes.text;
    expect(noAuthContent).not.toContain('@');
    expect(noAuthContent).toContain(`/torrents/${infoHash}/files/0`);

    await store.destroyAll();
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
