export type FileCategory =
  | 'video'
  | 'audio'
  | 'subtitle'
  | 'executable'
  | 'archive'
  | 'disc_image'
  | 'document'
  | 'info'
  | 'other';

export type TorrentCategory =
  | 'video'
  | 'game_app'
  | 'audio'
  | 'archive'
  | 'document'
  | 'other';

export interface TorrentFileDTO {
  index: number;
  name: string;
  path: string;
  folderPath: string;
  length: number;
  selected: boolean;
  category: FileCategory;
  isComplete: boolean;
  streamUrl: string;
  downloadUrl: string;
  subtitleUrl?: string;
}

export interface TorrentStatsDTO {
  eta: number;
  progress: number;
  downloaded: number;
  uploaded: number;
  speed: {
    down: number;
    up: number;
  };
  peers: {
    total: number;
    unchoked: number;
  };
  seq?: number;
  paused?: boolean;
}

export interface ServerDiskStatsDTO {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export interface SystemStatusDTO {
  disk: ServerDiskStatsDTO;
  nextCleanAt: string;
  totalDownSpeed: number;
  authenticatedOrigin?: string;
}

export interface TorrentDTO {
  infoHash: string;
  name: string;
  length: number;
  ready: boolean;
  interested: boolean;
  pinned: boolean;
  paused?: boolean;
  addedAt: number;
  category: TorrentCategory;
  isFullyDownloaded: boolean;
  downloadedPercentage: number;
  progress: number[];
  stats: TorrentStatsDTO;
  files: TorrentFileDTO[];
}

export interface VideoStreamDTO {
  index: number;
  codec: string;
  width?: number;
  height?: number;
  browserSupported: boolean;
}

export interface AudioStreamDTO {
  index: number;
  audioTrackIndex: number;
  codec: string;
  channels: number;
  language?: string;
  title?: string;
  browserSupported: boolean;
}

export interface SubtitleStreamDTO {
  index: number;
  subTrackIndex: number;
  codec: string;
  language?: string;
  title?: string;
  isTextBased: boolean;
}

export interface MediaProbeDTO {
  durationSeconds?: number;
  videoStreams: VideoStreamDTO[];
  audioStreams: AudioStreamDTO[];
  subtitleStreams: SubtitleStreamDTO[];
  needsAudioRemux: boolean;
}

export interface C411SearchResultDTO {
  id: string; // Hash SHA-256 court généré côté serveur (jamais l'URL avec apikey !)
  title: string;
  size: number;
  pubDate: string;
  seeders: number;
  leechers: number;
  completed?: number;
  categoryId?: string;
  categoryName?: string;
  isFreeleech: boolean;
  infoHash?: string;
  alreadyAdded?: boolean;
  posterUrl?: string;
  season?: number;
  episode?: number;
  resolution?: string;
  language?: string;
  subtitles?: string;
  source?: string;
  hdr?: string;
  audio?: string;
  codec?: string;
  year?: string;
  team?: string;
  torrentId?: string;
  commentsCount?: number;
  description?: string;
}

export interface C411CommentDTO {
  id?: string;
  author: string;
  avatarUrl?: string;
  date: string;
  content: string;
}

export interface C411TorrentDetailsDTO {
  id: string;
  torrentId?: string;
  title: string;
  cleanTitle?: string;
  categoryName?: string;
  size: number;
  pubDate?: string;
  seeders: number;
  leechers: number;
  isFreeleech: boolean;
  posterUrl?: string;
  descriptionHtml: string;
  nfo?: string;
  comments: C411CommentDTO[];
  c411PageUrl?: string;
}

export interface C411SavedFilter {
  id: string;
  name: string;
  cat?: string;
  subCat?: string;
  resolution?: string;
  language?: string;
  subtitles?: string;
  season?: string;
  source?: string;
  hdr?: string;
  audio?: string;
  codec?: string;
  year?: string;
  freeleechOnly?: boolean;
}

export interface C411ProfileDTO {
  enabled: boolean;
  username?: string;
  avatarUrl?: string;
  uploadedBytes?: number;
  downloadedBytes?: number;
  zenBalance?: number;
  freeleechActive?: boolean;
  downloadAllowed?: boolean;
}

