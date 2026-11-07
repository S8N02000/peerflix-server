import { Server as SocketIOServer, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { TorrentStore } from './services/store.js';
import { calculateTorrentStats, serializeTorrent } from './services/serializer.js';
import { pauseTorrent, resumeTorrent } from './services/engine.js';
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

  let torrentStatsTimer: NodeJS.Timeout | null = null;
  let systemStatsTimer: NodeJS.Timeout | null = null;

  const startPeriodicStats = () => {
    if (!torrentStatsTimer) {
      // 1. Torrent stats timer (fast, purely synchronous memory reads)
      torrentStatsTimer = setInterval(() => {
        if (io.engine.clientsCount === 0) return;
        for (const engine of store.list()) {
          try {
            const stats = calculateTorrentStats(engine);
            io.emit('stats', engine.infoHash, stats);
          } catch {
            // Ignore
          }
        }
      }, 1000);
      if (torrentStatsTimer.unref) torrentStatsTimer.unref();
    }

    if (!systemStatsTimer) {
      // 2. System stats timer (async fs.statfs decoupled from torrents)
      systemStatsTimer = setInterval(async () => {
        if (io.engine.clientsCount === 0) return;
        try {
          const disk = await diskMonitor.getDiskStats(store.getDownloadPath(), store);
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
      }, 2000);
      if (systemStatsTimer.unref) systemStatsTimer.unref();
    }
  };

  const stopPeriodicStats = () => {
    if (io.engine.clientsCount === 0) {
      if (torrentStatsTimer) {
        clearInterval(torrentStatsTimer);
        torrentStatsTimer = null;
      }
      if (systemStatsTimer) {
        clearInterval(systemStatsTimer);
        systemStatsTimer = null;
      }
    }
  };

  io.on('connection', (socket: Socket) => {
    startPeriodicStats();

    socket.on('disconnect', () => {
      if (io.engine.clientsCount === 0) {
        stopPeriodicStats();
      }
    });

    // Pause torrent with full wire choke and piece deselect
    socket.on('pause', (infoHash: unknown) => {
      if (typeof infoHash !== 'string') return;
      const engine = store.get(infoHash);
      if (engine) {
        pauseTorrent(engine);
        const meta = store.getMetadata(infoHash);
        if (meta) meta.paused = true;
        store.save().catch(() => {});
        const stats = calculateTorrentStats(engine);
        io.emit('stats', infoHash, stats);
        socket.emit('paused', infoHash);
      }
    });

    // Resume torrent with wire unchoke and piece re-select
    socket.on('resume', (infoHash: unknown) => {
      if (typeof infoHash !== 'string') return;
      const engine = store.get(infoHash);
      if (engine) {
        resumeTorrent(engine);
        const meta = store.getMetadata(infoHash);
        if (meta) meta.paused = false;
        store.save().catch(() => {});
        const stats = calculateTorrentStats(engine);
        io.emit('stats', infoHash, stats);
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
      const meta = store.getMetadata(infoHash);

      if (rest.length === 0) {
        // Select all files only when no second argument is provided
        engine.files.forEach((f: any, idx: number) => {
          if (typeof f.select === 'function') {
            f.select();
            f.selected = true;
          }
          if (meta?.files && meta.files[idx]) {
            meta.files[idx].selected = true;
          }
        });
        store.save().catch(() => {});
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
          if (meta?.files && meta.files[fileIndex]) {
            meta.files[fileIndex].selected = true;
          }
          store.save().catch(() => {});
        }
      }
    });

    // Deselect file with strict bounds and NaN check
    socket.on('deselect', (infoHash: unknown, ...rest: unknown[]) => {
      if (typeof infoHash !== 'string') return;
      const engine = store.get(infoHash);
      if (!engine || !engine.files) return;
      const meta = store.getMetadata(infoHash);

      if (rest.length === 0) {
        // Deselect all files only when no second argument is provided
        engine.files.forEach((f: any, idx: number) => {
          if (typeof f.deselect === 'function') {
            f.deselect();
            f.selected = false;
          }
          if (meta?.files && meta.files[idx]) {
            meta.files[idx].selected = false;
          }
        });
        store.save().catch(() => {});
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
          if (meta?.files && meta.files[fileIndex]) {
            meta.files[fileIndex].selected = false;
          }
          store.save().catch(() => {});
        }
      }
    });
  });

  const attachTorrentListeners = (infoHash: string, engine: any) => {
    if (!engine) return;

    try {
      io.emit('verifying', infoHash, calculateTorrentStats(engine));
    } catch {
      // Ignore
    }

    if (engine.ready) {
      const meta = store.getMetadata(infoHash);
      io.emit('ready', infoHash, serializeTorrent(engine, meta));
    } else if (typeof engine.once === 'function') {
      engine.once('ready', () => {
        const meta = store.getMetadata(infoHash);
        io.emit('ready', infoHash, serializeTorrent(engine, meta));
      });
    }

    // Throttle verify events to at most once every 500ms per torrent, emitting full unified 'stats'
    let lastVerifyEmit = 0;
    if (typeof engine.on === 'function') {
      engine.on('verify', () => {
        const now = Date.now();
        if (now - lastVerifyEmit >= 500) {
          lastVerifyEmit = now;
          const stats = calculateTorrentStats(engine);
          io.emit('stats', infoHash, stats);
        }
      });

      engine.on('finished', () => {
        io.emit('finished', infoHash);
      });
    }

    if (typeof engine.once === 'function') {
      engine.once('destroyed', () => {
        io.emit('destroyed', infoHash);
      });
    }
  };

  // 1. Attach listeners immediately to all engines already loaded during store.init()
  for (const engine of store.list()) {
    attachTorrentListeners(engine.infoHash, engine);
  }

  // 2. Attach store listeners to emit updates for newly added torrents
  store.on('torrent', (infoHash: string, engine: any) => {
    attachTorrentListeners(infoHash, engine);
  });

  store.on('remove', (infoHash: string) => {
    io.emit('destroyed', infoHash);
  });

  return io;
}
