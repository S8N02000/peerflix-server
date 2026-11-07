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

  // GET /c411/search?q=...&cat=...
  router.get('/c411/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.query.q as string) || '';
      const cat = (req.query.cat as string) || '';

      const results = await client.searchTorznab(query, cat);

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

  // POST /c411/add
  router.post('/c411/add', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.body;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'BadRequest', message: 'Missing or invalid result id' });
        return;
      }

      const buffer = await client.fetchTorrentBufferById(id);
      const infoHash = await store.add(buffer);

      res.status(200).json({ infoHash, message: 'Torrent successfully added to Peerflix' });
    } catch (err: any) {
      res.status(500).json({ error: 'C411AddFailed', message: err.message });
    }
  });

  return router;
}
