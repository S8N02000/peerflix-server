import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseTorrentInput } from './torrent-parser.js';
import { createTorrentEngine, type TorrentEngine, type TorrentEngineOptions } from './engine.js';
import parseTorrent from 'parse-torrent';

export interface StoredTorrentMetadata {
  infoHash: string;
  name?: string;
  addedAt: number;
  pinned: boolean;
  magnet?: string;
}

export interface StoreOptions {
  configPath?: string;
  downloadPath?: string;
  engineOptions?: TorrentEngineOptions;
}

export class TorrentStore extends EventEmitter {
  private configPath: string;
  private downloadPath: string;
  private storageFile: string;
  private torrentsDir: string;
  private engineOptions: TorrentEngineOptions;
  private torrents: Map<string, TorrentEngine> = new Map();
  private metadata: Map<string, StoredTorrentMetadata> = new Map();
  private savePromise: Promise<void> = Promise.resolve();

  constructor(options: StoreOptions = {}) {
    super();
    const homeDir = os.homedir();
    this.configPath =
      options.configPath ||
      process.env.PEERFLIX_CONFIG_PATH ||
      path.join(homeDir, '.config', 'peerflix-server');
    this.downloadPath = options.downloadPath || process.env.PEERFLIX_DOWNLOAD_PATH || '/tmp/torrent-stream';
    this.storageFile = path.join(this.configPath, 'torrents.json');
    this.torrentsDir = path.join(this.configPath, 'torrents');
    this.engineOptions = options.engineOptions || {};
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public getDownloadPath(): string {
    return this.downloadPath;
  }

  public async init(): Promise<void> {
    await fs.mkdir(this.configPath, { recursive: true });
    await fs.mkdir(this.torrentsDir, { recursive: true });
    await fs.mkdir(this.downloadPath, { recursive: true });

    let rawData = '';
    try {
      rawData = await fs.readFile(this.storageFile, 'utf-8');
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Fresh start, no existing state
        return;
      }
      console.warn(`Failed to read ${this.storageFile}:`, err.message);
      return;
    }

    if (!rawData.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(rawData);
      let items: StoredTorrentMetadata[] = [];

      if (Array.isArray(parsed)) {
        // Handle legacy format (array of infohashes or objects)
        items = parsed.map((item: any) => {
          if (typeof item === 'string') {
            return {
              infoHash: item,
              addedAt: Date.now(),
              pinned: false
            };
          }
          return {
            infoHash: item.infoHash,
            name: item.name,
            addedAt: item.addedAt || Date.now(),
            pinned: Boolean(item.pinned),
            magnet: item.magnet
          };
        });
      } else if (typeof parsed === 'object' && parsed !== null) {
        items = Object.values(parsed);
      }

      for (const meta of items) {
        if (meta && meta.infoHash) {
          this.metadata.set(meta.infoHash, meta);
          await this.loadTorrent(meta);
        }
      }
    } catch (err: any) {
      console.warn(`[Store] Corrupted torrents.json detected (${err.message}). Creating .bak copy.`);
      try {
        await fs.writeFile(`${this.storageFile}.bak`, rawData, 'utf-8');
      } catch {
        // Ignore backup failure
      }
      this.metadata.clear();
    }
  }

  private async loadTorrent(meta: StoredTorrentMetadata): Promise<void> {
    try {
      const torrentFilePath = path.join(this.torrentsDir, `${meta.infoHash}.torrent`);
      let source: string | Buffer;

      try {
        source = await fs.readFile(torrentFilePath);
      } catch {
        source = meta.magnet || `magnet:?xt=urn:btih:${meta.infoHash}`;
      }

      const engine = await createTorrentEngine(source, {
        path: path.join(this.downloadPath, meta.infoHash),
        tmp: this.downloadPath,
        ...this.engineOptions
      });

      engine.infoHash = meta.infoHash;
      this.torrents.set(meta.infoHash, engine);
      this.emit('torrent', meta.infoHash, engine);
    } catch (err: any) {
      console.error(`[Store] Failed to resume torrent ${meta.infoHash}:`, err.message);
    }
  }

  public async add(input: string | Buffer): Promise<string> {
    const { parsed, source } = await parseTorrentInput(input);
    const infoHash = parsed.infoHash;

    if (this.torrents.has(infoHash)) {
      return infoHash;
    }

    const meta: StoredTorrentMetadata = {
      infoHash,
      name: parsed.name,
      addedAt: Date.now(),
      pinned: false,
      magnet: typeof source === 'string' && source.startsWith('magnet:') ? source : undefined
    };

    if (Buffer.isBuffer(source)) {
      try {
        await fs.writeFile(path.join(this.torrentsDir, `${infoHash}.torrent`), source);
      } catch (err: any) {
        console.warn(`[Store] Failed to save torrent buffer for ${infoHash}:`, err.message);
      }
    }

    const engine = await createTorrentEngine(source, {
      path: path.join(this.downloadPath, infoHash),
      tmp: this.downloadPath,
      ...this.engineOptions
    });

    engine.infoHash = infoHash;
    this.torrents.set(infoHash, engine);
    this.metadata.set(infoHash, meta);

    engine.once('ready', () => {
      if (engine.torrent?.name && !meta.name) {
        meta.name = engine.torrent.name;
        this.save();
      }
    });

    this.emit('torrent', infoHash, engine);
    await this.save();
    return infoHash;
  }

  public get(infoHash: string): TorrentEngine | undefined {
    return this.torrents.get(infoHash);
  }

  public getMetadata(infoHash: string): StoredTorrentMetadata | undefined {
    return this.metadata.get(infoHash);
  }

  public togglePin(infoHash: string): boolean {
    const meta = this.metadata.get(infoHash);
    if (!meta) {
      return false;
    }
    meta.pinned = !meta.pinned;
    this.save();
    return meta.pinned;
  }

  public async remove(infoHash: string, deleteFiles = true): Promise<void> {
    const engine = this.torrents.get(infoHash);
    if (engine) {
      await new Promise<void>((resolve) => {
        try {
          if (deleteFiles && typeof engine.remove === 'function') {
            engine.remove(false, () => {
              engine.destroy(() => resolve());
            });
          } else {
            engine.destroy(() => resolve());
          }
        } catch {
          resolve();
        }
      });
      engine.emit('destroyed');
      this.torrents.delete(infoHash);
    }

    this.metadata.delete(infoHash);

    // Remove stored .torrent file
    try {
      await fs.unlink(path.join(this.torrentsDir, `${infoHash}.torrent`));
    } catch {
      // Ignore if file doesn't exist
    }

    // Clean downloaded folder if exists
    if (deleteFiles) {
      try {
        const potentialDir = path.join(this.downloadPath, infoHash);
        await fs.rm(potentialDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }

    this.emit('remove', infoHash);
    await this.save();
  }

  public list(): TorrentEngine[] {
    return Array.from(this.torrents.values());
  }

  public listMetadata(): StoredTorrentMetadata[] {
    return Array.from(this.metadata.values());
  }

  public async save(): Promise<void> {
    // Chain saves to avoid concurrent writing race conditions
    this.savePromise = this.savePromise.then(async () => {
      const data = Object.fromEntries(this.metadata.entries());
      const tempFile = `${this.storageFile}.tmp`;
      const jsonString = JSON.stringify(data, null, 2);

      await fs.mkdir(this.configPath, { recursive: true });
      await fs.writeFile(tempFile, jsonString, 'utf-8');
      await fs.rename(tempFile, this.storageFile);
    }).catch((err) => {
      console.error('[Store] Atomic save failed:', err.message);
    });

    return this.savePromise;
  }

  public async destroyAll(): Promise<void> {
    const engines = Array.from(this.torrents.values());
    await Promise.allSettled(
      engines.map(
        (engine) =>
          new Promise<void>((resolve) => {
            try {
              engine.destroy(() => {
                engine.emit('destroyed');
                resolve();
              });
            } catch {
              resolve();
            }
          })
      )
    );
    this.torrents.clear();
  }
}

export const defaultStore = new TorrentStore();
