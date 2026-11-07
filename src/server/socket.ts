import { Server as SocketIOServer, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { TorrentStore } from './services/store.js';
import { calculateTorrentStats, serializeTorrent } from './services/serializer.js';
import { defaultDiskMonitor, type DiskMonitor } from './services/disk-monitor.js';
import { defaultScheduler, type AutoCleanScheduler } from './services/scheduler.js';

export function setupSocketIO(
  httpServer: HttpServer,
  store: TorrentStore,
  options: {
    diskMonitor?: DiskMonitor;
    scheduler?: AutoCleanScheduler;
  } = {}
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || false,
      methods: ['GET', 'POST']
    }
  });

  const diskMonitor = options.diskMonitor || defaultDiskMonitor;
  const scheduler = options.scheduler || defaultScheduler;

  let periodicTimer: NodeJS.Timeout | null = null;

  const startPeriodicStats = () => {
    if (periodicTimer) return;

    periodicTimer = setInterval(async () => {
      // Only emit if at least one client is connected
      const clientCount = io.engine.clientsCount;
      if (clientCount === 0) {
        return;
      }

      // 1. Torrent stats
      for (const engine of store.list()) {
        try {
          const stats = calculateTorrentStats(engine);
          io.emit('stats', engine.infoHash, stats);
        } catch {
          // Ignore
        }
      }

      // 2. System status
      try {
        const disk = await diskMonitor.getDiskStats(store.getDownloadPath());
        const nextCleanAt = scheduler.getNextCleanAtISO();
        let totalDownSpeed = 0;
        for (const engine of store.list()) {
          if (engine.swarm && typeof engine.swarm.downloadSpeed === 'function') {
            totalDownSpeed += engine.swarm.downloadSpeed();
          }
        }
        io.emit('systemStats', { disk, nextCleanAt, totalDownSpeed });
      } catch {
        // Ignore
      }
    }, 1000);

    if (periodicTimer.unref) {
      periodicTimer.unref();
    }
  };

  const stopPeriodicStats = () => {
    if (periodicTimer && io.engine.clientsCount === 0) {
      clearInterval(periodicTimer);
      periodicTimer = null;
    }
  };

  io.on('connection', (socket: Socket) => {
    startPeriodicStats();

    socket.on('disconnect', () => {
      if (io.engine.clientsCount === 0) {
        stopPeriodicStats();
      }
    });

    // Pause torrent
    socket.on('pause', (infoHash: unknown) => {
      if (typeof infoHash !== 'string') return;
      const engine = store.get(infoHash);
      if (engine && engine.swarm && typeof engine.swarm.pause === 'function') {
        engine.swarm.pause();
        socket.emit('paused', infoHash);
      }
    });

    // Resume torrent
    socket.on('resume', (infoHash: unknown) => {
      if (typeof infoHash !== 'string') return;
      const engine = store.get(infoHash);
      if (engine && engine.swarm && typeof engine.swarm.resume === 'function') {
        engine.swarm.resume();
        socket.emit('resumed', infoHash);
      }
    });

    // Pin toggle
    socket.on('pin', (infoHash: unknown) => {
      if (typeof infoHash !== 'string') return;
      const engine = store.get(infoHash);
      if (!engine) return;
      const pinned = store.togglePin(infoHash);
      io.emit('pinned', { infoHash, pinned });
    });

    // Select file with strict bounds and NaN check
    socket.on('select', (infoHash: unknown, ...rest: unknown[]) => {
      if (typeof infoHash !== 'string') return;
      const engine = store.get(infoHash);
      if (!engine || !engine.files) return;

      if (rest.length === 0) {
        // Select all files only when no second argument is provided
        engine.files.forEach((f: any) => {
          if (typeof f.select === 'function') {
            f.select();
            f.selected = true;
          }
        });
        return;
      }

      const fileIndex = rest[0];
      if (
        typeof fileIndex === 'number' &&
        Number.isInteger(fileIndex) &&
        !isNaN(fileIndex) &&
        fileIndex >= 0 &&
        fileIndex < engine.files.length
      ) {
        const file = engine.files[fileIndex];
        if (file && typeof file.select === 'function') {
          file.select();
          file.selected = true;
        }
      }
    });

    // Deselect file with strict bounds and NaN check
    socket.on('deselect', (infoHash: unknown, ...rest: unknown[]) => {
      if (typeof infoHash !== 'string') return;
      const engine = store.get(infoHash);
      if (!engine || !engine.files) return;

      if (rest.length === 0) {
        // Deselect all files only when no second argument is provided
        engine.files.forEach((f: any) => {
          if (typeof f.deselect === 'function') {
            f.deselect();
            f.selected = false;
          }
        });
        return;
      }

      const fileIndex = rest[0];
      if (
        typeof fileIndex === 'number' &&
        Number.isInteger(fileIndex) &&
        !isNaN(fileIndex) &&
        fileIndex >= 0 &&
        fileIndex < engine.files.length
      ) {
        const file = engine.files[fileIndex];
        if (file && typeof file.deselect === 'function') {
          file.deselect();
          file.selected = false;
        }
      }
    });
  });

  // Attach store listeners to emit updates
  store.on('torrent', (infoHash: string, engine: any) => {
    io.emit('verifying', infoHash, calculateTorrentStats(engine));

    engine.once('ready', () => {
      const meta = store.getMetadata(infoHash);
      io.emit('ready', infoHash, serializeTorrent(engine, meta));
    });

    engine.on('verify', () => {
      const stats = calculateTorrentStats(engine);
      io.emit('download', infoHash, {
        progress: stats.progress,
        downloaded: stats.downloaded,
        speed: stats.speed
      });
    });

    engine.on('finished', () => {
      io.emit('finished', infoHash);
    });

    engine.once('destroyed', () => {
      io.emit('destroyed', infoHash);
    });
  });

  store.on('remove', (infoHash: string) => {
    io.emit('destroyed', infoHash);
  });

  return io;
}
