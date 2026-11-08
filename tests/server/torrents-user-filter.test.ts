import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../../src/server/app.js';
import { TorrentStore } from '../../src/server/services/store.js';

describe('Multi-user pseudo filtering and privacy API', () => {
  let app: express.Express;
  let store: TorrentStore;
  let tempConfigDir: string;
  let tempDownloadDir: string;

  beforeEach(async () => {
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-usr-cfg-'));
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-usr-dl-'));

    store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir,
    });
    await store.init();

    const hash1 = '1111111111111111111111111111111111111111';
    const hash2 = '2222222222222222222222222222222222222222';

    const engine1: any = {
      infoHash: hash1,
      ready: true,
      torrent: { name: 'Alice Private Movie', length: 1000 },
      files: [{ name: 'movie.mp4', path: 'movie.mp4', length: 1000 }],
      swarm: { wires: [], downloadSpeed: () => 0 }
    };

    const engine2: any = {
      infoHash: hash2,
      ready: true,
      torrent: { name: 'Bob Public Series', length: 2000 },
      files: [{ name: 'series.S01E01.mp4', path: 'series.S01E01.mp4', length: 2000 }],
      swarm: { wires: [], downloadSpeed: () => 0 }
    };

    (store as any).torrents.set(hash1, engine1);
    (store as any).torrents.set(hash2, engine2);
    (store as any).metadata.set(hash1, {
      infoHash: hash1,
      name: 'Alice Private Movie',
      addedAt: Date.now() - 3600000,
      pinned: false,
      addedBy: 'Alice',
      isPrivate: true
    });
    (store as any).metadata.set(hash2, {
      infoHash: hash2,
      name: 'Bob Public Series',
      addedAt: Date.now() - 7200000,
      pinned: false,
      addedBy: 'Bob',
      isPrivate: false
    });

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

  it('hides private torrents from unauthenticated or foreign users', async () => {
    // Foreign user
    const res = await request(app)
      .get('/torrents')
      .set('X-Peerflix-User', 'Charlie');

    expect(res.status).toBe(200);
    const hashes = res.body.map((t: any) => t.infoHash);
    expect(hashes).not.toContain('1111111111111111111111111111111111111111');
    expect(hashes).toContain('2222222222222222222222222222222222222222');
  });

  it('reveals private torrent to owner matching X-Peerflix-User', async () => {
    const res = await request(app)
      .get('/torrents')
      .set('X-Peerflix-User', 'Alice');

    expect(res.status).toBe(200);
    const hashes = res.body.map((t: any) => t.infoHash);
    expect(hashes).toContain('1111111111111111111111111111111111111111');
    expect(hashes).toContain('2222222222222222222222222222222222222222');
  });

  it('reveals all torrents to admin matching X-Peerflix-Admin: true', async () => {
    const res = await request(app)
      .get('/torrents')
      .set('X-Peerflix-Admin', 'true');

    expect(res.status).toBe(200);
    const hashes = res.body.map((t: any) => t.infoHash);
    expect(hashes).toContain('1111111111111111111111111111111111111111');
    expect(hashes).toContain('2222222222222222222222222222222222222222');
  });

  it('allows toggling torrent privacy via PATCH /torrents/:infoHash/visibility', async () => {
    const hash = '1111111111111111111111111111111111111111';
    const resPatch = await request(app)
      .patch(`/torrents/${hash}/visibility`)
      .send({ isPrivate: false });

    expect(resPatch.status).toBe(200);
    expect(resPatch.body.isPrivate).toBe(false);

    // Now Charlie should see it
    const resGet = await request(app)
      .get('/torrents')
      .set('X-Peerflix-User', 'Charlie');
    const hashes = resGet.body.map((t: any) => t.infoHash);
    expect(hashes).toContain(hash);
  });

  it('filters M3U playlist by user with ?user=Alice&onlyUser=true', async () => {
    const resAliceOnly = await request(app).get('/playlist.m3u?user=Alice&onlyUser=true');
    expect(resAliceOnly.status).toBe(200);
    const textAlice = resAliceOnly.text || (resAliceOnly.body ? resAliceOnly.body.toString('utf-8') : '');
    expect(textAlice).toContain('Alice Private Movie');
    expect(textAlice).not.toContain('Bob Public Series');
  });

  it('validates admin password via POST /system/admin-auth and enforces ADMIN_PASSWORD environment variable', async () => {
    process.env.ADMIN_PASSWORD = 'supersecretadminpass';
    try {
      // 1. Wrong password
      const resBad = await request(app)
        .post('/system/admin-auth')
        .send({ password: 'wrongpass' });
      expect(resBad.status).toBe(401);
      expect(resBad.body.success).toBe(false);

      // 2. Correct password
      const resGood = await request(app)
        .post('/system/admin-auth')
        .send({ password: 'supersecretadminpass' });
      expect(resGood.status).toBe(200);
      expect(resGood.body.success).toBe(true);
      expect(resGood.body.token).toBe('admin-authorized');

      // 3. Foreign user with only X-Peerflix-Admin: true without token/pass is BLOCKED from private torrents
      const resBlocked = await request(app)
        .get('/torrents')
        .set('X-Peerflix-Admin', 'true')
        .set('X-Peerflix-User', 'Charlie');
      const blockedHashes = resBlocked.body.map((t: any) => t.infoHash);
      expect(blockedHashes).not.toContain('1111111111111111111111111111111111111111');

      // 4. Authenticated admin with X-Peerflix-Admin-Token: admin-authorized CAN view all private torrents
      const resAllowed = await request(app)
        .get('/torrents')
        .set('X-Peerflix-Admin-Token', 'admin-authorized')
        .set('X-Peerflix-User', 'Charlie');
      const allowedHashes = resAllowed.body.map((t: any) => t.infoHash);
      expect(allowedHashes).toContain('1111111111111111111111111111111111111111');
    } finally {
      delete process.env.ADMIN_PASSWORD;
    }
  });
});
