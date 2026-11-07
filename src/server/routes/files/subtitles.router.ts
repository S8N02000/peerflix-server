import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TorrentStore } from '../../services/store.js';
import { srtToVtt } from '../../utils/srt-to-vtt.js';
import { findTorrentFile, resolvePlayableFile } from './files.utils.js';

export function createSubtitlesRouter(store: TorrentStore): Router {
  const router = Router();

  // GET /torrents/:infoHash/subtitles/:fileParam (Converts SRT to WebVTT on the fly)
  router.get('/torrents/:infoHash/subtitles/:fileParam', (req: Request, res: Response, next: NextFunction) => {
    const { infoHash, fileParam } = req.params;
    const engine = store.get(infoHash);
    const meta = store.getMetadata(infoHash);

    if (!engine && !meta) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }

    const file = resolvePlayableFile(store, infoHash, fileParam);
    if (!file) {
      if (engine && (!engine.ready || !engine.torrent)) {
        res.status(409).json({ error: 'Conflict', message: 'Metadata not ready yet' });
        return;
      }
      res.status(404).json({ error: 'NotFound', message: 'Subtitle file not found in torrent' });
      return;
    }

    // Protection anti-OOM: reject files > 10MB (video files or oversized payloads)
    if (file.length > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'PayloadTooLarge', message: 'Subtitle file exceeds 10MB limit' });
      return;
    }

    const chunks: Buffer[] = [];
    const stream = file.createReadStream();

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => {
      const fullBuffer = Buffer.concat(chunks);
      const vttContent = srtToVtt(fullBuffer);

      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.send(vttContent);
    });
    stream.on('error', (err: any) => next(err));
  });

  return router;
}
