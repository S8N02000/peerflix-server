import torrentStream from 'torrent-stream';
import { findAvailablePort } from './port-finder.js';
import { classifyTorrent, shouldSelectFile, classifyFile } from './classifier.js';
import type { TorrentCategory } from '../../shared/types.js';

export interface TorrentEngineOptions {
  connections?: number;
  uploads?: number;
  tmp?: string;
  path?: string;
  verify?: boolean;
  dht?: boolean;
  tracker?: boolean;
  trackers?: string[];
  port?: number;
}

export type TorrentEngine = ReturnType<typeof torrentStream> & {
  ready?: boolean;
  port?: number;
  infoHash: string;
  category?: TorrentCategory;
  torrent?: any;
  files: any[];
  swarm: any;
  discovery?: any;
  bitfield?: any;
  selection?: any[];
  isPaused?: boolean;
  _selectedFileIndices?: Set<number>;
  _maxDownloadedBytes?: number;
  _statsSeq?: number;
  destroy: (cb?: () => void) => void;
  remove: (keepPieces: boolean, cb?: () => void) => void;
  listen: (port: number, cb?: () => void) => void;
  select: (from?: number, to?: number, priority?: number) => void;
  deselect: (from?: number, to?: number, priority?: number) => void;
};

export function pauseTorrent(engine: TorrentEngine): void {
  engine.isPaused = true;
  if (engine.swarm && typeof engine.swarm.pause === 'function') {
    engine.swarm.pause();
  }

  // Choke/pause existing active wires to halt in-flight requests immediately
  if (engine.swarm?.wires && Array.isArray(engine.swarm.wires)) {
    engine.swarm.wires.forEach((wire: any) => {
      try {
        if (typeof wire.choke === 'function') {
          wire.choke();
        }
      } catch {
        // Ignore
      }
    });
  }

  // Remember which files were selected before deselecting
  if (!engine._selectedFileIndices) {
    engine._selectedFileIndices = new Set<number>();
  }
  engine._selectedFileIndices.clear();

  if (engine.files && Array.isArray(engine.files)) {
    engine.files.forEach((file: any, index: number) => {
      if (file.selected !== false) {
        engine._selectedFileIndices?.add(index);
      }
    });
  }

  // Deselect all pieces to stop download
  const totalPieces = engine.torrent?.pieces?.length || 1;
  try {
    engine.deselect(0, totalPieces - 1, 0);
  } catch {
    // Ignore
  }
}

export function resumeTorrent(engine: TorrentEngine): void {
  engine.isPaused = false;
  if (engine.swarm && typeof engine.swarm.resume === 'function') {
    engine.swarm.resume();
  }

  // Re-select remembered files or all selected files
  if (engine.files && Array.isArray(engine.files)) {
    engine.files.forEach((file: any, index: number) => {
      const wasSelected = engine._selectedFileIndices
        ? engine._selectedFileIndices.has(index)
        : file.selected !== false;

      if (wasSelected) {
        if (typeof file.select === 'function') {
          file.select();
        }
        file.selected = true;
      }
    });
  }
}

export function enforceSilentZeroRatio(engine: TorrentEngine): void {
  if (engine.swarm) {
    Object.defineProperty(engine.swarm, 'downloaded', {
      get: () => 0,
      set: () => {},
      configurable: true
    });

    Object.defineProperty(engine.swarm, 'uploaded', {
      get: () => 0,
      set: () => {},
      configurable: true
    });

    engine.swarm.on('wire', (wire: any, connection?: any) => {
      try {
        // Prevent unhandled EPIPE/ECONNRESET on peer socket from crashing the Node.js process
        if (connection && typeof connection.on === 'function') {
          connection.on('error', (err: any) => {
            // Silently destroy disconnected peer connection
            try {
              connection.destroy();
            } catch {
              // Ignore
            }
          });
        }

        if (typeof wire.on === 'function') {
          wire.on('error', () => {
            try {
              wire.destroy();
            } catch {
              // Ignore
            }
          });
        }

        if (typeof wire.choke === 'function') {
          wire.choke();
        }
        Object.defineProperty(wire, 'uploaded', {
          get: () => 0,
          set: () => {},
          configurable: true
        });

        wire.on('request', () => {
          if (typeof wire.choke === 'function') {
            wire.choke();
          }
        });
      } catch {
        // Silent catch
      }
    });
  }

  const discovery = (engine as any).discovery;
  if (discovery && discovery.tracker) {
    if (typeof discovery.tracker.complete === 'function') {
      discovery.tracker.complete = () => {};
    }
  }
}

export function applyIntelligentFileSelection(engine: TorrentEngine): void {
  if (!engine.files || engine.files.length === 0) {
    return;
  }

  const category = classifyTorrent(engine.files);
  engine.category = category;

  let selectedCount = 0;

  engine.files.forEach((file: any) => {
    if (shouldSelectFile(category, file)) {
      file.select();
      file.selected = true;
      selectedCount++;

      // Piece prioritization for fast video streaming (head & tail)
      if (classifyFile(file.path || file.name) === 'video') {
        const pieceLength = engine.torrent?.pieceLength;
        if (pieceLength && typeof file.offset === 'number' && file.length > 0) {
          const startPiece = Math.floor(file.offset / pieceLength);
          const endPiece = Math.floor((file.offset + file.length - 1) / pieceLength);
          // Prioritize first 2 pieces for instant playback startup
          const firstPiecesEnd = Math.min(startPiece + 2, endPiece);
          engine.select(startPiece, firstPiecesEnd, 1);
          // Prioritize last piece for moov atom / cues
          engine.select(endPiece, endPiece, 1);
        }
      }
    } else {
      file.deselect();
      file.selected = false;
    }
  });

  // Fallback: If no file selected (e.g. only samples), select the largest file
  if (selectedCount === 0 && engine.files.length > 0) {
    const largestFile = engine.files.reduce((a: any, b: any) => (a.length > b.length ? a : b));
    largestFile.select();
    largestFile.selected = true;
  }
}

export async function createTorrentEngine(
  torrent: string | Buffer | object,
  opts: TorrentEngineOptions = {}
): Promise<TorrentEngine> {
  const engineOpts = { uploads: 0, ...opts };
  const engine = torrentStream(torrent, engineOpts) as TorrentEngine;

  engine.ready = false;

  enforceSilentZeroRatio(engine);

  engine.once('verifying', () => {
    const totalPieces = engine.torrent?.pieces?.length || 0;
    let verifiedPieces = 0;

    engine.on('verify', () => {
      verifiedPieces++;
      if (verifiedPieces === totalPieces && totalPieces > 0) {
        engine.emit('finished');
      }
    });
  });

  engine.once('ready', () => {
    engine.ready = true;
    applyIntelligentFileSelection(engine);
  });

  engine.once('destroyed', () => {
    engine.removeAllListeners();
  });

  try {
    const port = engineOpts.port || (await findAvailablePort(6881));
    engine.listen(port, () => {
      engine.port = port;
    });
  } catch (err) {
    console.error(`Failed to bind port for torrent ${engine.infoHash}:`, err);
  }

  return engine;
}
