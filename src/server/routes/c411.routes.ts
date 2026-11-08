import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TorrentStore } from '../services/store.js';
import { C411Client } from '../services/c411-client.js';

export function createC411Router(store: TorrentStore, client = new C411Client()): Router {
  const router = Router();

  // GET /c411/status
  router.get('/c411/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await client.getUserProfile();
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: 'C411StatusFailed', message: err.message });
    }
  });

  // GET /c411/search?q=...&category=...&subcat=...&resolution=...
  router.get('/c411/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.query.q as string) || (req.query.name as string) || '';
      const category = (req.query.category as string) || (req.query.cat as string) || '';
      const subcat = (req.query.subcat as string) || '';
      const resolution = (req.query.resolution as string) || '';
      const source = (req.query.source as string) || '';
      const codec = (req.query.codec as string) || '';
      const audioType = (req.query.audioType as string) || '';
      const hdr = (req.query.hdr as string) || '';
      const lang = (req.query.lang as string) || '';
      const subtitles = (req.query.subtitles as string) || '';
      const year = (req.query.year as string) || '';
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 50;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      const xxxMode = client.getXxxAccessMode();
      if (category === '8' || category === '6000') {
        if (xxxMode === 'none') {
          res.json({ results: [] });
          return;
        }
        if (xxxMode === 'admin') {
          const adminPasswordEnv = process.env.ADMIN_PASSWORD;
          const adminToken = req.headers['x-peerflix-admin-token'] as string | undefined;
          const adminPass = (req.headers['x-peerflix-admin-password'] || req.query.admin_pass) as string | undefined;
          const isAdmin = adminPasswordEnv
            ? (adminToken === 'admin-authorized' || adminPass === adminPasswordEnv)
            : (req.query.admin === 'true' ||
               req.headers['x-peerflix-admin'] === 'true' ||
               adminToken === 'admin-authorized' ||
               adminToken === 'admin-authorized-default');

          if (!isAdmin) {
            res.status(403).json({ error: 'Forbidden', message: 'La catégorie XXX est réservée aux administrateurs.' });
            return;
          }
        }
      }

      let results: import('../../shared/types.js').C411SearchResultDTO[] = [];
      try {
        results = await client.searchNative({
          name: query,
          category,
          subcat,
          resolution,
          source,
          codec,
          audioType,
          hdr,
          lang,
          subtitles,
          year,
          page,
          perPage,
          sortBy,
          sortOrder
        });
      } catch (nativeErr) {
        // Fallback to Torznab if native API fails
        results = await client.searchTorznab(query, category);
      }

      // Check if any results are already loaded in store
      const activeHashes = new Set(store.list().map((t) => t.infoHash.toLowerCase()));
      const enhancedResults = results.map((item) => ({
        ...item,
        alreadyAdded: item.infoHash ? activeHashes.has(item.infoHash.toLowerCase()) : false
      }));

      res.json({ results: enhancedResults });
    } catch (err: any) {
      res.status(500).json({ error: 'C411SearchFailed', message: err.message });
    }
  });

  // GET /c411/details/:id
  const handleDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'BadRequest', message: 'Missing torrent id parameter' });
        return;
      }

      const details = await client.getTorrentDetails(id);
      res.json(details);
    } catch (err: any) {
      const status = err.message?.includes('introuvable') ? 404 : 500;
      res.status(status).json({ error: 'C411DetailsFailed', message: err.message });
    }
  };

  router.get('/c411/details/:id', handleDetails);
  router.get('/api/c411/details/:id', handleDetails);

  // POST /c411/add
  router.post('/c411/add', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, addedBy: bodyUser, isPrivate: bodyPrivate } = req.body;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'BadRequest', message: 'Missing or invalid result id' });
        return;
      }

      const addedBy = bodyUser || (req.headers['x-peerflix-user'] as string) || undefined;
      const isPrivate = bodyPrivate === true || bodyPrivate === 'true';

      const buffer = await client.fetchTorrentBufferById(id);
      const infoHash = await store.add(buffer, { addedBy, isPrivate });

      res.status(200).json({ infoHash, message: 'Torrent successfully added to Peerflix' });
    } catch (err: any) {
      res.status(500).json({ error: 'C411AddFailed', message: err.message });
    }
  });

  return router;
}
