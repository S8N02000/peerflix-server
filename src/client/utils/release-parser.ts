export interface ReleaseBadge {
  type: 'lang' | 'res' | 'source' | 'hdr' | 'audio' | 'codec' | 'team' | 'other';
  label: string;
  color: string; // Hex color code
}

export interface ReleaseMetadata {
  cleanTitle: string;
  year?: string;
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

  // 2. Year extraction (e.g. 19xx or 20xx)
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

  // 3. Language badges (Emerald Green #10b981)
  if (rawLower.includes('multi.vfq') || (rawLower.includes('multi') && rawLower.includes('vfq'))) {
    badges.push({ type: 'lang', label: 'MULTI VFQ', color: '#10b981' });
  } else if (rawLower.includes('multi.vff') || (rawLower.includes('multi') && rawLower.includes('vff'))) {
    badges.push({ type: 'lang', label: 'MULTI VFF', color: '#10b981' });
  } else if (rawLower.includes('multi')) {
    badges.push({ type: 'lang', label: 'MULTI', color: '#10b981' });
  } else if (rawLower.includes('truefrench')) {
    badges.push({ type: 'lang', label: 'TRUEFRENCH', color: '#10b981' });
  } else if (rawLower.includes('vfq')) {
    badges.push({ type: 'lang', label: 'VFQ', color: '#10b981' });
  } else if (rawLower.includes('vff') || rawLower.includes('french')) {
    badges.push({ type: 'lang', label: 'VFF', color: '#10b981' });
  } else if (rawLower.includes('vostfr')) {
    badges.push({ type: 'lang', label: 'VOSTFR', color: '#10b981' });
  }

  // 4. Resolution badges (Purple #a855f7)
  if (rawLower.includes('2160p') || rawLower.includes('4k') || rawLower.includes('uhd')) {
    badges.push({ type: 'res', label: '2160p', color: '#a855f7' });
  } else if (rawLower.includes('1080p') || rawLower.includes('1080i')) {
    badges.push({ type: 'res', label: '1080p', color: '#a855f7' });
  } else if (rawLower.includes('720p')) {
    badges.push({ type: 'res', label: '720p', color: '#a855f7' });
  }

  // 5. Source badges (Cyan/Blue #06b6d4)
  if (rawLower.includes('remux')) {
    badges.push({ type: 'source', label: 'Remux', color: '#06b6d4' });
  } else if (rawLower.includes('bluray') || rawLower.includes('blu-ray') || rawLower.includes('bdrip')) {
    badges.push({ type: 'source', label: 'BluRay', color: '#06b6d4' });
  } else if (rawLower.includes('web-dl') || rawLower.includes('webdl')) {
    badges.push({ type: 'source', label: 'WEB-DL', color: '#06b6d4' });
  } else if (rawLower.includes('webrip') || rawLower.includes('web')) {
    badges.push({ type: 'source', label: 'WEBRip', color: '#06b6d4' });
  } else if (rawLower.includes('hdtv')) {
    badges.push({ type: 'source', label: 'HDTV', color: '#06b6d4' });
  }

  // 6. HDR badges (Pink/Magenta #ec4899)
  if (rawLower.includes('dv') && (rawLower.includes('hdr10+') || rawLower.includes('hdr10plus'))) {
    badges.push({ type: 'hdr', label: 'DV HDR10+', color: '#ec4899' });
  } else if (rawLower.includes('dv') && rawLower.includes('hdr')) {
    badges.push({ type: 'hdr', label: 'DV HDR', color: '#ec4899' });
  } else if (rawLower.includes('dovi') || rawLower.includes('dolby.vision') || rawLower.includes('dolby vision')) {
    badges.push({ type: 'hdr', label: 'Dolby Vision', color: '#ec4899' });
  } else if (rawLower.includes('hdr10+') || rawLower.includes('hdr10plus')) {
    badges.push({ type: 'hdr', label: 'HDR10+', color: '#ec4899' });
  } else if (rawLower.includes('hdr10') || rawLower.includes('hdr')) {
    badges.push({ type: 'hdr', label: 'HDR10', color: '#ec4899' });
  }

  // 7. Audio badges (Amber Orange #f59e0b)
  if (rawLower.includes('dts-hd.ma') || rawLower.includes('dts-hd ma') || rawLower.includes('dts-hd')) {
    const ch = rawLower.includes('7.1') ? '7.1' : rawLower.includes('5.1') ? '5.1' : '';
    badges.push({ type: 'audio', label: `DTS-HD MA ${ch}`.trim(), color: '#f59e0b' });
  } else if (rawLower.includes('truehd')) {
    badges.push({ type: 'audio', label: rawLower.includes('atmos') ? 'TrueHD Atmos' : 'TrueHD', color: '#f59e0b' });
  } else if (rawLower.includes('eac3') || rawLower.includes('dnp') || rawLower.includes('ddp')) {
    badges.push({ type: 'audio', label: 'E-AC3', color: '#f59e0b' });
  } else if (rawLower.includes('ac3') || rawLower.includes('dd5.1')) {
    badges.push({ type: 'audio', label: 'AC3 5.1', color: '#f59e0b' });
  } else if (rawLower.includes('flac')) {
    badges.push({ type: 'audio', label: 'FLAC', color: '#f59e0b' });
  } else if (rawLower.includes('aac')) {
    badges.push({ type: 'audio', label: 'AAC', color: '#f59e0b' });
  }

  // 8. Video Codec badges (Slate Grey #94a3b8)
  if (rawLower.includes('hevc') || rawLower.includes('h.265') || rawLower.includes('x265') || rawLower.includes('h265')) {
    badges.push({ type: 'codec', label: 'HEVC', color: '#94a3b8' });
  } else if (rawLower.includes('av1')) {
    badges.push({ type: 'codec', label: 'AV1', color: '#94a3b8' });
  } else if (rawLower.includes('x264') || rawLower.includes('h.264') || rawLower.includes('h264') || rawLower.includes('avc')) {
    badges.push({ type: 'codec', label: 'H.264', color: '#94a3b8' });
  }

  // 9. Team badge (Gold #eab308)
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
    badges
  };
}
