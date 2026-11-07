import { Router, type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import * as archiverPkg from 'archiver';
const archiver = (archiverPkg as any).default || archiverPkg;
import type { TorrentStore } from '../../services/store.js';
import { sanitizeRelativePath } from '../../utils/path-security.js';
import { encodeContentDisposition } from './files.utils.js';

export function createArchiveRouter(store: TorrentStore): Router {
  const router = Router();

  // GET /torrents/:infoHash/archive (Fast ZIP generation with store: true, subfolder filtering, safe error handling)
  router.get('/torrents/:infoHash/archive', async (req: Request, res: Response, next: NextFunction) => {
    const { infoHash } = req.params;
    const { folder, selectedOnly } = req.query;
    const engine = store.get(infoHash);

    if (!engine) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }

    if (!engine.ready || !engine.torrent) {
      res.status(409).json({ error: 'Conflict', message: 'Metadata not ready yet' });
      return;
    }

    let filesToArchive = engine.files || [];

    if (selectedOnly === 'true') {
      filesToArchive = filesToArchive.filter((f: any) => f.selected !== false);
    }

    let cleanFolder = '';
    if (folder && typeof folder === 'string') {
      try {
        cleanFolder = sanitizeRelativePath(folder);
      } catch (err) {
        res.status(400).json({ error: 'BadRequest', message: 'Invalid folder parameter' });
        return;
      }

      filesToArchive = filesToArchive.filter((f: any) => {
        const filePath = (f.path || f.name).replace(/\\/g, '/');
        return filePath === cleanFolder || filePath.startsWith(`${cleanFolder}/`);
      });
    }

    if (filesToArchive.length === 0) {
      res.status(404).json({ error: 'NotFound', message: 'No files match archive criteria' });
      return;
    }

    const archive = archiver('zip', { store: true }); // 0% CPU overhead, maximum disk throughput

    archive.on('error', (err: any) => {
      console.warn('[Archive] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'ArchiveError', message: err.message });
      }
    });

    res.on('close', () => {
      try {
        archive.abort();
      } catch {
        // Silent catch
      }
    });

    const archiveName = cleanFolder
      ? `${path.basename(cleanFolder)}.zip`
      : `${engine.torrent.name || infoHash}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', encodeContentDisposition(archiveName, true));

    archive.pipe(res);

    for (const file of filesToArchive) {
      const originalPath = (file.path || file.name).replace(/\\/g, '/');
      let entryPath = originalPath;

      if (cleanFolder && entryPath.startsWith(cleanFolder)) {
        entryPath = entryPath.slice(cleanFolder.length).replace(/^\//, '');
      }

      archive.append(file.createReadStream(), { name: entryPath || file.name });
    }

    archive.finalize();
  });

  return router;
}
