import crypto from 'node:crypto';
import type { C411SearchResultDTO, C411ProfileDTO, C411TorrentDetailsDTO, C411CommentDTO } from '../../shared/types.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface TorrentVaultItem {
  result: C411SearchResultDTO;
  downloadUrl: string;
  commentsUrl?: string;
  torrentId?: string;
  rawDescription?: string;
}

export class C411Client {
  private apiKey: string;
  private baseUrl: string;
  private downloadUrlVault = new Map<string, string>(); // id -> full download url with apikey
  private torrentVault = new Map<string, TorrentVaultItem>(); // id -> full item data
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
      const rawDesc = getTag('description');
      const commentsUrl = getTag('comments').replace(/&amp;/g, '&');
      const guid = getTag('guid').replace(/&amp;/g, '&');

      // Download URL: enclosure url or link
      let downloadUrl = '';
      const enclosureMatch = /<enclosure[^>]*url=["']([^"']+)["']/i.exec(itemContent);
      if (enclosureMatch) {
        downloadUrl = enclosureMatch[1].replace(/&amp;/g, '&');
      } else {
        downloadUrl = getTag('link').replace(/&amp;/g, '&');
      }

      // Extract numeric torrent ID from commentsUrl, downloadUrl or guid
      let torrentId: string | undefined;
      const idMatch =
        (commentsUrl || '').match(/(?:torrents?|download)\/(\d+)/i) ||
        downloadUrl.match(/(?:torrents?|download)\/(\d+)/i) ||
        guid.match(/(?:torrents?|download)\/(\d+)/i) ||
        guid.match(/^(\d+)$/);
      if (idMatch) {
        torrentId = idMatch[1];
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
        const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(rawDesc);
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

      const dto: C411SearchResultDTO = {
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
        resolution,
        torrentId,
        description: rawDesc
      };

      this.torrentVault.set(id, {
        result: dto,
        downloadUrl,
        commentsUrl,
        torrentId,
        rawDescription: rawDesc
      });

      results.push(dto);
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
   * Fetch rich torrent details (Description with images, installation guide, NFO & comments)
   */
  public async getTorrentDetails(id: string): Promise<C411TorrentDetailsDTO> {
    const item = this.torrentVault.get(id);
    if (!item) {
      throw new Error(`Torrent ID '${id}' introuvable ou expiré. Veuillez relancer la recherche.`);
    }

    const { result, commentsUrl, torrentId, rawDescription } = item;
    let descriptionHtml = this.formatDescriptionHtml(rawDescription || '');
    let comments: C411CommentDTO[] = [];
    let nfo: string | undefined;

    const c411PageUrl = commentsUrl || (torrentId ? `${this.baseUrl}/torrents/${torrentId}` : undefined);

    // Attempt online page fetch from C411 to extract full HTML description and user comments
    if (this.isEnabled() && (torrentId || c411PageUrl)) {
      const targetUrl = torrentId ? `${this.baseUrl}/torrents/${torrentId}` : c411PageUrl!;
      try {
        const response = await fetch(targetUrl, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Peerflix',
            Accept: 'text/html,application/xhtml+xml,application/json'
          },
          signal: AbortSignal.timeout(6000)
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await response.json();
            const data = json.data || json;
            if (data.description) {
              descriptionHtml = this.formatDescriptionHtml(data.description);
            }
            if (data.nfo) {
              nfo = data.nfo;
            }
            if (Array.isArray(data.comments)) {
              comments = data.comments.map((c: any) => ({
                id: String(c.id || ''),
                author: c.username || c.user?.username || c.author || 'Membre C411',
                avatarUrl: c.avatar || c.user?.avatar,
                date: c.created_at || c.date || '',
                content: c.content || c.text || c.comment || ''
              }));
            }
          } else {
            // HTML page scraping
            const html = await response.text();
            const parsed = this.parseC411HtmlPage(html);
            if (parsed.descriptionHtml) {
              descriptionHtml = this.formatDescriptionHtml(parsed.descriptionHtml);
            }
            if (parsed.nfo) {
              nfo = parsed.nfo;
            }
            if (parsed.comments && parsed.comments.length > 0) {
              comments = parsed.comments;
            }
          }
        }
      } catch {
        // Fallback silently to Torznab cached description
      }
    }

    return {
      id: result.id,
      torrentId,
      title: result.title,
      cleanTitle: result.title,
      categoryName: result.categoryName,
      size: result.size,
      pubDate: result.pubDate,
      seeders: result.seeders,
      leechers: result.leechers,
      isFreeleech: result.isFreeleech,
      posterUrl: result.posterUrl,
      descriptionHtml,
      nfo,
      comments,
      c411PageUrl
    };
  }

  /**
   * Parse C411 HTML page to extract description, NFO, and user comments
   */
  public parseC411HtmlPage(html: string): {
    descriptionHtml?: string;
    nfo?: string;
    comments: C411CommentDTO[];
  } {
    let descriptionHtml: string | undefined;
    let nfo: string | undefined;
    const comments: C411CommentDTO[] = [];

    // 1. Extract Description block (common C411 / Unit3D / torrent tracker container classes)
    const descRegexes = [
      /<div[^>]*class=["'][^"']*(?:torrent-description|torrent__description|panel-body|description|bbcode|torrent-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*id=["'](?:description|torrent-description)["'][^>]*>([\s\S]*?)<\/div>/i
    ];

    for (const r of descRegexes) {
      const m = r.exec(html);
      if (m && m[1] && m[1].trim().length > 50) {
        descriptionHtml = m[1].trim();
        break;
      }
    }

    // 2. Extract NFO if enclosed in <pre> or .nfo
    const nfoMatch = /<pre[^>]*class=["'][^"']*nfo[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i.exec(html) ||
                     /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
    if (nfoMatch && nfoMatch[1]) {
      nfo = nfoMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // 3. Extract Comments
    // Split by comment card start tags to cleanly handle nested divs inside comments
    const commentBlocks = html.split(/<div[^>]*class=["'][^"']*(?:\bcomment\b(?!-)|comment-card|comment-item|message-item|torrent-comment)[^"']*["'][^>]*>/i).slice(1);

    for (const rawBlock of commentBlocks) {
      const block = rawBlock.slice(0, 3000);
      // Skip if this block is just a comment input form
      if (block.includes('<textarea') || block.includes('form-comment') || block.includes('id="comment-form"')) continue;

      // Extract author
      const authorMatch = /<a[^>]*class=["'][^"']*(?:username|author|user)[^"']*["'][^>]*>([^<]+)<\/a>/i.exec(block) ||
                          /<strong[^>]*>([^<]+)<\/strong>/i.exec(block) ||
                          /<span[^>]*class=["'][^"']*(?:username|author)[^"']*["'][^>]*>([^<]+)<\/span>/i.exec(block);
      const author = authorMatch ? authorMatch[1].trim() : 'Membre C411';

      // Extract avatar
      const avatarMatch = /<img[^>]*class=["'][^"']*(?:avatar|user-avatar)[^"']*["'][^>]*src=["']([^"']+)["']/i.exec(block) ||
                          /<img[^>]*src=["']([^"']*(?:avatars|profile)[^"']*)["']/i.exec(block);
      const avatarUrl = avatarMatch ? avatarMatch[1] : undefined;

      // Extract date
      const dateMatch = /<time[^>]*>([^<]+)<\/time>/i.exec(block) ||
                        /<span[^>]*class=["'][^"']*(?:date|time)[^"']*["'][^>]*>([^<]+)<\/span>/i.exec(block);
      const date = dateMatch ? dateMatch[1].trim() : '';

      // Extract content
      const contentMatch = /<div[^>]*class=["'][^"']*(?:comment-body|comment-text|content|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(block) ||
                           /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
      const content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

      if (content && content.length > 2) {
        comments.push({
          author,
          avatarUrl,
          date,
          content
        });
      }
    }

    return {
      descriptionHtml,
      nfo,
      comments
    };
  }

  /**
   * Clean and format raw description (converting BBCode if needed, resolving relative URLs, sanitizing dangerous tags)
   */
  public formatDescriptionHtml(raw: string): string {
    if (!raw) return '<p class="text-muted">Aucune description disponible pour ce torrent.</p>';

    let html = raw;

    // Convert basic BBCode to HTML if BBCode is detected
    if (html.includes('[img]') || html.includes('[b]') || html.includes('[center]')) {
      html = html
        .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div style="text-align: center;">$1</div>')
        .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
        .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
        .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
        .replace(/\[img\]([^\[]+)\[\/img\]/gi, '<img src="$1" alt="image" style="max-width: 100%; border-radius: 6px; margin: 8px auto; display: block;" loading="lazy" />')
        .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>')
        .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="c411-quote">$1</blockquote>')
        .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre class="c411-code">$1</pre>')
        .replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, '<span style="color: $1;">$2</span>')
        .replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi, '<span style="font-size: $1;">$2</span>')
        .replace(/\n/g, '<br />');
    }

    // Strip dangerous tags (XSS protection)
    html = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '');

    // Resolve relative image URLs against C411 baseUrl
    html = html.replace(/<img([^>]+)src=["']\/(?!\/)([^"']+)["']/gi, `<img$1src="${this.baseUrl}/$2"`);

    // Ensure all <a> tags open securely in new tab
    html = html.replace(/<a\b(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer"');

    return html;
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
