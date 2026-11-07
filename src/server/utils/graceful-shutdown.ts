import type { Server as HttpServer } from 'node:http';
import type { Server as SocketIOServer } from 'socket.io';
import type { TorrentStore } from '../services/store.js';
import type { AutoCleanScheduler } from '../services/scheduler.js';

export interface GracefulShutdownParams {
  server?: HttpServer | { close: (cb?: () => void) => void };
  io?: SocketIOServer | { close: (cb?: () => void) => void };
  store: TorrentStore;
  scheduler?: AutoCleanScheduler;
  onExit?: (code: number) => void;
}

let isShuttingDown = false;

export async function performGracefulShutdown(
  params: GracefulShutdownParams,
  timeoutMs = 5000
): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log('[Shutdown] Graceful shutdown initiated...');

  // 1. Stop scheduler
  if (params.scheduler) {
    params.scheduler.stop();
  }

  // 2. Close HTTP & WebSocket servers
  const closeTasks: Promise<void>[] = [];

  if (params.io && typeof params.io.close === 'function') {
    closeTasks.push(
      new Promise<void>((resolve) => {
        try {
          params.io!.close(() => resolve());
        } catch {
          resolve();
        }
      })
    );
  }

  if (params.server && typeof params.server.close === 'function') {
    closeTasks.push(
      new Promise<void>((resolve) => {
        try {
          params.server!.close(() => resolve());
        } catch {
          resolve();
        }
      })
    );
  }

  await Promise.allSettled(closeTasks);

  // 3. Save store state & destroy all torrent engines with timeout
  const storeCleanup = async () => {
    try {
      await params.store.save();
      await params.store.destroyAll();
    } catch (err: any) {
      console.warn('[Shutdown] Error during store cleanup:', err.message);
    }
  };

  const timeoutPromise = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    if (timer.unref) timer.unref();
  });

  await Promise.race([storeCleanup(), timeoutPromise]);

  console.log('[Shutdown] Cleanup completed. Exiting.');
  if (params.onExit) {
    params.onExit(0);
  } else {
    process.exit(0);
  }
}

export function registerGracefulShutdown(params: GracefulShutdownParams): void {
  const handler = (signal: string) => {
    console.log(`[Shutdown] Received signal: ${signal}`);
    performGracefulShutdown(params);
  };

  process.once('SIGTERM', () => handler('SIGTERM'));
  process.once('SIGINT', () => handler('SIGINT'));
}
