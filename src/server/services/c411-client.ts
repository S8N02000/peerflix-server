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
    this.apiKey = (apiKey ?? process.env.C411_API_KEY ?? '7b8a16dd6db17a157ef129951886f781a39b431b821691d363ab769e9280111a').trim();
    this.baseUrl = (baseUrl ?? process.env.C411_BASE_URL ?? 'https://c411.org').replace(/\/$/, '').trim();
  }

  public isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Determine XXX category access policy from environment:
   * 'admin' (default), 'all', or 'none'
   */
  public getXxxAccessMode(): 'admin' | 'all' | 'none' {
    const raw = (process.env.C411_XXX_ACCESS || process.env.ENABLE_XXX || 'admin').trim().toLowerCase();
    if (raw === 'all' || raw === 'everyone' || raw === 'true' || raw === '1' || raw === 'yes') {
      return 'all';
    }
    if (raw === 'none' || raw === 'false' || raw === '0' || raw === 'no' || raw === 'disabled') {
      return 'none';
    }
    return 'admin';
  }

  /**
   * Search C411 native REST API (/api/torrents)
   */
  public async searchNative(params: {
    name?: string;
    category?: string;
    subcat?: string;
    resolution?: string;
    source?: string;
    codec?: string;
    audioType?: string;
    hdr?: string;
    lang?: string;
    subtitles?: string;
    year?: string;
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<C411SearchResultDTO[]> {
    if (!this.isEnabled()) {
      return [];
    }

    // Category 8 (XXX) is not served by C411 REST API, route directly to Torznab (cat 6000)
    if (params.category === '8' || params.category === '6000') {
      const torznabCat = params.subcat?.trim() || '6000';
      return this.searchTorznab(params.name || '', torznabCat);
    }

    const queryKey = JSON.stringify(params);
    const now = Date.now();
    const cached = this.searchCache.get(queryKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const url = new URL(`${this.baseUrl}/api/torrents`);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('page', String(params.page || 1));
    url.searchParams.set('perPage', String(params.perPage || 50));
    url.searchParams.set('sortBy', params.sortBy || 'createdAt');
    url.searchParams.set('sortOrder', params.sortOrder || 'desc');

    if (params.name?.trim()) url.searchParams.set('name', params.name.trim());
    if (params.category?.trim()) url.searchParams.set('category', params.category.trim());
    if (params.subcat?.trim()) url.searchParams.set('subcat', params.subcat.trim());
    if (params.resolution?.trim()) {
      const resVal = params.resolution.trim();
      url.searchParams.set('resolution', resVal.toLowerCase() === '4k' ? '2160p' : resVal);
    }
    if (params.source?.trim()) url.searchParams.set('source', params.source.trim());
    if (params.codec?.trim()) url.searchParams.set('codec', params.codec.trim());
    if (params.audioType?.trim()) url.searchParams.set('audioType', params.audioType.trim());
    if (params.hdr?.trim()) url.searchParams.set('hdr', params.hdr.trim());
    if (params.lang?.trim()) url.searchParams.set('lang', params.lang.trim());
    if (params.subtitles?.trim()) url.searchParams.set('subtitles', params.subtitles.trim());
    if (params.year?.trim()) url.searchParams.set('year', params.year.trim());

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Peerflix',
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`C411 API responded with HTTP ${response.status}`);
    }

    const json = await response.json();
    const items = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
    const results: C411SearchResultDTO[] = [];

    for (const item of items) {
      const infoHash = item.infoHash ? String(item.infoHash).toLowerCase() : undefined;
      const torrentId = item.id ? String(item.id) : undefined;
      const title = item.name || 'Sans titre';
      const size = Number(item.size) || 0;
      const pubDate = item.createdAt || new Date().toISOString();
      const seeders = Number(item.seeders) || 0;
      const leechers = Number(item.leechers) || 0;
      const completed = item.completions !== undefined ? Number(item.completions) : undefined;
      const isFreeleech = Boolean(item.isFreeleech);

      // Download URL using official endpoint: /api?t=get&id=<infoHash>&apikey=<key>
      const downloadUrl = infoHash
        ? `${this.baseUrl}/api?t=get&id=${infoHash}&apikey=${this.apiKey}`
        : `${this.baseUrl}/download/${torrentId || 'unknown'}?apikey=${this.apiKey}`;

      const id = crypto.createHash('sha256').update(infoHash || downloadUrl || title).digest('hex').slice(0, 16);
      this.downloadUrlVault.set(id, downloadUrl);

      // Media & Tech mapping
      const media = item.media || {};
      const tech = item.tech || {};

      const dto: C411SearchResultDTO = {
        id,
        title,
        size,
        pubDate,
        seeders,
        leechers,
        completed,
        categoryId: item.category?.id ? String(item.category.id) : undefined,
        categoryName: item.category?.name || this.mapCategoryName(item.category?.id ? String(item.category.id) : undefined),
        subcategoryId: item.subcategory?.id ? String(item.subcategory.id) : undefined,
        subcategoryName: item.subcategory?.name,
        isFreeleech,
        infoHash,
        posterUrl: item.posterUrl || (media.imageUrl ? `${this.baseUrl}${media.imageUrl}` : undefined),
        backdropUrl: media.backdropUrl,
        season: tech.season ?? undefined,
        episode: tech.episode ?? undefined,
        year: media.year ? String(media.year) : undefined,
        resolution: tech.resolution ?? undefined,
        source: tech.source ?? undefined,
        codec: tech.videoCodec ?? undefined,
        hdr: tech.hdrFormat ?? undefined,
        audio: tech.audioCodec ? `${tech.audioCodec} ${tech.audioChannels || ''}`.trim() : undefined,
        language: item.language ?? (Array.isArray(tech.languages) ? tech.languages.join(' ') : undefined),
        torrentId,
        commentsCount: item.comments !== undefined ? Number(item.comments) : undefined,
        description: item.description,
        overview: media.overview
      };

      this.torrentVault.set(id, {
        result: dto,
        downloadUrl,
        torrentId,
        commentsUrl: torrentId ? `${this.baseUrl}/torrents/${torrentId}#comments` : undefined,
        rawDescription: item.description
      });

      results.push(dto);
    }

    // Cache for 2 minutes
    this.searchCache.set(queryKey, {
      data: results,
      expiresAt: now + 2 * 60 * 1000
    });

    return results;
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
    const mappedCat = torznabCat.trim() === '8' ? '6000' : torznabCat.trim();
    if (mappedCat) {
      url.searchParams.set('cat', mappedCat);
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

      // Extract subcategory name for XXX or standard
      let subcategoryName: string | undefined;
      if (categoryId === '6010') subcategoryName = 'Films';
      else if (categoryId === '6070') subcategoryName = 'Hentai';
      else if (categoryId === '6050') subcategoryName = 'Ebooks';
      else if (categoryId === '6060') subcategoryName = 'Images';
      else if (categoryId === '6080') subcategoryName = 'Jeux';
      else if (categoryId === '6000') subcategoryName = 'VR';

      // Uploader and Exclusive flag if available
      const uploader = getTag('author') || getAttr('uploader') || undefined;
      const isExclusive = getAttr('exclusive') === '1' || getAttr('isExclusive') === 'true';

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
        subcategoryId: categoryId,
        subcategoryName,
        uploader,
        isExclusive,
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
      case '8':
      case '6000':
      case '6010':
      case '6050':
      case '6060':
      case '6070':
      case '6080':
        return 'XXX';
      default:
        return undefined;
    }
  }

  /**
   * Fetch rich torrent details (Description with images, installation guide, NFO, MediaInfo & comments)
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
    let mediaInfo: string | undefined;
    let backdropUrl = result.backdropUrl;
    let overview = result.overview;
    let rating: number | undefined;
    let directors: string[] | undefined;
    let cast: Array<{ name: string; character?: string }> | undefined;
    let genres: string[] | undefined;

    const c411PageUrl = torrentId ? `${this.baseUrl}/torrents/${torrentId}` : (result.infoHash ? `${this.baseUrl}/torrents/${result.infoHash}` : commentsUrl);

    // 1. Try native REST API if we have infoHash
    if (this.isEnabled() && result.infoHash && /^[a-fA-F0-9]{40}$/.test(result.infoHash)) {
      try {
        const detailsRes = await fetch(`${this.baseUrl}/api/torrents/${result.infoHash}?apikey=${this.apiKey}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Peerflix',
            Accept: 'application/json'
          },
          signal: AbortSignal.timeout(6000)
        });

        if (detailsRes.ok) {
          const contentType = detailsRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const detailData = await detailsRes.json();
            if (detailData.description) {
              descriptionHtml = this.formatDescriptionHtml(detailData.description);
            }
            if (detailData.metadata?.nfoContent) {
              nfo = detailData.metadata.nfoContent;
            } else if (detailData.nfo) {
              nfo = detailData.nfo;
            }

            const tmdb = detailData.metadata?.tmdbData;
            if (tmdb) {
              if (tmdb.backdrop_path && !backdropUrl) {
                backdropUrl = `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}`;
              }
              if (tmdb.overview && !overview) {
                overview = tmdb.overview;
              }
              if (tmdb.vote_average) {
                rating = Number(tmdb.vote_average);
              }
              if (Array.isArray(tmdb.genres)) {
                genres = tmdb.genres.map((g: any) => g.name || String(g));
              }
              if (Array.isArray(tmdb.credits?.cast)) {
                cast = tmdb.credits.cast.slice(0, 8).map((c: any) => ({ name: c.name, character: c.character }));
              }
              if (Array.isArray(tmdb.credits?.crew)) {
                directors = tmdb.credits.crew.filter((c: any) => c.job === 'Director').map((c: any) => c.name);
              }
            }
          } else {
            // HTML response
            const html = await detailsRes.text();
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
        // Fallback silently
      }

      // 2. Fetch comments from native API
      try {
        const commentsRes = await fetch(`${this.baseUrl}/api/torrents/${result.infoHash}/comments?apikey=${this.apiKey}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Peerflix',
            Accept: 'application/json'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (commentsRes.ok) {
          const commentsJson = await commentsRes.json();
          const list = Array.isArray(commentsJson.data) ? commentsJson.data : (Array.isArray(commentsJson) ? commentsJson : []);
          comments = list.map((c: any) => {
            const rawContent = c.content || c.text || '';
            const cleanContent = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const authorObj = c.author || c.user || {};
            const author = typeof authorObj === 'string' ? authorObj : (authorObj.username || authorObj.name || 'Membre C411');
            const avatar = typeof authorObj === 'object' && authorObj.avatar ? authorObj.avatar : undefined;

            return {
              id: String(c.id || ''),
              author,
              avatarUrl: avatar,
              date: c.createdAt || c.created_at || c.date || '',
              content: cleanContent || rawContent,
              likeCount: Number(c.likeCount || 0)
            };
          });
        }
      } catch {
        // Fallback silently
      }
    }

    // 3. Fallback to scraping if description is still empty or minimal
    if (!descriptionHtml || descriptionHtml.length < 50) {
      if (this.isEnabled() && (torrentId || c411PageUrl)) {
        const targetUrl = torrentId ? `${this.baseUrl}/torrents/${torrentId}` : c411PageUrl!;
        try {
          const response = await fetch(targetUrl, {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Peerflix',
              Accept: 'text/html,application/xhtml+xml,application/json'
            },
            signal: AbortSignal.timeout(5000)
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
            } else {
              const html = await response.text();
              const parsed = this.parseC411HtmlPage(html);
              if (parsed.descriptionHtml) {
                descriptionHtml = this.formatDescriptionHtml(parsed.descriptionHtml);
              }
              if (parsed.nfo) {
                nfo = parsed.nfo;
              }
              if (parsed.comments && parsed.comments.length > 0 && comments.length === 0) {
                comments = parsed.comments;
              }
            }
          }
        } catch {
          // Fallback silently
        }
      }
    }

    return {
      id: result.id,
      torrentId,
      infoHash: result.infoHash,
      title: result.title,
      cleanTitle: result.title,
      categoryName: result.categoryName,
      subcategoryName: result.subcategoryName,
      size: result.size,
      pubDate: result.pubDate,
      seeders: result.seeders,
      leechers: result.leechers,
      isFreeleech: result.isFreeleech,
      posterUrl: result.posterUrl,
      backdropUrl,
      overview,
      rating,
      directors,
      cast,
      genres,
      descriptionHtml,
      nfo,
      mediaInfo,
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
    const xxxAccess = this.getXxxAccessMode();
    if (!this.isEnabled()) {
      return { enabled: false, xxxAccess };
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
        const dto: C411ProfileDTO = { enabled: true, xxxAccess };
        this.profileCache = { data: dto, expiresAt: now + 60 * 1000 };
        return dto;
      }

      const json = await response.json();
      const data = json.data || json;

      const dto: C411ProfileDTO = {
        enabled: true,
        xxxAccess,
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
      return { enabled: true, xxxAccess };
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
