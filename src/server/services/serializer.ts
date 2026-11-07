import path from 'node:path';
import type {
  TorrentDTO,
  TorrentFileDTO,
  TorrentStatsDTO,
  FileCategory,
  TorrentCategory
} from '../../shared/types.js';
import type { TorrentEngine } from './engine.js';
import type { StoredTorrentMetadata } from './store.js';
import { classifyFile, classifyTorrent } from './classifier.js';

export function calculateTorrentStats(engine: TorrentEngine): TorrentStatsDTO {
  const defaultStats: TorrentStatsDTO = {
    eta: 0,
    progress: 0,
    downloaded: 0,
    uploaded: 0,
    speed: { down: 0, up: 0 },
    peers: { total: 0, unchoked: 0 }
  };

  if (!engine) {
    return defaultStats;
  }

  const swarm = engine.swarm;
  const wires: any[] = swarm?.wires || [];
  const totalPeers = wires.length;
  const unchokedPeers = wires.filter((w) => !w.peerChoked).length;

  let downSpeed = 0;
  if (swarm && typeof swarm.downloadSpeed === 'function') {
    downSpeed = swarm.downloadSpeed();
  }

  if (!engine.torrent || !engine.torrent.pieces) {
    return {
      ...defaultStats,
      speed: { down: downSpeed, up: 0 },
      peers: { total: totalPeers, unchoked: unchokedPeers }
    };
  }

  const totalPieces = engine.torrent.pieces.length;
  let verifiedPieces = 0;

  if (engine.bitfield && totalPieces > 0) {
    for (let i = 0; i < totalPieces; i++) {
      if (engine.bitfield.get(i)) {
        verifiedPieces++;
      }
    }
  }

  const progress = totalPieces > 0 ? verifiedPieces / totalPieces : 0;
  const downloadedBytes = Math.round(progress * (engine.torrent.length || 0));

  let eta = 0;
  if (downSpeed > 0 && engine.torrent.length) {
    const remainingBytes = Math.max(0, engine.torrent.length - downloadedBytes);
    eta = Math.round(remainingBytes / downSpeed);
  }

  return {
    eta,
    progress,
    downloaded: downloadedBytes,
    uploaded: 0,
    speed: {
      down: downSpeed,
      up: 0
    },
    peers: {
      total: totalPeers,
      unchoked: unchokedPeers
    }
  };
}

export function isFileComplete(
  file: any,
  engine: TorrentEngine
): boolean {
  if (!engine.torrent || !engine.bitfield || !file) {
    return false;
  }

  const pieceLength = engine.torrent.pieceLength;
  if (!pieceLength || typeof file.offset !== 'number' || file.length === 0) {
    return false;
  }

  const startPiece = Math.floor(file.offset / pieceLength);
  const endPiece = Math.floor((file.offset + file.length - 1) / pieceLength);

  for (let p = startPiece; p <= endPiece; p++) {
    if (!engine.bitfield.get(p)) {
      return false;
    }
  }

  return true;
}

export function serializeTorrent(
  engine: TorrentEngine,
  metadata?: StoredTorrentMetadata
): TorrentDTO {
  const infoHash = engine.infoHash;
  const ready = Boolean(engine.ready && engine.torrent);
  const stats = calculateTorrentStats(engine);
  const addedAt = metadata?.addedAt || Date.now();
  const pinned = metadata?.pinned ?? false;

  if (!ready || !engine.torrent || !engine.files) {
    const defaultCategory: TorrentCategory = engine.category || 'other';
    return {
      infoHash,
      name: metadata?.name || engine.torrent?.name || infoHash,
      length: engine.torrent?.length || 0,
      ready: false,
      interested: false,
      pinned,
      addedAt,
      category: defaultCategory,
      isFullyDownloaded: false,
      downloadedPercentage: 0,
      progress: [0],
      stats,
      files: []
    };
  }

  const torrentCategory = engine.category || classifyTorrent(engine.files);
  engine.category = torrentCategory;

  // Find subtitles in the torrent to associate with media
  let defaultSubtitleUrl: string | undefined;
  engine.files.forEach((f, idx) => {
    const cat = classifyFile(f.path || f.name);
    if (cat === 'subtitle' && !defaultSubtitleUrl) {
      defaultSubtitleUrl = `/torrents/${infoHash}/subtitles/${idx}`;
    }
  });

  let selectedTotal = 0;
  let selectedCompleted = 0;

  const filesDTO: TorrentFileDTO[] = engine.files.map((file: any, index: number) => {
    const filePath = file.path || file.name;
    const cat = classifyFile(filePath);
    const isComplete = isFileComplete(file, engine);
    const selected = file.selected !== false;

    if (selected) {
      selectedTotal++;
      if (isComplete) {
        selectedCompleted++;
      }
    }

    const dirname = path.dirname(filePath);
    const folderPath = dirname === '.' ? '' : dirname;

    return {
      index,
      name: file.name,
      path: filePath,
      folderPath,
      length: file.length,
      selected,
      category: cat,
      isComplete,
      streamUrl: `/torrents/${infoHash}/files/${index}`,
      downloadUrl: `/torrents/${infoHash}/files/${index}?download=1`,
      subtitleUrl: cat === 'video' ? defaultSubtitleUrl : undefined
    };
  });

  const isFullyDownloaded =
    selectedTotal > 0 ? selectedCompleted === selectedTotal : stats.progress >= 0.9999;

  const downloadedPercentage = Math.round(stats.progress * 100);

  return {
    infoHash,
    name: engine.torrent.name || metadata?.name || infoHash,
    length: engine.torrent.length || 0,
    ready: true,
    interested: true,
    pinned,
    addedAt,
    category: torrentCategory,
    isFullyDownloaded,
    downloadedPercentage,
    progress: [stats.progress],
    stats,
    files: filesDTO
  };
}
