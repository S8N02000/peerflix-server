import crypto from 'node:crypto';
import type { C411SearchResultDTO, C411ProfileDTO } from '../../shared/types.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class C411Client {
  private apiKey: string;
  private baseUrl: string;
  private downloadUrlVault = new Map<string, string>(); // id -> full download url with apikey
  private searchCache = new Map<string, CacheEntry<C411SearchResultDTO[]>>();
  private profileCache: CacheEntry<C411ProfileDTO> | null = null;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (apiKey ?? process.env.C411_API_KEY ?? '').trim();
    this.baseUrl = (baseUrl ?? process.env.C411_BASE_URL ?? 'https://c411.org').replace(/\/$/, '').trim();
  }

  public isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Search C411 Torznab API with caching (2 min) and secure ID obfuscation
   */
  public async searchTorznab(query = '', torznabCat = ''): Promise<C411SearchResultDTO[]> {
    if (!this.isEnabled()) {
      return [];
    }

    const cacheKey = `${query.toLowerCase().trim()}:${torznabCat.trim()}`;
    const now = Date.now();
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const url = new URL(`${this.baseUrl}/api`);
    url.searchParams.set('t', 'search');
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('limit', '50');

    if (query.trim()) {
      url.searchParams.set('q', query.trim());
    }
    if (torznabCat.trim()) {
      url.searchParams.set('cat', torznabCat.trim());
    }

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Prowlarr/1.0 Peerflix',
        Accept: 'application/xml, text/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`C411 Torznab API responded with HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    const results = this.parseTorznabXml(xmlText);

    // Cache for 2 minutes
    this.searchCache.set(cacheKey, {
      data: results,
      expiresAt: now + 2 * 60 * 1000
    });

    return results;
  }

  /**
   * Parse Torznab XML payload into sanitized DTOs without leaking apikey
   */
  public parseTorznabXml(xml: string): C411SearchResultDTO[] {
    const results: C411SearchResultDTO[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];

      const getTag = (tag: string): string => {
        const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const m = r.exec(itemContent);
        if (m) {
          return m[1].replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1').trim();
        }
        return '';
      };

      const title = getTag('title') || 'Sans titre';
      const sizeStr = getTag('size');
      const size = sizeStr ? parseInt(sizeStr, 10) : 0;
      const pubDate = getTag('pubDate');

      // Download URL: enclosure url or link
      let downloadUrl = '';
      const enclosureMatch = /<enclosure[^>]*url=["']([^"']+)["']/i.exec(itemContent);
      if (enclosureMatch) {
        downloadUrl = enclosureMatch[1].replace(/&amp;/g, '&');
      } else {
        downloadUrl = getTag('link').replace(/&amp;/g, '&');
      }

      // Torznab attributes
      const getAttr = (name: string): string => {
        const r = new RegExp(`<torznab:attr[^>]*name=["']${name}["'][^>]*value=["']([^"']+)["']`, 'i');
        const m = r.exec(itemContent);
        return m ? m[1] : '';
      };

      const seedersStr = getAttr('seeders');
      const seeders = seedersStr ? parseInt(seedersStr, 10) : 0;

      const peersStr = getAttr('peers');
      const peers = peersStr ? parseInt(peersStr, 10) : 0;
      const leechers = Math.max(0, peers - seeders);

      const grabsStr = getAttr('grabs');
      const completed = grabsStr ? parseInt(grabsStr, 10) : undefined;

      const categoryId = getAttr('category') || undefined;
      const infoHash = getAttr('infohash') || undefined;
      const downloadvolumefactor = getAttr('downloadvolumefactor');
      const isFreeleech = downloadvolumefactor === '0';

      // Extract Poster / Cover URL (Torznab coverurl, media:thumbnail, image enclosure, or img in description)
      let posterUrl = getAttr('coverurl') || getAttr('poster') || undefined;
      if (!posterUrl) {
        const mediaThumb = /<media:thumbnail[^>]*url=["']([^"']+)["']/i.exec(itemContent);
        if (mediaThumb) {
          posterUrl = mediaThumb[1].replace(/&amp;/g, '&');
        }
      }
      if (!posterUrl) {
        const imgEnclosure = /<enclosure[^>]*type=["']image\/[^"']+["'][^>]*url=["']([^"']+)["']/i.exec(itemContent);
        if (imgEnclosure) {
          posterUrl = imgEnclosure[1].replace(/&amp;/g, '&');
        }
      }
      if (!posterUrl) {
        const desc = getTag('description');
        const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(desc);
        if (imgMatch) {
          posterUrl = imgMatch[1].replace(/&amp;/g, '&');
        }
      }
      if (posterUrl && !posterUrl.startsWith('http://') && !posterUrl.startsWith('https://')) {
        posterUrl = undefined;
      }

      const seasonAttr = getAttr('season');
      const season = seasonAttr ? parseInt(seasonAttr, 10) : undefined;
      const episodeAttr = getAttr('episode');
      const episode = episodeAttr ? parseInt(episodeAttr, 10) : undefined;
      const yearAttr = getAttr('year');
      const year = yearAttr || undefined;
      const resolutionAttr = getAttr('resolution');
      const resolution = resolutionAttr || undefined;

      // Create an obfuscated local ID for this download URL
      const id = crypto.createHash('sha256').update(downloadUrl || title).digest('hex').slice(0, 16);
      if (downloadUrl) {
        this.downloadUrlVault.set(id, downloadUrl);
      }

      results.push({
        id,
        title,
        size,
        pubDate,
        seeders,
        leechers,
        completed,
        categoryId,
        categoryName: this.mapCategoryName(categoryId),
        isFreeleech,
        infoHash,
        posterUrl,
        season,
        episode,
        year,
        resolution
      });
    }

    return results;
  }

  private mapCategoryName(catId?: string): string | undefined {
    if (!catId) return undefined;
    const primary = catId.split(',')[0].trim();
    switch (primary) {
      case '2000':
      case '2040':
      case '2050':
        return 'Films';
      case '5000':
      case '5030':
      case '5040':
        return 'Séries TV';
      case '2060':
      case '5070':
        return 'Anime';
      case '3000':
      case '3010':
      case '3020':
        return 'Musique';
      case '4000':
      case '4010':
      case '4050':
        return 'Jeux / App';
      case '7000':
      case '7020':
      case '7030':
        return 'Livres / BD';
      default:
        return undefined;
    }
  }

  /**
   * Fetch user profile with strict 60s cache (rate limit 30 req/min)
   */
  public async getUserProfile(): Promise<C411ProfileDTO> {
    if (!this.isEnabled()) {
      return { enabled: false };
    }

    const now = Date.now();
    if (this.profileCache && this.profileCache.expiresAt > now) {
      return this.profileCache.data;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/user/profile`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        // If 403 Forbidden (e.g. missing profile:read scope), return enabled: true without crashing
        const dto: C411ProfileDTO = { enabled: true };
        this.profileCache = { data: dto, expiresAt: now + 60 * 1000 };
        return dto;
      }

      const json = await response.json();
      const data = json.data || json;

      const dto: C411ProfileDTO = {
        enabled: true,
        username: data.username,
        avatarUrl: data.avatar,
        uploadedBytes: data.transfer?.uploaded?.total ?? data.uploaded,
        downloadedBytes: data.transfer?.downloaded?.total ?? data.downloaded,
        zenBalance: data.zen?.balance ?? data.zen,
        freeleechActive: Boolean(data.freeleech?.active ?? data.freeleech),
        downloadAllowed: data.download?.allowed ?? true
      };

      this.profileCache = { data: dto, expiresAt: now + 60 * 1000 };
      return dto;
    } catch {
      return { enabled: true };
    }
  }

  /**
   * Fetch .torrent binary by obfuscated ID
   */
  public async fetchTorrentBufferById(resultId: string): Promise<Buffer> {
    const downloadUrl = this.downloadUrlVault.get(resultId);
    if (!downloadUrl) {
      throw new Error(`Torrent ID '${resultId}' not found in vault or expired. Please search again.`);
    }

    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Prowlarr/1.0 Peerflix'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download .torrent from C411 (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
