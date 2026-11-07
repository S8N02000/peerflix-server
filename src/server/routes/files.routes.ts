import { Router } from 'express';
import type { TorrentStore } from '../services/store.js';
import { createStreamingRouter } from './files/streaming.router.js';
import { createSubtitlesRouter } from './files/subtitles.router.js';
import { createPreviewRouter } from './files/preview.router.js';
import { createArchiveRouter } from './files/archive.router.js';
import { createRemuxRouter } from './files/remux.router.js';
export { encodeContentDisposition } from './files/files.utils.js';

export function createFilesRouter(store: TorrentStore): Router {
  const router = Router();

  // Mount modular sub-routers
  router.use(createStreamingRouter(store));
  router.use(createSubtitlesRouter(store));
  router.use(createPreviewRouter(store));
  router.use(createArchiveRouter(store));
  router.use(createRemuxRouter(store));

  return router;
}
