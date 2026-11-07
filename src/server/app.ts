import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { errorHandler } from './middlewares/error-handler.js';
import { defaultStore, type TorrentStore } from './services/store.js';
import { createTorrentsRouter } from './routes/torrents.routes.js';
import { createSystemRouter } from './routes/system.routes.js';
import { createFilesRouter } from './routes/files.routes.js';
import { createC411Router } from './routes/c411.routes.js';
import { C411Client } from './services/c411-client.js';

export interface CreateAppOptions {
  store?: TorrentStore;
  c411Client?: C411Client;
  clientDistPath?: string;
  enableLogging?: boolean;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express();
  const store = options.store || defaultStore;

  // 1. Trust proxy for Traefik reverse proxy
  app.set('trust proxy', 1);

  // 2. Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Customized on media/file streaming routes
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      originAgentCluster: false,
      referrerPolicy: { policy: 'no-referrer' },
      xContentTypeOptions: true,
      xFrameOptions: { action: 'sameorigin' }
    })
  );

  // 3. Strict CORS policy: NO wildcard allow-origin *
  if (process.env.CORS_ORIGIN) {
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN!);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  // 4. Logging & body parsers
  if (options.enableLogging && process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Expose store on app.locals
  app.locals.store = store;

  // Mount routers
  const torrentsRouter = createTorrentsRouter(store);
  const systemRouter = createSystemRouter(store);
  const filesRouter = createFilesRouter(store);
  const c411Router = createC411Router(store, options.c411Client);
  app.use(torrentsRouter);
  app.use(systemRouter);
  app.use(filesRouter);
  app.use(c411Router);

  // Root or test dummy route to test 500 error handling
  app.get('/test-error', () => {
    throw new Error('Test internal error');
  });

  // Client static assets if built
  const clientDist = options.clientDistPath || path.resolve(process.cwd(), 'dist/client');
  app.use(express.static(clientDist));

  // Global error handler
  app.use(errorHandler);

  return app;
}
