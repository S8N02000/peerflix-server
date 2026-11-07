import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import type { TorrentStore } from '../services/store.js';
import { TorrentParserError, SecurityError } from '../services/torrent-parser.js';
import { serializeTorrent, calculateTorrentStats } from '../services/serializer.js';
import { classifyFile } from '../services/classifier.js';

export function createTorrentsRouter(store: TorrentStore): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20 MB max per file
      files: 10
    }
  });

  // GET /torrents (List all serialized torrents)
  router.get('/torrents', (req: Request, res: Response) => {
    const list = store.list().map((engine) => {
      const meta = store.getMetadata(engine.infoHash);
      return serializeTorrent(engine, meta);
    });
    res.json(list);
  });

  // GET /torrents/:infoHash (Single serialized torrent)
  router.get('/torrents/:infoHash', (req: Request, res: Response) => {
    const { infoHash } = req.params;
    const engine = store.get(infoHash);
    if (!engine) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }
    const meta = store.getMetadata(infoHash);
    res.json(serializeTorrent(engine, meta));
  });

  // GET /torrents/:infoHash/stats
  router.get('/torrents/:infoHash/stats', (req: Request, res: Response) => {
    const { infoHash } = req.params;
    const engine = store.get(infoHash);
    if (!engine) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }
    res.json(calculateTorrentStats(engine));
  });

  // POST /torrents/:infoHash/pin (Toggle pin state)
  router.post('/torrents/:infoHash/pin', (req: Request, res: Response) => {
    const { infoHash } = req.params;
    const engine = store.get(infoHash);
    if (!engine) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }
    const pinned = store.togglePin(infoHash);
    res.json({ pinned });
  });

  // GET /torrents/:infoHash/files (Torrent M3U playlist for video & audio files only)
  router.get('/torrents/:infoHash/files', (req: Request, res: Response) => {
    const { infoHash } = req.params;
    const engine = store.get(infoHash);

    if (!engine) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }

    if (!engine.ready || !engine.torrent) {
      res.status(409).json({ error: 'Conflict', message: 'Metadata not ready yet' });
      return;
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    let m3u = '#EXTM3U\n';
    let mediaCount = 0;

    engine.files.forEach((file: any, index: number) => {
      const category = classifyFile(file.path || file.name);
      if (category === 'video' || category === 'audio') {
        mediaCount++;
        const cleanName = (file.name || 'track').replace(/[\r\n]+/g, ' ').trim();
        m3u += `#EXTINF:-1,${cleanName}\n`;
        m3u += `${baseUrl}/torrents/${infoHash}/files/${index}\n`;
      }
    });

    const torrentName = (engine.torrent.name || infoHash).replace(/[\r\n]+/g, ' ').trim();
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(torrentName)}.m3u"`);
    res.send(m3u);
  });

  // POST /upload (accepts single 'file' or multiple 'file' uploads in memory)
  router.post(
    '/upload',
    (req: Request, res: Response, next: NextFunction) => {
      upload.array('file', 10)(req, res, (err: any) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: 'PayloadTooLarge', message: 'File size exceeds 20MB limit' });
            return;
          }
          next(err);
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'BadRequest', message: 'No torrent file provided' });
        return;
      }

      try {
        const results = [];
        for (const file of files) {
          const infoHash = await store.add(file.buffer);
          results.push({ infoHash, name: file.originalname });
        }

        if (results.length === 1) {
          res.json({ infoHash: results[0].infoHash });
        } else {
          res.json({ results });
        }
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /torrents (accepts magnet link, hash or public URL)
  router.post('/torrents', async (req: Request, res: Response, next: NextFunction) => {
    const { link } = req.body || {};

    if (!link || typeof link !== 'string' || link.trim().length === 0) {
      res.status(400).json({ error: 'BadRequest', message: 'link parameter is required' });
      return;
    }

    if (link.length > 4096) {
      res.status(400).json({ error: 'BadRequest', message: 'link exceeds maximum allowed length of 4096 characters' });
      return;
    }

    try {
      const infoHash = await store.add(link);
      res.json({ infoHash });
    } catch (err: any) {
      if (err instanceof SecurityError) {
        res.status(400).json({ error: 'SecurityError', message: err.message });
        return;
      }
      if (err instanceof TorrentParserError) {
        res.status(400).json({ error: 'BadRequest', message: err.message });
        return;
      }
      next(err);
    }
  });

  // DELETE /torrents/:infoHash
  router.delete('/torrents/:infoHash', async (req: Request, res: Response, next: NextFunction) => {
    const { infoHash } = req.params;
    try {
      await store.remove(infoHash);
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
