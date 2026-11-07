#!/usr/bin/env node

import http from 'node:http';
import path from 'node:path';
import { createApp } from './app.js';
import { TorrentStore } from './services/store.js';
import { DiskMonitor } from './services/disk-monitor.js';
import { AutoCleanScheduler } from './services/scheduler.js';
import { setupSocketIO } from './socket.js';
import { registerGracefulShutdown } from './utils/graceful-shutdown.js';

export interface CliOptions {
  port: number;
  configPath?: string;
  downloadPath?: string;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  let port = parseInt(process.env.PORT || '9000', 10);
  let configPath = process.env.PEERFLIX_CONFIG_PATH;
  let downloadPath = process.env.PEERFLIX_DOWNLOAD_PATH;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' || arg === '-p') {
      const val = argv[++i];
      if (val && !isNaN(parseInt(val, 10))) {
        port = parseInt(val, 10);
      }
    } else if (arg === '--config' || arg === '-c') {
      configPath = argv[++i];
    } else if (arg === '--path' || arg === '-d') {
      downloadPath = argv[++i];
    }
  }

  return { port, configPath, downloadPath };
}

export async function startServer(options?: Partial<CliOptions>): Promise<{
  server: http.Server;
  store: TorrentStore;
  scheduler: AutoCleanScheduler;
  diskMonitor: DiskMonitor;
}> {
  const cli = { ...parseArgs(), ...options };

  // 1. Initialize store
  const store = new TorrentStore({
    configPath: cli.configPath,
    downloadPath: cli.downloadPath,
  });
  await store.init();

  // 2. Initialize disk monitor and scheduler
  const diskMonitor = new DiskMonitor(store.getDownloadPath(), undefined, undefined, store);
  const scheduler = new AutoCleanScheduler();

  // 3. Create Express app
  const clientDist = path.resolve(process.cwd(), 'dist/client');
  const app = createApp({
    store,
    clientDistPath: clientDist,
    enableLogging: true,
  });

  // 4. Create HTTP server & attach Socket.IO
  const server = http.createServer(app);
  const io = setupSocketIO(server, store, { diskMonitor, scheduler });

  // Attach disk monitor and scheduler to store with live Socket.IO connection
  diskMonitor.attachToStore(store, io);
  scheduler.start(store, io);

  // 5. Register graceful shutdown
  registerGracefulShutdown({
    server,
    io,
    store,
    scheduler,
  });

  return new Promise((resolve, reject) => {
    server.listen(cli.port, () => {
      console.log(`[Peerflix] Server listening on http://localhost:${cli.port}`);
      console.log(`[Peerflix] Storage path: ${store.getConfigPath()}`);
      console.log(`[Peerflix] Download path: ${store.getDownloadPath()}`);
      resolve({ server, store, scheduler, diskMonitor });
    });
    server.once('error', reject);
  });
}

// Global safeguard against unhandled network socket errors (EPIPE, ECONNRESET)
// commonly thrown when remote peers disconnect abruptly in peer-wire-swarm / torrent-stream
process.on('uncaughtException', (err: any) => {
  if (err && (err.code === 'EPIPE' || err.code === 'ECONNRESET' || err.code === 'ECONNABORTED')) {
    // Benign socket disconnect error from remote peer or client abort - do not crash
    return;
  }
  console.error('[Peerflix] Uncaught exception:', err);
  process.exit(1);
});

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('bin.ts') || process.argv[1].endsWith('bin.js'))) {
  startServer().catch((err) => {
    console.error('[Peerflix] Fatal error on start:', err);
    process.exit(1);
  });
}
