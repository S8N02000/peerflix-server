export interface ReleaseBadge {
  type: 'lang' | 'res' | 'source' | 'hdr' | 'audio' | 'codec' | 'team' | 'other';
  label: string;
  color: string; // Hex color code
}

export interface ReleaseMetadata {
  cleanTitle: string;
  year?: string;
  season?: number;
  episode?: number;
  seasonEpisodeLabel?: string;
  resolution?: string;
  language?: string;
  subtitles?: string;
  source?: string;
  hdr?: string;
  audio?: string;
  codec?: string;
  team?: string;
  subCat?: string;
  badges: ReleaseBadge[];
}

export function parseReleaseMetadata(rawTitle: string): ReleaseMetadata {
  let title = rawTitle.replace(/\.(mkv|mp4|avi|iso|zip|rar|tar|gz)$/i, '');

  const badges: ReleaseBadge[] = [];

  // 1. Team extraction (e.g., -HYPERION at the end)
  let team: string | undefined;
  const teamMatch = title.match(/-([A-Za-z0-9_]+)$/);
  if (teamMatch) {
    team = teamMatch[1];
    title = title.substring(0, teamMatch.index);
  }

  // 2. Season and Episode extraction (e.g. S02E02, S02, Saison 2)
  let season: number | undefined;
  let episode: number | undefined;
  let seasonEpisodeLabel: string | undefined;

  const sxxExxMatch = rawTitle.match(/[ ._(-]S(\d{1,2})(?:E(\d{1,3}))?[ ._)-]/i);
  if (sxxExxMatch) {
    season = parseInt(sxxExxMatch[1], 10);
    if (sxxExxMatch[2]) {
      episode = parseInt(sxxExxMatch[2], 10);
      seasonEpisodeLabel = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
    } else {
      seasonEpisodeLabel = `S${String(season).padStart(2, '0')}`;
    }
  } else {
    const seasonFrMatch = rawTitle.match(/[ ._(-]Saison[ ._-]?(\d{1,2})[ ._)-]/i);
    if (seasonFrMatch) {
      season = parseInt(seasonFrMatch[1], 10);
      seasonEpisodeLabel = `S${String(season).padStart(2, '0')}`;
    }
  }

  // 3. Year extraction (e.g. 19xx or 20xx)
  let year: string | undefined;
  const yearMatch = title.match(/[ ._(-](19\d{2}|20\d{2})[ ._)-]/);
  if (yearMatch && yearMatch.index !== undefined) {
    year = yearMatch[1];
    // Clean title before year
    const beforeYear = title.substring(0, yearMatch.index).replace(/[._]/g, ' ').trim();
    if (beforeYear.length > 0) {
      title = beforeYear;
    }
  } else {
    // Check for TV show Season/Episode patterns like S01E02 or S01
    const sxxMatch = title.match(/[ ._-](S\d+(?:E\d+)?(?:[ ._-]E\d+)?)/i);
    if (sxxMatch && sxxMatch.index !== undefined) {
      const matchEnd = sxxMatch.index + sxxMatch[0].length;
      title = title.substring(0, matchEnd).replace(/[._]/g, ' ').trim();
    } else {
      // Check for first technical keyword separator
      const tagMatch = title.match(/[ ._-](MULTI|TRUEFRENCH|VFQ|VFF|VOSTFR|FRENCH|2160p|1080p|720p|WEB-DL|WEBRip|BluRay|Remux|HDTV|HEVC|AV1|H\.?264|H\.?265)/i);
      if (tagMatch && tagMatch.index !== undefined) {
        title = title.substring(0, tagMatch.index).replace(/[._]/g, ' ').trim();
      }
    }
  }

  const rawLower = rawTitle.toLowerCase();

  // 4. Language badges & string value (Emerald Green #10b981)
  let language: string | undefined;
  if (rawLower.includes('multi.vfq') || (rawLower.includes('multi') && rawLower.includes('vfq'))) {
    language = 'MULTI VFQ';
    badges.push({ type: 'lang', label: 'MULTI VFQ', color: '#10b981' });
  } else if (rawLower.includes('multi.vff') || (rawLower.includes('multi') && rawLower.includes('vff'))) {
    language = 'MULTI VFF';
    badges.push({ type: 'lang', label: 'MULTI VFF', color: '#10b981' });
  } else if (rawLower.includes('multi')) {
    language = 'MULTI';
    badges.push({ type: 'lang', label: 'MULTI', color: '#10b981' });
  } else if (rawLower.includes('truefrench')) {
    language = 'TRUEFRENCH';
    badges.push({ type: 'lang', label: 'TRUEFRENCH', color: '#10b981' });
  } else if (rawLower.includes('vfq')) {
    language = 'VFQ';
    badges.push({ type: 'lang', label: 'VFQ', color: '#10b981' });
  } else if (rawLower.includes('vff') || rawLower.includes('french')) {
    language = 'VFF';
    badges.push({ type: 'lang', label: 'VFF', color: '#10b981' });
  } else if (rawLower.includes('vostfr')) {
    language = 'VOSTFR';
    badges.push({ type: 'lang', label: 'VOSTFR', color: '#10b981' });
  }

  // 5. Resolution badges & string value (Purple #a855f7)
  let resolution: string | undefined;
  if (rawLower.includes('2160p') || rawLower.includes('4k') || rawLower.includes('uhd')) {
    resolution = '2160p';
    badges.push({ type: 'res', label: '2160p', color: '#a855f7' });
  } else if (rawLower.includes('1080p') || rawLower.includes('1080i')) {
    resolution = '1080p';
    badges.push({ type: 'res', label: '1080p', color: '#a855f7' });
  } else if (rawLower.includes('720p')) {
    resolution = '720p';
    badges.push({ type: 'res', label: '720p', color: '#a855f7' });
  } else if (rawLower.includes('576p') || rawLower.includes('480p') || rawLower.includes('dvdrip')) {
    resolution = 'SD';
    badges.push({ type: 'res', label: 'SD', color: '#a855f7' });
  }

  // 6. Source badges & string value (Cyan/Blue #06b6d4)
  let source: string | undefined;
  if (rawLower.includes('remux')) {
    source = 'Remux';
    badges.push({ type: 'source', label: 'Remux', color: '#06b6d4' });
  } else if (rawLower.includes('bluray') || rawLower.includes('blu-ray') || rawLower.includes('bdrip')) {
    source = 'BluRay';
    badges.push({ type: 'source', label: 'BluRay', color: '#06b6d4' });
  } else if (rawLower.includes('web-dl') || rawLower.includes('webdl')) {
    source = 'WEB-DL';
    badges.push({ type: 'source', label: 'WEB-DL', color: '#06b6d4' });
  } else if (rawLower.includes('webrip') || rawLower.includes('web')) {
    source = 'WEBRip';
    badges.push({ type: 'source', label: 'WEBRip', color: '#06b6d4' });
  } else if (rawLower.includes('hdtv')) {
    source = 'HDTV';
    badges.push({ type: 'source', label: 'HDTV', color: '#06b6d4' });
  }

  // 7. HDR badges & string value (Pink/Magenta #ec4899)
  let hdr: string | undefined;
  if (rawLower.includes('dv') && (rawLower.includes('hdr10+') || rawLower.includes('hdr10plus'))) {
    hdr = 'DV HDR10+';
    badges.push({ type: 'hdr', label: 'DV HDR10+', color: '#ec4899' });
  } else if (rawLower.includes('dv') && rawLower.includes('hdr')) {
    hdr = 'DV HDR';
    badges.push({ type: 'hdr', label: 'DV HDR', color: '#ec4899' });
  } else if (rawLower.includes('dovi') || rawLower.includes('dolby.vision') || rawLower.includes('dolby vision')) {
    hdr = 'Dolby Vision';
    badges.push({ type: 'hdr', label: 'Dolby Vision', color: '#ec4899' });
  } else if (rawLower.includes('hdr10+') || rawLower.includes('hdr10plus')) {
    hdr = 'HDR10+';
    badges.push({ type: 'hdr', label: 'HDR10+', color: '#ec4899' });
  } else if (rawLower.includes('hdr10') || rawLower.includes('hdr')) {
    hdr = 'HDR10';
    badges.push({ type: 'hdr', label: 'HDR10', color: '#ec4899' });
  }

  // 8. Audio badges & string value (Amber Orange #f59e0b)
  let audio: string | undefined;
  if (rawLower.includes('dts-hd.ma') || rawLower.includes('dts-hd ma') || rawLower.includes('dts-hd')) {
    const ch = rawLower.includes('7.1') ? '7.1' : rawLower.includes('5.1') ? '5.1' : '';
    audio = `DTS-HD MA ${ch}`.trim();
    badges.push({ type: 'audio', label: audio, color: '#f59e0b' });
  } else if (rawLower.includes('truehd')) {
    audio = rawLower.includes('atmos') ? 'TrueHD Atmos' : 'TrueHD';
    badges.push({ type: 'audio', label: audio, color: '#f59e0b' });
  } else if (rawLower.includes('eac3') || rawLower.includes('dnp') || rawLower.includes('ddp')) {
    audio = rawLower.includes('atmos') ? 'E-AC3 Atmos' : 'E-AC3';
    badges.push({ type: 'audio', label: audio, color: '#f59e0b' });
  } else if (rawLower.includes('ac3') || rawLower.includes('dd5.1')) {
    audio = 'AC3 5.1';
    badges.push({ type: 'audio', label: 'AC3 5.1', color: '#f59e0b' });
  } else if (rawLower.includes('flac')) {
    audio = 'FLAC';
    badges.push({ type: 'audio', label: 'FLAC', color: '#f59e0b' });
  } else if (rawLower.includes('aac')) {
    audio = 'AAC';
    badges.push({ type: 'audio', label: 'AAC', color: '#f59e0b' });
  }

  // 9. Video Codec badges & string value (Slate Grey #94a3b8)
  let codec: string | undefined;
  if (rawLower.includes('hevc') || rawLower.includes('h.265') || rawLower.includes('x265') || rawLower.includes('h265')) {
    codec = 'HEVC';
    badges.push({ type: 'codec', label: 'HEVC', color: '#94a3b8' });
  } else if (rawLower.includes('av1')) {
    codec = 'AV1';
    badges.push({ type: 'codec', label: 'AV1', color: '#94a3b8' });
  } else if (rawLower.includes('x264') || rawLower.includes('h.264') || rawLower.includes('h264') || rawLower.includes('avc')) {
    codec = 'H.264';
    badges.push({ type: 'codec', label: 'H.264', color: '#94a3b8' });
  }

  // 10. Subtitles extraction
  let subtitles: string | undefined;
  if (rawLower.includes('vostfr') || rawLower.includes('subfrench') || rawLower.includes('stfr')) {
    subtitles = 'VOSTFR';
  } else if (rawLower.includes('forced') || rawLower.includes('forces')) {
    subtitles = 'Forcés';
  } else if (rawLower.includes('multisub') || (rawLower.includes('multi') && rawLower.includes('sub'))) {
    subtitles = 'Multi';
  } else if (language?.includes('MULTI')) {
    subtitles = 'Multi / FR';
  }

  // 11. Sub-category auto-detection
  let subCat: string | undefined;
  if (season !== undefined || rawLower.includes('season') || rawLower.includes('saison')) {
    subCat = 'Séries TV';
  } else if (rawLower.includes('anime') || rawLower.includes('manga')) {
    subCat = 'Anime';
  } else if (rawLower.includes('docu') || rawLower.includes('documentary') || rawLower.includes('documentaire')) {
    subCat = 'Documentaires';
  } else if (rawLower.includes('spectacle') || rawLower.includes('concert')) {
    subCat = 'Spectacles';
  }

  // 12. Team badge (Gold #eab308)
  if (team) {
    badges.push({ type: 'team', label: team, color: '#eab308' });
  }

  // Clean title representation
  let cleanTitle = title.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanTitle) {
    cleanTitle = rawTitle;
  }

  return {
    cleanTitle,
    year,
    season,
    episode,
    seasonEpisodeLabel,
    resolution,
    language,
    subtitles,
    source,
    hdr,
    audio,
    codec,
    team,
    subCat,
    badges
  };
}

