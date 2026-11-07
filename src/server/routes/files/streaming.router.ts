import { Router, type Request, type Response } from 'express';
import rangeParser from 'range-parser';
import pump from 'pump';
import path from 'node:path';
import type { TorrentStore } from '../../services/store.js';
import {
  MIME_TYPES,
  ALWAYS_ATTACHMENT_EXTENSIONS,
  encodeContentDisposition,
  findTorrentFile,
} from './files.utils.js';
import { getAuthenticatedBaseUrl } from '../../utils/auth-url.js';

export function createStreamingRouter(store: TorrentStore): Router {
  const router = Router();

  const handleFileRequest = (req: Request, res: Response) => {
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

    const ext = path.extname(file.name).toLowerCase();
    const isExplicitDownload = req.query.download === '1';
    const forceAttachment = isExplicitDownload || ALWAYS_ATTACHMENT_EXTENSIONS.has(ext);

    // Standard security headers
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; media-src 'self'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
    );

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', encodeContentDisposition(file.name, forceAttachment));

    const totalLength = file.length || 0;
    const rangeHeader = req.headers.range;

    if (!rangeHeader) {
      res.status(200);
      res.setHeader('Content-Length', totalLength);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      pump(file.createReadStream(), res, (err) => {
        if (err && (err as any).code !== 'ECONNRESET') {
          // Client closed connection normally, no logging needed
        }
      });
      return;
    }

    const parsedRanges = rangeParser(totalLength, rangeHeader);

    // Unsatisfiable range
    if (parsedRanges === -1) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${totalLength}`);
      res.end();
      return;
    }

    // Malformed range -> serve full file with 200 OK
    if (parsedRanges === -2 || !Array.isArray(parsedRanges) || parsedRanges.length === 0) {
      res.status(200);
      res.setHeader('Content-Length', totalLength);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      pump(file.createReadStream(), res);
      return;
    }

    // Satisfiable single range (multi-threading IDM / JDownloader / Safari / Chrome)
    const range = parsedRanges[0];
    const chunkLength = range.end - range.start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${totalLength}`);
    res.setHeader('Content-Length', chunkLength);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    pump(file.createReadStream({ start: range.start, end: range.end }), res, (err) => {
      if (err && (err as any).code !== 'ECONNRESET') {
        // Connection closed by client
      }
    });
  };

  // GET /torrents/:infoHash/files/:fileParam/vlc.m3u
  router.get('/torrents/:infoHash/files/:fileParam/vlc.m3u', (req: Request, res: Response) => {
    const { infoHash, fileParam } = req.params;
    const engine = store.get(infoHash);
    const meta = store.getMetadata(infoHash);

    if (!engine && !meta) {
      res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
      return;
    }

    let fileName = '';
    let fileIndex: string | number = fileParam;

    const file = engine ? findTorrentFile(engine, fileParam) : undefined;
    if (file) {
      fileName = file.name;
      fileIndex = file.index !== undefined ? file.index : fileParam;
    } else if (meta?.files && meta.files.length > 0) {
      const idx = parseInt(fileParam, 10);
      const cached = !isNaN(idx) ? meta.files.find((f) => f.index === idx) : meta.files.find((f) => f.name === fileParam);
      if (cached) {
        fileName = cached.name;
        fileIndex = cached.index;
      }
    }

    if (!fileName) {
      res.status(404).json({ error: 'NotFound', message: 'File not found in torrent' });
      return;
    }

    const baseUrl = getAuthenticatedBaseUrl(req);
    const directStreamUrl = `${baseUrl}/torrents/${infoHash}/files/${fileIndex}`;

    const m3uContent = `#EXTM3U\n#EXTINF:-1,${fileName}\n${directStreamUrl}\n`;
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}.m3u"`);
    res.send(m3uContent);
  });

  router.get('/torrents/:infoHash/files/:fileParam', handleFileRequest);
  router.head('/torrents/:infoHash/files/:fileParam', handleFileRequest);

  return router;
}
