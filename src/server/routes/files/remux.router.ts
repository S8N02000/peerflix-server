import { Router, type Request, type Response, type NextFunction } from 'express';
import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import path from 'node:path';
import type { TorrentStore } from '../../services/store.js';
import { findTorrentFile } from './files.utils.js';
import { probeMediaStream, mediaProbeCache } from '../../services/media-prober.js';
import { isFileComplete } from '../../services/serializer.js';

export function createRemuxRouter(store: TorrentStore): Router {
  const router = Router();

  // GET /torrents/:infoHash/probe/:fileParam
  router.get('/torrents/:infoHash/probe/:fileParam', async (req: Request, res: Response, next: NextFunction) => {
    const { infoHash, fileParam } = req.params;
    const cacheKey = `${infoHash}:${fileParam}`;

    // Return instant memory cache if already probed
    if (mediaProbeCache.has(cacheKey)) {
      res.json(mediaProbeCache.get(cacheKey));
      return;
    }

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

    try {
      // Stream first 15 MB to ffprobe
      const stream = file.createReadStream({ start: 0, end: Math.min(file.length || 0, 15 * 1024 * 1024) });
      const probeResult = await probeMediaStream(stream, 8000);
      mediaProbeCache.set(cacheKey, probeResult);
      res.json(probeResult);
    } catch (err: any) {
      res.status(500).json({ error: 'ProbeFailed', message: err.message });
    }
  });

  // GET /torrents/:infoHash/remux/:fileParam
  router.get('/torrents/:infoHash/remux/:fileParam', (req: Request, res: Response, next: NextFunction) => {
    const { infoHash, fileParam } = req.params;
    const audioTrackParam = parseInt((req.query.audioTrack as string) || '0', 10);
    const audioTrack = isNaN(audioTrackParam) || audioTrackParam < 0 ? 0 : audioTrackParam;

    const startParam = parseFloat((req.query.start as string) || (req.query.startTime as string) || '0');
    const startSeconds = isNaN(startParam) || startParam < 0 ? 0 : startParam;

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

    // Set streaming headers for Fragmented MP4 (compatible with HTML5 <video> in Chrome, Safari, Firefox)
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const localFilePath = path.join(store.getDownloadPath(), infoHash, file.path || file.name);
    let useDirectFile = false;
    try {
      if (fsSync.existsSync(localFilePath) && isFileComplete(file, engine)) {
        useDirectFile = true;
      }
    } catch {
      useDirectFile = false;
    }

    const inputStream = useDirectFile ? null : file.createReadStream();

    const cachedProbe = mediaProbeCache.get(`${infoHash}:${fileParam}`);
    const isHevc =
      cachedProbe?.videoStreams[0]?.codec === 'hevc' ||
      cachedProbe?.videoStreams[0]?.codec === 'h265';

    // ffmpeg: -c:v copy (0% CPU for video), audio track remuxed to stereo AAC inside Fragmented MP4
    // -tag:v hvc1 ensures HEVC streams are recognized by Chrome / Safari / Edge MP4 decoders
    const inputArgs = useDirectFile
      ? (startSeconds > 0 ? ['-ss', startSeconds.toString(), '-i', localFilePath] : ['-i', localFilePath])
      : (startSeconds > 0 ? ['-ss', startSeconds.toString(), '-i', 'pipe:0'] : ['-i', 'pipe:0']);

    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-fflags',
      '+genpts',
      '-avoid_negative_ts',
      'make_zero',
      ...inputArgs,
      '-map',
      '0:v:0',
      '-map',
      `0:a:${audioTrack}?`,
      '-c:v',
      'copy',
      ...(isHevc ? ['-tag:v', 'hvc1'] : []),
      '-c:a',
      'aac',
      '-ac',
      '2',
      '-b:a',
      '192k',
      '-max_muxing_queue_size',
      '4096',
      '-f',
      'mp4',
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1'
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: [useDirectFile ? 'ignore' : 'pipe', 'pipe', 'pipe']
    });

    let killed = false;
    const cleanup = () => {
      if (!killed) {
        killed = true;
        try {
          ffmpegProcess.kill('SIGKILL');
        } catch {
          // Ignore
        }
        if (inputStream) {
          try {
            inputStream.destroy();
          } catch {
            // Ignore
          }
        }
      }
    };

    // Anti-zombie protection: terminate ffmpeg as soon as client closes connection
    res.on('close', cleanup);
    req.on('close', cleanup);

    if (inputStream && ffmpegProcess.stdin) {
      inputStream.pipe(ffmpegProcess.stdin);

      inputStream.on('error', () => {
        cleanup();
      });

      ffmpegProcess.stdin.on('error', () => {
        cleanup();
      });
    }

    if (ffmpegProcess.stdout) {
      ffmpegProcess.stdout.pipe(res);
    }

    ffmpegProcess.on('error', (err: any) => {
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({ error: 'RemuxError', message: err.message });
      }
    });
  });

  // GET /torrents/:infoHash/embedded-subtitles/:fileParam/:subTrackIndex
  router.get(
    '/torrents/:infoHash/embedded-subtitles/:fileParam/:subTrackIndex',
    (req: Request, res: Response, next: NextFunction) => {
      const { infoHash, fileParam, subTrackIndex } = req.params;
      const subIdx = parseInt(subTrackIndex, 10);

      const engine = store.get(infoHash);
      if (!engine) {
        res.status(404).json({ error: 'NotFound', message: 'Torrent not found' });
        return;
      }

      const file = findTorrentFile(engine, fileParam);
      if (!file) {
        res.status(404).json({ error: 'NotFound', message: 'File not found in torrent' });
        return;
      }

      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');

      const inputStream = file.createReadStream();

      // Extract subtitle track and convert to WebVTT
      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        'pipe:0',
        '-map',
        `0:s:${isNaN(subIdx) ? 0 : subIdx}`,
        '-f',
        'webvtt',
        'pipe:1'
      ];

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const cleanup = () => {
        try {
          ffmpegProcess.kill('SIGKILL');
        } catch {
          // Ignore
        }
        try {
          inputStream.destroy();
        } catch {
          // Ignore
        }
      };

      res.on('close', cleanup);
      req.on('close', cleanup);

      inputStream.pipe(ffmpegProcess.stdin);
      ffmpegProcess.stdout.pipe(res);
    }
  );

  return router;
}
