import { classifyFile } from '../services/classifier.js';

export interface M3UEntryInfo {
  streamUrl: string;
  cleanName: string;
  groupTitle: string;
  isSeries: boolean;
  isAudio: boolean;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  rawM3uSnippet: string;
}

/**
 * Nettoie une chaîne de titre brute en retirant les tags de release fréquents
 */
export function cleanRawTitle(raw: string): string {
  let title = raw
    .replace(/\.(mkv|mp4|avi|mov|webm|ts|flv|iso|zip|rar)$/i, '')
    .replace(/[-._]/g, ' ')
    .trim();

  // Supprimer les signatures de team à la fin (ex: -FRiTCHi571, -QTZ, -PANDASA)
  title = title.replace(/-[A-Za-z0-9_]+$/, '').trim();

  // Supprimer les tags de qualité / codecs / langues fréquents
  const techRegex = /\b(2160p|1080p|720p|4k|4klight|uhd|bluray|rip|webrip|web-dl|webdl|hdtv|remux|dvdrip|x264|x265|hevc|h264|h265|av1|10bit|10bits|hdr|hdr10|hdr10plus|dv|dolby\s*vision|atmos|ddp\s*5\.?1|ac3|dts|eac3|aac|vostfr|multi|vff|vfi|vfq|truefrench|french|subfrench|stfr|final)\b.*$/i;
  
  title = title.replace(techRegex, '').trim();
  return title.replace(/\s+/g, ' ').trim();
}

/**
 * Extrait le nom propre de la série à partir du nom du torrent et du fichier
 */
export function extractSeriesInfo(torrentName: string, fileName: string): {
  seriesTitle: string;
  season?: number;
  episode?: number;
  cleanEpisodeTitle: string;
} {
  const combined = `${torrentName} ${fileName}`;

  // Détection Saison & Épisode (ex: S01E02, S1E2, Saison 1 Épisode 2)
  let season: number | undefined;
  let episode: number | undefined;

  // 1. Chercher d'abord dans fileName qui est le plus précis pour l'épisode
  const fileSxxExxMatch = fileName.match(/[ ._(-]S(\d{1,2})(?:[ ._-]?E(\d{1,3}))?[ ._)-]/i);
  if (fileSxxExxMatch) {
    season = parseInt(fileSxxExxMatch[1], 10);
    if (fileSxxExxMatch[2]) {
      episode = parseInt(fileSxxExxMatch[2], 10);
    }
  }

  // 2. Si pas trouvé dans fileName, chercher dans torrentName
  if (season === undefined) {
    const torrentSxxMatch = torrentName.match(/[ ._(-]S(\d{1,2})(?:[ ._-]?E(\d{1,3}))?[ ._)-]/i);
    if (torrentSxxMatch) {
      season = parseInt(torrentSxxMatch[1], 10);
      if (torrentSxxMatch[2] && episode === undefined) {
        episode = parseInt(torrentSxxMatch[2], 10);
      }
    }
  }

  // 3. Si l'épisode n'est toujours pas identifié, chercher des variantes dans fileName (E01, EP01, 1x02, etc.)
  if (episode === undefined) {
    const epMatch = fileName.match(/\b(?:e|ep|episode)[ ._-]?(\d{1,3})\b/i) || fileName.match(/\b(\d{1,2})x(\d{1,3})\b/i);
    if (epMatch) {
      if (epMatch[2]) {
        season = season ?? parseInt(epMatch[1], 10);
        episode = parseInt(epMatch[2], 10);
      } else {
        episode = parseInt(epMatch[1], 10);
      }
    } else {
      // Cas simple : fichier qui commence ou se termine par un numéro d'épisode (ex: "01.mkv" ou "Made in Abyss - 02.mkv")
      const numMatch = fileName.replace(/\.[a-zA-Z0-9]+$/, '').match(/(?:[-._\s]|^)(\d{1,3})$/);
      if (numMatch) {
        episode = parseInt(numMatch[1], 10);
      }
    }
  }

  // 4. Si pas de saison trouvée, chercher "Saison X" ou "Season X" dans combined
  if (season === undefined) {
    const sMatch = combined.match(/[ ._(-](?:saison|season)[ ._-]?(\d{1,2})[ ._)-]/i);
    if (sMatch) {
      season = parseInt(sMatch[1], 10);
    }
  }

  // Extraire le titre de base de la série
  // Enlever la partie S01 / Saison etc. du torrentName
  let baseShow = torrentName
    .replace(/\.(mkv|mp4|avi|mov|webm|ts)$/i, '')
    .replace(/[ ._(-]S\d+.*$/i, '')
    .replace(/[ ._(-](?:saison|season)\s*\d+.*$/i, '')
    .replace(/[ ._(-](19\d{2}|20\d{2})[ ._)-].*$/i, '') // enlever l'année et ce qui suit
    .replace(/[-._]/g, ' ')
    .trim();

  // Nettoyage des tags techniques
  baseShow = cleanRawTitle(baseShow);

  if (!baseShow || baseShow.length < 2) {
    baseShow = cleanRawTitle(torrentName);
  }

  // Normaliser le nom de la série
  const seriesTitle = baseShow;

  // Formater le titre d'affichage propre
  const seasonPad = season !== undefined ? `S${String(season).padStart(2, '0')}` : '';
  const episodePad = episode !== undefined ? `E${String(episode).padStart(2, '0')}` : '';
  const seLabel = seasonPad || episodePad ? `${seasonPad}${episodePad}`.trim() : '';

  let cleanEpisodeTitle = '';
  if (seLabel) {
    cleanEpisodeTitle = `${seriesTitle} - ${seLabel}`;
  } else {
    cleanEpisodeTitle = `${seriesTitle} - ${cleanRawTitle(fileName)}`;
  }

  return {
    seriesTitle,
    season,
    episode,
    cleanEpisodeTitle
  };
}

/**
 * Construit les métadonnées M3U pour un fichier donné
 */
export function buildM3UEntry(options: {
  torrentName: string;
  filePath: string;
  fileName: string;
  fileIndex: number;
  engineInfoHash: string;
  baseUrl: string;
  torrentCategory?: string;
  videoFilesCountInTorrent: number;
  groupingMode?: 'series' | 'category';
}): M3UEntryInfo {
  const {
    torrentName,
    filePath,
    fileName,
    fileIndex,
    engineInfoHash,
    baseUrl,
    torrentCategory,
    videoFilesCountInTorrent,
    groupingMode = 'series'
  } = options;

  const fileCat = classifyFile(filePath);
  const isAudio = fileCat === 'audio' || torrentCategory === 'audio';

  const combined = `${torrentName} ${filePath}`.toLowerCase();
  const isBonus = /\b(bonus|sample|trailer|extra|featurette|interview)\b/i.test(fileName || '');
  
  const isSeriesPattern =
    /s\d+e\d+/i.test(combined) ||
    /saison\s*\d+/i.test(combined) ||
    /season\s*\d+/i.test(combined) ||
    /\b(e|ep)\d{1,3}\b/i.test(fileName || '');

  // C'est une série si le pattern de série est détecté, ou si la catégorie le spécifie,
  // ou si multi-fichiers vidéo sans être un simple bonus
  let isSeries = false;
  if (!isAudio) {
    if (torrentCategory === 'series' || torrentCategory === 'anime') {
      isSeries = true;
    } else if (torrentCategory === 'movies' || torrentCategory === 'films') {
      isSeries = false;
    } else if (isSeriesPattern) {
      isSeries = true;
    } else if (videoFilesCountInTorrent > 1 && !isBonus) {
      isSeries = true;
    }
  }

  let groupTitle = 'Films';
  let cleanName = cleanRawTitle(fileName || 'Piste');
  let seriesTitle: string | undefined;
  let season: number | undefined;
  let episode: number | undefined;

  if (isAudio) {
    groupTitle = 'Musique';
    cleanName = (fileName || 'Piste').replace(/\.[a-zA-Z0-9]+$/, '').replace(/[-._]/g, ' ').trim();
  } else if (isSeries) {
    const seriesInfo = extractSeriesInfo(torrentName, fileName);
    seriesTitle = seriesInfo.seriesTitle;
    season = seriesInfo.season;
    episode = seriesInfo.episode;
    cleanName = seriesInfo.cleanEpisodeTitle;

    if (groupingMode === 'category') {
      groupTitle = 'Séries TV';
    } else {
      // Regroupement par Série & Saison pour Kodi : ex "Made in Abyss - S01"
      const sSuffix = season !== undefined ? ` - S${String(season).padStart(2, '0')}` : '';
      groupTitle = `${seriesTitle}${sSuffix}`;
    }
  } else {
    // Film
    groupTitle = 'Films';
    const cleanMovie = cleanRawTitle(torrentName);
    if (isBonus) {
      cleanName = `${cleanMovie} - ${cleanRawTitle(fileName)}`;
    } else {
      cleanName = cleanMovie;
    }
  }

  const streamUrl = `${baseUrl}/torrents/${engineInfoHash}/files/${fileIndex}`;

  // Attributs VOD Kodi standard
  let vodAttrs = 'media="true"';
  if (isSeries) {
    if (seriesTitle) vodAttrs += ` series="${seriesTitle}"`;
    if (season !== undefined) vodAttrs += ` season="${season}"`;
    if (episode !== undefined) vodAttrs += ` episode="${episode}"`;
  }

  let rawM3uSnippet = `#EXTINF:-1 group-title="${groupTitle}" tvg-name="${cleanName}" ${vodAttrs},${cleanName}\n`;
  rawM3uSnippet += `#EXTGRP:${groupTitle}\n`;
  rawM3uSnippet += `${streamUrl}\n`;

  return {
    streamUrl,
    cleanName,
    groupTitle,
    isSeries,
    isAudio,
    seriesTitle,
    season,
    episode,
    rawM3uSnippet
  };
}
