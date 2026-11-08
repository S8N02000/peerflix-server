import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TorrentStore } from '../services/store.js';
import { defaultDiskMonitor, type DiskMonitor } from '../services/disk-monitor.js';
import { defaultScheduler, type AutoCleanScheduler } from '../services/scheduler.js';
import type { SystemStatusDTO } from '../../shared/types.js';
import { classifyFile } from '../services/classifier.js';
import { getAuthenticatedBaseUrl } from '../utils/auth-url.js';
import { buildM3UEntry } from '../utils/m3u-helper.js';

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

  // POST /system/admin-auth (Verify admin password against environment variable ADMIN_PASSWORD)
  router.post('/system/admin-auth', (req: Request, res: Response) => {
    const configuredPassword = process.env.ADMIN_PASSWORD;
    const { password } = req.body || {};

    if (!configuredPassword) {
      // Default fallback when ADMIN_PASSWORD is not explicitly configured
      if (password === 'admin' || password === 'peerflix' || !password) {
        return res.json({ success: true, token: 'admin-authorized-default' });
      }
      return res.status(401).json({ success: false, message: 'Mot de passe administrateur incorrect (défaut: admin)' });
    }

    if (password === configuredPassword) {
      return res.json({ success: true, token: 'admin-authorized' });
    }

    return res.status(401).json({ success: false, message: 'Mot de passe administrateur incorrect' });
  });

  // GET /playlist.m3u (Global M3U TV playlist for Kodi / VLC / Apple TV / Android TV)
  router.get('/playlist.m3u', (req: Request, res: Response) => {
    const baseUrl = getAuthenticatedBaseUrl(req);
    const filterUser = typeof req.query.user === 'string' ? req.query.user.trim().toLowerCase() : '';
    const filterCat = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    const groupingParam = typeof req.query.grouping === 'string' ? req.query.grouping.trim().toLowerCase() : 'series';
    const groupingMode: 'series' | 'category' = groupingParam === 'category' ? 'category' : 'series';
    const isAdmin = req.query.admin === 'true';
    const onlyUser = req.query.onlyUser === 'true';

    let m3u = '#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n';

    for (const engine of store.list()) {
      const meta = store.getMetadata(engine.infoHash);
      const torrentAddedBy = (meta?.addedBy || '').toLowerCase();
      const isPrivate = Boolean(meta?.isPrivate);

      // Privacy check
      if (isPrivate && !isAdmin) {
        if (!filterUser || torrentAddedBy !== filterUser) {
          continue; // Skip hidden private torrent
        }
      }

      // Filter by user if requested (onlyUser=true)
      if (onlyUser && filterUser && torrentAddedBy !== filterUser) {
        continue;
      }

      const torrentName = (meta?.name || engine.torrent?.name || engine.infoHash).replace(/[\r\n]+/g, ' ').trim();
      const filesToProcess = engine.ready && engine.torrent && engine.files
        ? engine.files.map((f: any, idx: number) => ({ file: f, index: idx }))
        : (meta?.files || []).map((f) => ({ file: f, index: f.index }));

      // Count video files to help identify TV packs
      const videoFilesCount = filesToProcess.filter((f) => classifyFile(f.file.path || f.file.name) === 'video').length;

      for (const item of filesToProcess) {
        const file = item.file;
        const index = item.index;
        const filePath = file.path || file.name;
        const fileCat = classifyFile(filePath);

        if (fileCat !== 'video' && fileCat !== 'audio') {
          continue; // Skip non-media files (exe, zip, iso, etc.)
        }

        const entry = buildM3UEntry({
          torrentName,
          filePath,
          fileName: file.name || 'Piste',
          fileIndex: index,
          engineInfoHash: engine.infoHash,
          baseUrl,
          torrentCategory: meta?.category,
          videoFilesCountInTorrent: videoFilesCount,
          groupingMode
        });

        // Category filter if requested
        if (filterCat) {
          if (filterCat === 'films' && (entry.isSeries || entry.isAudio)) continue;
          if ((filterCat === 'series' || filterCat === 'series tv') && !entry.isSeries) continue;
          if (filterCat === 'music' && !entry.isAudio) continue;
        }

        m3u += entry.rawM3uSnippet;
      }
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="peerflix.m3u"');
    res.send(m3u);
  });

  return router;
}
