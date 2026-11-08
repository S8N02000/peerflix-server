import type { C411SavedFilter } from '../../shared/types.js';

export const C411_STORAGE_PRESETS_KEY = 'peerflix_c411_saved_filters';

// Official C411 Categories (with direct quick-access for Films, Séries TV, Animation film & Série anime)
export const C411_CATEGORIES = [
  { label: 'Tout', cat: '', subcat: '', dotColor: '#10b981' },
  { label: '🎬 Films', cat: '1', subcat: '6', dotColor: '#3b82f6' },
  { label: '📺 Séries TV', cat: '1', subcat: '7', dotColor: '#6366f1' },
  { label: '🎌 Animation (film)', cat: '1', subcat: '1', dotColor: '#ec4899' },
  { label: '🎌 Animation (Série anime)', cat: '1', subcat: '2', dotColor: '#f43f5e' },
  { label: 'Films & Vidéos (Tous)', cat: '1', subcat: '', dotColor: '#3b82f6' },
  { label: 'Ebook', cat: '2', subcat: '', dotColor: '#f97316' },
  { label: 'Audio', cat: '3', subcat: '', dotColor: '#a855f7' },
  { label: 'Applications', cat: '4', subcat: '', dotColor: '#14b8a6' },
  { label: 'Jeux Vidéo', cat: '5', subcat: '', dotColor: '#06b6d4' },
  { label: 'Émulation', cat: '6', subcat: '', dotColor: '#ec4899' },
  { label: 'Imprimante 3D', cat: '10', subcat: '', dotColor: '#eab308' },
  { label: '🔞 XXX', cat: '8', subcat: '', dotColor: '#ec4899', isXxx: true },
];

// Subcategories per C411 Category
export const C411_SUBCAT_OPTIONS_MAP: Record<string, Array<{ label: string; value: string }>> = {
  '1': [
    { label: 'Type / Sous-catégorie', value: '' },
    { label: '🎬 Film', value: '6' },
    { label: '📺 Série TV', value: '7' },
    { label: '🎌 Animation (film)', value: '1' },
    { label: '🎌 Animation (Série anime)', value: '2' },
    { label: '🎥 Documentaire', value: '4' },
    { label: '📽 Série Doc', value: '57' },
    { label: '🎭 Spectacle', value: '8' },
    { label: '🎸 Concert', value: '3' },
    { label: '📡 Emission TV', value: '5' },
    { label: '⚽ Sport', value: '9' },
    { label: '📦 Collection', value: '54' },
    { label: '🎵 Vidéo-clips', value: '10' },
  ],
  '2': [
    { label: 'Sous-catégorie', value: '' },
    { label: '📚 Livres', value: '14' },
    { label: '💬 BDs', value: '12' },
    { label: '💥 Comics', value: '13' },
    { label: '⛩️ Manga', value: '15' },
    { label: '📰 Presse', value: '16' },
    { label: '🎧 Audio', value: '11' },
    { label: '🎼 Partitions', value: '59' },
    { label: '📖 Revues', value: '60' },
  ],
  '3': [
    { label: 'Sous-catégorie', value: '' },
    { label: '🎵 Musique', value: '18' },
    { label: '🎙 Podcast Radio', value: '19' },
    { label: '🎛 Samples', value: '20' },
    { label: '🎤 Karaoké', value: '17' },
  ],
  '4': [
    { label: 'Sous-catégorie', value: '' },
    { label: '🪟 Windows', value: '27' },
    { label: '🍎 MacOS', value: '24' },
    { label: '🐧 Linux', value: '23' },
    { label: '📱 Smartphone', value: '25' },
    { label: '📟 Tablette', value: '26' },
    { label: '🎓 Formation', value: '22' },
    { label: '📁 Autre', value: '21' },
  ],
  '5': [
    { label: 'Sous-catégorie', value: '' },
    { label: '💻 Windows / PC', value: '36' },
    { label: '🍄 Nintendo', value: '32' },
    { label: '🎮 Sony PlayStation', value: '34' },
    { label: '🟢 Microsoft Xbox', value: '31' },
    { label: '🐧 Linux', value: '29' },
    { label: '🍎 MacOS', value: '30' },
    { label: '📱 Smartphone', value: '33' },
    { label: '📟 Tablette', value: '35' },
    { label: '🥽 VR', value: '55' },
    { label: '🕹 Autre', value: '28' },
  ],
  '6': [
    { label: 'Sous-catégorie', value: '' },
    { label: '💿 ROM / ISO', value: '38' },
    { label: '🕹 Émulateur', value: '37' },
  ],
  '10': [
    { label: 'Sous-catégorie', value: '' },
    { label: '🧩 Objets', value: '47' },
    { label: '👤 Personnages', value: '48' },
    { label: '📦 Pack', value: '49' },
  ],
  '8': [
    { label: 'Sous-catégorie', value: '' },
    { label: '🎬 Films', value: '6010' },
    { label: '⛩️ Hentai', value: '6070' },
    { label: '📚 Ebooks', value: '6050' },
    { label: '🖼️ Images', value: '6060' },
    { label: '🎮 Jeux', value: '6080' },
    { label: '🥽 VR', value: '6000' },
  ],
};

export const C411_RESOLUTION_OPTIONS = [
  { label: 'Résolution', value: '' },
  { label: '4K', value: '4k' },
  { label: '2160p', value: '2160p' },
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
  { label: 'SD / 576p', value: 'sd' },
];

export const C411_VIDEO_SOURCE_OPTIONS = [
  { label: 'Source', value: '' },
  { label: 'BluRay', value: 'bluray' },
  { label: 'Remux', value: 'remux' },
  { label: 'WEB-DL', value: 'web-dl' },
  { label: 'WEBRip', value: 'webrip' },
  { label: 'HDTV', value: 'hdtv' },
  { label: 'DVD', value: 'dvd' },
  { label: 'BDMV', value: 'bdmv' },
];

export const C411_HDR_OPTIONS = [
  { label: 'HDR', value: '' },
  { label: 'HDR10', value: 'hdr10' },
  { label: 'HDR10+', value: 'hdr10+' },
  { label: 'Dolby Vision', value: 'dolby vision' },
];

export const C411_AUDIO_OPTIONS = [
  { label: 'Audio', value: '' },
  { label: 'Dolby Atmos', value: 'atmos' },
  { label: 'Lossless (TrueHD/FLAC)', value: 'lossless' },
  { label: 'DTS / DTS-HD', value: 'dts' },
  { label: 'E-AC3 / DDP', value: 'eac3' },
  { label: 'AC3 / Dolby 5.1', value: 'ac3' },
  { label: 'FLAC', value: 'flac' },
];

export const C411_CODEC_OPTIONS = [
  { label: 'Codec', value: '' },
  { label: 'AV1', value: 'av1' },
  { label: 'HEVC / x265', value: 'hevc' },
  { label: 'AVC / x264', value: 'x264' },
  { label: 'MPEG-2', value: 'mpeg-2' },
];

export const C411_VIDEO_LANGUAGE_OPTIONS = [
  { label: 'Langue audio', value: '' },
  { label: 'MULTI (VFF + VO...)', value: 'multi' },
  { label: 'VFF (Vraie VF)', value: 'vff' },
  { label: 'VFQ (Québécois)', value: 'vfq' },
  { label: 'VOSTFR', value: 'vostfr' },
  { label: 'VO (Anglais)', value: 'vo' },
];

export const C411_SUBTITLE_OPTIONS = [
  { label: 'Langue des sous-titres', value: '' },
  { label: 'Français (Complets)', value: 'french' },
  { label: 'Français (Forcés)', value: 'forced' },
  { label: 'VOSTFR (Intégrés)', value: 'vostfr' },
  { label: 'MULTI (Multiples langues)', value: 'multi' },
  { label: 'Anglais (English)', value: 'english' },
];

export const C411_SEASON_OPTIONS = [
  { label: 'Saison', value: '' },
  ...Array.from({ length: 100 }, (_, i) => ({
    label: `Saison ${i + 1}`,
    value: `S${String(i + 1).padStart(2, '0')}`,
  })),
];

export const C411_YEAR_OPTIONS = [
  { label: 'Année', value: '' },
  { label: '2026', value: '2026' },
  { label: '2025', value: '2025' },
  { label: '2024', value: '2024' },
  { label: '2023', value: '2023' },
  { label: '2022', value: '2022' },
  { label: '2021', value: '2021' },
  { label: '2020', value: '2020' },
  { label: '2019-2010', value: '2010-2019' },
  { label: '2009-2000', value: '2000-2009' },
  { label: 'Avant 2000', value: '<2000' },
];

export const C411_EBOOK_FORMAT_OPTIONS = [
  { label: 'Format Ebook', value: '' },
  { label: 'EPUB', value: 'epub' },
  { label: 'PDF', value: 'pdf' },
  { label: 'CBZ (BD / Comics)', value: 'cbz' },
  { label: 'CBR (BD / Comics)', value: 'cbr' },
  { label: 'MOBI / AZW', value: 'mobi' },
];

export const C411_GENERAL_LANGUAGE_OPTIONS = [
  { label: 'Langue', value: '' },
  { label: 'Français', value: 'french' },
  { label: 'Anglais', value: 'english' },
  { label: 'MULTI', value: 'multi' },
];

export const C411_AUDIO_FORMAT_OPTIONS = [
  { label: 'Format Audio', value: '' },
  { label: 'FLAC (Lossless)', value: 'flac' },
  { label: 'MP3 (320kbps)', value: 'mp3' },
  { label: 'AAC', value: 'aac' },
  { label: 'WAV', value: 'wav' },
];

export const C411_AUDIO_SOURCE_OPTIONS = [
  { label: 'Source', value: '' },
  { label: 'WEB', value: 'web' },
  { label: 'CD', value: 'cd' },
  { label: 'Vinyle', value: 'vinyl' },
  { label: 'SACD', value: 'sacd' },
  { label: 'Radio', value: 'radio' },
];

export const C411_PRINT3D_FORMAT_OPTIONS = [
  { label: 'Format 3D', value: '' },
  { label: 'STL', value: 'stl' },
  { label: 'OBJ', value: 'obj' },
  { label: '3MF', value: '3mf' },
  { label: 'STEP', value: 'step' },
];

export const C411_DEFAULT_PRESETS: C411SavedFilter[] = [
  { id: '1', name: '🎬 Films 4K HDR', cat: '1', resolution: '2160p', hdr: 'HDR10' },
  { id: '2', name: '📺 Séries TV MULTI', cat: '1', subCat: '7', language: 'MULTI' },
  { id: '3', name: '💎 Remux 4K', cat: '1', source: 'Remux', resolution: '2160p' },
  { id: '4', name: '📚 Ebooks & BD', cat: '2' },
  { id: '5', name: '🎵 Musique Lossless', cat: '3', audio: 'lossless' },
];
