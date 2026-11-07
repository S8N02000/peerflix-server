import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../../src/server/app.js';
import { TorrentStore } from '../../src/server/services/store.js';
import { setupSocketIO } from '../../src/server/socket.js';

describe('Socket.IO event security and bounds validation', () => {
  let server: http.Server;
  let clientSocket: ClientSocketType;
  let store: TorrentStore;
  let tempConfigDir: string;
  let tempDownloadDir: string;
  const testHash = '0123456789abcdef0123456789abcdef01234567';

  let mockFile0: any;
  let mockFile1: any;
  let mockEngine: any;

  beforeEach(async () => {
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-sock-cfg-'));
    tempDownloadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peerflix-test-sock-dl-'));
    store = new TorrentStore({
      configPath: tempConfigDir,
      downloadPath: tempDownloadDir
    });
    await store.init();

    mockFile0 = {
      name: 'file0.mp4',
      path: 'file0.mp4',
      length: 1000,
      select: vi.fn(),
      deselect: vi.fn()
    };
    mockFile1 = {
      name: 'file1.mp4',
      path: 'file1.mp4',
      length: 2000,
      select: vi.fn(),
      deselect: vi.fn()
    };

    mockEngine = {
      infoHash: testHash,
      ready: true,
      torrent: { name: 'Sock Media', length: 3000, pieces: [] },
      files: [mockFile0, mockFile1],
      swarm: {
        wires: [],
        downloadSpeed: () => 0,
        pause: vi.fn(),
        resume: vi.fn()
      }
    };

    (store as any).torrents.set(testHash, mockEngine);
    (store as any).metadata.set(testHash, { infoHash: testHash, name: 'Sock Media', addedAt: 1, pinned: false });

    const app = createApp({ store, enableLogging: false });
    server = http.createServer(app);
    setupSocketIO(server, store);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    clientSocket = ClientSocket(`http://127.0.0.1:${port}`);
    await new Promise<void>((resolve) => clientSocket.on('connect', resolve));
  });

  afterEach(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await store.destroyAll();
    try {
      await fs.rm(tempConfigDir, { recursive: true, force: true });
      await fs.rm(tempDownloadDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should ignore invalid file indices (out of bounds, negative, NaN) without crashing', async () => {
    // 99999 out of bounds
    clientSocket.emit('select', testHash, 99999);
    // -1 negative
    clientSocket.emit('select', testHash, -1);
    // NaN
    clientSocket.emit('select', testHash, NaN);
    // String instead of number
    clientSocket.emit('select', testHash, 'not-a-number');

    // Deselect invalid indices
    clientSocket.emit('deselect', testHash, 99999);
    clientSocket.emit('deselect', testHash, -1);
    clientSocket.emit('deselect', testHash, NaN);

    // Wait 100ms for events to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Neither mockFile0 nor mockFile1 should have been called with those invalid indices
    expect(mockFile0.select).not.toHaveBeenCalled();
    expect(mockFile1.select).not.toHaveBeenCalled();
    expect(mockFile0.deselect).not.toHaveBeenCalled();
    expect(mockFile1.deselect).not.toHaveBeenCalled();
  });

  it('should handle pause, resume, select, and deselect with valid indices', async () => {
    // Pause
    clientSocket.emit('pause', testHash);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockEngine.swarm.pause).toHaveBeenCalled();

    // Resume
    clientSocket.emit('resume', testHash);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockEngine.swarm.resume).toHaveBeenCalled();

    // Select valid index 0
    clientSocket.emit('select', testHash, 0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockFile0.select).toHaveBeenCalled();

    // Deselect valid index 1
    clientSocket.emit('deselect', testHash, 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockFile1.deselect).toHaveBeenCalled();
  });
});
