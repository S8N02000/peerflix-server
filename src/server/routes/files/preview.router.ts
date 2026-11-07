import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TorrentStore } from '../../services/store.js';
import { decodeTextFile, computeStreamSha256 } from '../../utils/text-preview.js';
import { isFileComplete } from '../../services/serializer.js';
import { findTorrentFile } from './files.utils.js';

export function createPreviewRouter(store: TorrentStore): Router {
  const router = Router();

  // GET /torrents/:infoHash/preview/:fileParam (NFO/TXT preview with CP437 decoding)
  router.get('/torrents/:infoHash/preview/:fileParam', (req: Request, res: Response, next: NextFunction) => {
    const { infoHash, fileParam } = req.params;
    const engine = store.get(infoHash);

    if (!engine) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }

    if (!engine.ready || !engine.torrent) {
      res.status(409).json({ error: 'Conflict', message: 'Metadata not ready yet' });
      return;
    }

    const file = findTorrentFile(engine, fileParam);
    if (!file) {
      res.status(404).json({ error: 'NotFound', message: 'File not found in torrent' });
      return;
    }

    if (file.length > 2 * 1024 * 1024) {
      res.status(413).json({ error: 'PayloadTooLarge', message: 'File exceeds 2MB preview limit' });
      return;
    }

    const chunks: Buffer[] = [];
    const stream = file.createReadStream();

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        const decodedText = decodeTextFile(fullBuffer, file.name);
        res.json({ name: file.name, content: decodedText });
      } catch (err) {
        next(err);
      }
    });
    stream.on('error', (err: any) => next(err));
  });

  // GET /torrents/:infoHash/hash/:fileParam (SHA-256 for 100% complete files)
  router.get('/torrents/:infoHash/hash/:fileParam', async (req: Request, res: Response, next: NextFunction) => {
    const { infoHash, fileParam } = req.params;
    const engine = store.get(infoHash);

    if (!engine) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }

    if (!engine.ready || !engine.torrent) {
      res.status(409).json({ error: 'Conflict', message: 'Metadata not ready yet' });
      return;
    }

    const file = findTorrentFile(engine, fileParam);
    if (!file) {
      res.status(404).json({ error: 'NotFound', message: 'File not found in torrent' });
      return;
    }

    if (!isFileComplete(file, engine)) {
      res.status(409).json({ error: 'Conflict', message: 'File is not 100% complete on server' });
      return;
    }

    try {
      const sha256 = await computeStreamSha256(file.createReadStream());
      res.json({ sha256 });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
