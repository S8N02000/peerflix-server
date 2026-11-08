import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { C411Client } from '../../src/server/services/c411-client.js';
import { createApp } from '../../src/server/app.js';

describe('C411 Torznab & Profile Service', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>C411 Torznab Feed</title>
    <item>
      <title><![CDATA[American.Gods.S03.MULTI.VFF.1080p.WEB.EAC3.5.1.H264-FRATERNiTY]]></title>
      <link>https://c411.org/download/12345?apikey=SECRET_API_KEY_12345</link>
      <comments>https://c411.org/torrents/12345#comments</comments>
      <size>39728447488</size>
      <pubDate>Mon, 03 Mar 2025 14:00:00 +0000</pubDate>
      <description><![CDATA[<p>[center][b]American Gods Saison 3[/b][/center]</p><p>Synopsis de la série...</p>]]></description>
      <enclosure url="https://c411.org/download/12345?apikey=SECRET_API_KEY_12345" length="39728447488" type="application/x-bittorrent" />
      <torznab:attr name="category" value="5000" />
      <torznab:attr name="seeders" value="37" />
      <torznab:attr name="peers" value="47" />
      <torznab:attr name="grabs" value="12" />
      <torznab:attr name="infohash" value="abcdef1234567890abcdef1234567890abcdef12" />
      <torznab:attr name="downloadvolumefactor" value="0" />
      <torznab:attr name="coverurl" value="https://img.c411.org/covers/american_gods_s03.jpg" />
      <torznab:attr name="season" value="3" />
      <torznab:attr name="year" value="2021" />
      <torznab:attr name="resolution" value="1080p" />
    </item>
  </channel>
</rss>`;

  it('should parse Torznab XML and sanitize output without leaking SECRET_API_KEY', () => {
    const client = new C411Client('SECRET_API_KEY_12345', 'https://c411.org');
    const results = client.parseTorznabXml(sampleXml);

    expect(results.length).toBe(1);
    const r = results[0];

    expect(r.title).toBe('American.Gods.S03.MULTI.VFF.1080p.WEB.EAC3.5.1.H264-FRATERNiTY');
    expect(r.size).toBe(39728447488);
    expect(r.seeders).toBe(37);
    expect(r.leechers).toBe(10); // peers (47) - seeders (37)
    expect(r.isFreeleech).toBe(true);
    expect(r.categoryName).toBe('Séries TV');
    expect(r.infoHash).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(r.posterUrl).toBe('https://img.c411.org/covers/american_gods_s03.jpg');
    expect(r.season).toBe(3);
    expect(r.year).toBe('2021');
    expect(r.resolution).toBe('1080p');
    expect(r.torrentId).toBe('12345');

    // Security check: ensure API key is never in result ID or any field
    const jsonStr = JSON.stringify(r);
    expect(jsonStr).not.toContain('SECRET_API_KEY_12345');
    expect(jsonStr).not.toContain('download/12345');
    expect(r.id.length).toBe(16);
  });

  it('should return rich details, description and comments with getTorrentDetails', async () => {
    const client = new C411Client('KEY', 'https://c411.org');
    const results = client.parseTorznabXml(sampleXml);
    const item = results[0];

    const mockHtml = `
      <div class="torrent-description">
        <center><h2>Autodesk Civil 3D 2027</h2></center>
        <img src="/images/civil3d_cover.png" />
        <pre class="nfo">INSTALLATION: 1. Installer le setup. 2. Copier le crack.</pre>
      </div>
      <div class="comment">
        <a class="username">Alexandre92</a>
        <time>il y a 2 jours</time>
        <div class="comment-body">Merci beaucoup pour le partage, marche impec sur Win 11 !</div>
      </div>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      text: vi.fn().mockResolvedValue(mockHtml)
    } as any);

    const details = await client.getTorrentDetails(item.id);

    expect(details.id).toBe(item.id);
    expect(details.title).toBe(item.title);
    expect(details.descriptionHtml).toContain('Autodesk Civil 3D 2027');
    expect(details.descriptionHtml).toContain('src="https://c411.org/images/civil3d_cover.png"');
    expect(details.nfo).toContain('INSTALLATION: 1. Installer le setup.');
    expect(details.comments.length).toBe(1);
    expect(details.comments[0].author).toBe('Alexandre92');
    expect(details.comments[0].content).toContain('marche impec sur Win 11 !');
  });

  it('should handle /c411/status route and return profile info', async () => {
    const mockClient: any = {
      isEnabled: () => true,
      getUserProfile: vi.fn().mockResolvedValue({
        enabled: true,
        username: 'TestSeedbox',
        uploadedBytes: 5450000000000,
        downloadedBytes: 1200000000000,
        zenBalance: 230,
        freeleechActive: true,
        downloadAllowed: true
      }),
      searchTorznab: vi.fn().mockResolvedValue([]),
      fetchTorrentBufferById: vi.fn(),
      getTorrentDetails: vi.fn()
    };

    const mockStore: any = {
      get: vi.fn().mockReturnValue(null),
      getMetadata: vi.fn().mockReturnValue(undefined),
      getDownloadPath: vi.fn().mockReturnValue('/tmp'),
      list: vi.fn().mockReturnValue([]),
      on: vi.fn()
    };

    const app = createApp({ store: mockStore, c411Client: mockClient, enableLogging: false });

    const res = await request(app).get('/c411/status');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('should handle GET /c411/details/:id and return details DTO', async () => {
    const mockDetails = {
      id: 'test_id_999',
      title: 'Test Release',
      size: 1000000,
      descriptionHtml: '<p>Super description</p>',
      comments: [{ author: 'User1', content: 'Top!' }]
    };

    const mockClient: any = {
      isEnabled: () => true,
      getTorrentDetails: vi.fn().mockResolvedValue(mockDetails)
    };

    const mockStore: any = {
      get: vi.fn().mockReturnValue(null),
      getMetadata: vi.fn().mockReturnValue(undefined),
      getDownloadPath: vi.fn().mockReturnValue('/tmp'),
      list: vi.fn().mockReturnValue([]),
      on: vi.fn()
    };

    const app = createApp({ store: mockStore, c411Client: mockClient, enableLogging: false });

    const res = await request(app).get('/c411/details/test_id_999');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('test_id_999');
    expect(res.body.descriptionHtml).toBe('<p>Super description</p>');
    expect(res.body.comments[0].author).toBe('User1');
  });

  it('should handle /c411/add by downloading torrent buffer and calling store.add', async () => {
    const dummyBuffer = Buffer.from('d8:announce3:fakee');
    const client = new C411Client('KEY', 'https://c411.org');
    (client as any).downloadUrlVault.set('test_id_123', 'https://c411.org/dummy.torrent');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(dummyBuffer)
    } as any);

    const mockStore: any = {
      get: vi.fn().mockReturnValue(null),
      getMetadata: vi.fn().mockReturnValue(undefined),
      getDownloadPath: vi.fn().mockReturnValue('/tmp'),
      list: vi.fn().mockReturnValue([]),
      add: vi.fn().mockResolvedValue('new_info_hash_123'),
      on: vi.fn()
    };

    const app = createApp({ store: mockStore, c411Client: client, enableLogging: false });

    const res = await request(app)
      .post('/c411/add')
      .send({ id: 'test_id_123' });

    expect(res.status).toBe(200);
    expect(res.body.infoHash).toBe('new_info_hash_123');
    expect(mockStore.add).toHaveBeenCalled();
  });

  describe('XXX Category Access Control & Environment Configuration', () => {
    it('defaults xxxAccess to "admin" when C411_XXX_ACCESS / ENABLE_XXX is not set', () => {
      const original = process.env.C411_XXX_ACCESS;
      delete process.env.C411_XXX_ACCESS;
      delete process.env.ENABLE_XXX;

      const client = new C411Client('KEY', 'https://c411.org');
      expect(client.getXxxAccessMode()).toBe('admin');

      if (original) process.env.C411_XXX_ACCESS = original;
    });

    it('parses xxxAccess as "all" or "none" correctly from environment variables', () => {
      process.env.C411_XXX_ACCESS = 'all';
      const clientAll = new C411Client('KEY', 'https://c411.org');
      expect(clientAll.getXxxAccessMode()).toBe('all');

      process.env.C411_XXX_ACCESS = 'none';
      const clientNone = new C411Client('KEY', 'https://c411.org');
      expect(clientNone.getXxxAccessMode()).toBe('none');

      delete process.env.C411_XXX_ACCESS;
    });

    it('rejects category 8 search with 403 Forbidden for non-admin when access is "admin"', async () => {
      const mockClient: any = {
        isEnabled: () => true,
        getXxxAccessMode: () => 'admin',
        searchNative: vi.fn(),
        searchTorznab: vi.fn().mockResolvedValue([])
      };
      const mockStore: any = {
        list: vi.fn().mockReturnValue([])
      };
      const app = createApp({ store: mockStore, c411Client: mockClient, enableLogging: false });

      const res = await request(app).get('/c411/search?category=8');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('allows category 8 search for admin when access is "admin"', async () => {
      const mockClient: any = {
        isEnabled: () => true,
        getXxxAccessMode: () => 'admin',
        searchNative: vi.fn().mockResolvedValue([
          { id: 'xxx1', title: 'Adult Movie 1080p', size: 1000, seeders: 10, leechers: 2, isFreeleech: false }
        ]),
        searchTorznab: vi.fn()
      };
      const mockStore: any = {
        list: vi.fn().mockReturnValue([])
      };
      const app = createApp({ store: mockStore, c411Client: mockClient, enableLogging: false });

      const res = await request(app)
        .get('/c411/search?category=8')
        .set('X-Peerflix-Admin-Token', 'admin-authorized');

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
    });

    it('allows category 8 search for everyone when access is "all"', async () => {
      const mockClient: any = {
        isEnabled: () => true,
        getXxxAccessMode: () => 'all',
        searchNative: vi.fn().mockResolvedValue([
          { id: 'xxx2', title: 'Adult Movie 720p', size: 1000, seeders: 5, leechers: 1, isFreeleech: false }
        ]),
        searchTorznab: vi.fn()
      };
      const mockStore: any = {
        list: vi.fn().mockReturnValue([])
      };
      const app = createApp({ store: mockStore, c411Client: mockClient, enableLogging: false });

      const res = await request(app).get('/c411/search?category=8');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
    });
  });
});
