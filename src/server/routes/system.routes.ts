import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TorrentStore } from '../services/store.js';
import { defaultDiskMonitor, type DiskMonitor } from '../services/disk-monitor.js';
import { defaultScheduler, type AutoCleanScheduler } from '../services/scheduler.js';
import type { SystemStatusDTO } from '../../shared/types.js';
import { classifyFile } from '../services/classifier.js';
import { getAuthenticatedBaseUrl } from '../utils/auth-url.js';

export function createSystemRouter(
  store: TorrentStore,
  diskMonitor: DiskMonitor = defaultDiskMonitor,
  scheduler: AutoCleanScheduler = defaultScheduler
): Router {
  const router = Router();

  // GET /system/status
  router.get('/system/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const diskStats = await diskMonitor.getDiskStats(store.getDownloadPath(), store);
      const nextCleanAt = scheduler.getNextCleanAtISO();

      // Aggregate global download speed across all engines
      let totalDownSpeed = 0;
      for (const engine of store.list()) {
        if (engine.swarm && typeof engine.swarm.downloadSpeed === 'function') {
          totalDownSpeed += engine.swarm.downloadSpeed();
        }
      }

      const status: SystemStatusDTO = {
        disk: diskStats,
        nextCleanAt,
        totalDownSpeed,
        authenticatedOrigin: getAuthenticatedBaseUrl(req)
      };

      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  // POST /system/clean (Manual clean of all unpinned torrents)
  router.post('/system/clean', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await scheduler.cleanAllUnpinned(store);
      res.json({
        success: true,
        removedCount: result.removedCount,
        keptCount: result.keptCount
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /playlist.m3u (Global M3U TV playlist for Kodi / VLC / Apple TV / Android TV)
  router.get('/playlist.m3u', (req: Request, res: Response) => {
    const baseUrl = getAuthenticatedBaseUrl(req);

    let m3u = '#EXTM3U\n';

    for (const engine of store.list()) {
      const meta = store.getMetadata(engine.infoHash);
      const torrentGroup = (meta?.name || engine.torrent?.name || engine.infoHash).replace(/[\r\n]+/g, ' ').trim();

      if (engine.ready && engine.torrent && engine.files) {
        engine.files.forEach((file: any, index: number) => {
          const category = classifyFile(file.path || file.name);
          if (category === 'video' || category === 'audio') {
            const cleanName = (file.name || 'track').replace(/[\r\n]+/g, ' ').trim();
            m3u += `#EXTINF:-1 group-title="${torrentGroup}",${cleanName}\n`;
            m3u += `#EXTGRP:${torrentGroup}\n`;
            m3u += `${baseUrl}/torrents/${engine.infoHash}/files/${index}\n`;
          }
        });
      } else if (meta?.files && meta.files.length > 0) {
        meta.files.forEach((file) => {
          const category = classifyFile(file.path || file.name);
          if (category === 'video' || category === 'audio') {
            const cleanName = (file.name || 'track').replace(/[\r\n]+/g, ' ').trim();
            m3u += `#EXTINF:-1 group-title="${torrentGroup}",${cleanName}\n`;
            m3u += `#EXTGRP:${torrentGroup}\n`;
            m3u += `${baseUrl}/torrents/${engine.infoHash}/files/${file.index}\n`;
          }
        });
      }
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="peerflix.m3u"');
    res.send(m3u);
  });

  return router;
}
