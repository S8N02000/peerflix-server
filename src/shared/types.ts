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
