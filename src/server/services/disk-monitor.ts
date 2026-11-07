import fs from 'node:fs/promises';
import path from 'node:path';
import type { ServerDiskStatsDTO } from '../../shared/types.js';
import type { TorrentStore } from './store.js';

export interface CanFitResult {
  allowed: boolean;
  freeBytes: number;
  requiredBytes: number;
  safetyMarginBytes: number;
  reason?: 'PHYSICAL_DISK_FULL' | 'PEERFLIX_QUOTA_EXCEEDED';
}

export class DiskMonitor {
  private downloadPath: string;
  private minFreeMb: number;
  private maxQuotaGb?: number;
  private store?: TorrentStore;
  private cachedPeerflixSize = 0;
  private lastSizeCheckTime = 0;

  constructor(
    downloadPath = '/tmp/torrent-stream',
    minFreeMb?: number,
    maxQuotaGb?: number,
    store?: TorrentStore
  ) {
    this.downloadPath = downloadPath;
    this.store = store;
    this.minFreeMb =
      typeof minFreeMb === 'number'
        ? minFreeMb
        : process.env.MIN_FREE_DISK_MB
        ? parseInt(process.env.MIN_FREE_DISK_MB, 10)
        : 2048;
    this.maxQuotaGb =
      typeof maxQuotaGb === 'number'
        ? maxQuotaGb
        : process.env.MAX_DISK_QUOTA_GB
        ? parseFloat(process.env.MAX_DISK_QUOTA_GB)
        : undefined;
  }

  public setStore(store: TorrentStore): void {
    this.store = store;
  }

  public getStore(): TorrentStore | undefined {
    return this.store;
  }

  /**
   * Recursively computes directory size in bytes with error handling
   */
  public async computeDirectorySize(dirPath: string): Promise<number> {
    let total = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          total += await this.computeDirectorySize(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(fullPath);
            total += stat.size;
          } catch {
            // Ignore temporary or removed files during scan
          }
        }
      }
    } catch {
      // Ignore if dir does not exist yet
    }
    return total;
  }

  /**
   * Get size used exclusively by Peerflix downloads with a 15s cache
   */
  public async getPeerflixUsedBytes(targetPath = this.downloadPath): Promise<number> {
    const now = Date.now();
    if (now - this.lastSizeCheckTime < 15000 && this.cachedPeerflixSize >= 0) {
      return this.cachedPeerflixSize;
    }

    try {
      await fs.mkdir(targetPath, { recursive: true });
      const size = await this.computeDirectorySize(targetPath);
      this.cachedPeerflixSize = size;
      this.lastSizeCheckTime = now;
      return size;
    } catch {
      return this.cachedPeerflixSize || 0;
    }
  }

  public async getDiskStats(
    targetPath = this.downloadPath,
    customStore?: TorrentStore
  ): Promise<ServerDiskStatsDTO> {
    const store = customStore || this.store;

    try {
      await fs.mkdir(targetPath, { recursive: true });
      const stats = await fs.statfs(targetPath);
      const bsize = stats.bsize;
      const totalBytes = stats.blocks * bsize;
      const freeBytes = stats.bavail * bsize;
      const usedBytes = Math.max(0, totalBytes - (stats.bfree * bsize));
      const usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0;

      // Calculate size used by Peerflix: if store is attached, use instant memory calculation
      // Quota treats all registered torrents as if they were fully downloaded (reservation)
      let peerflixUsedBytes: number;
      let peerflixDownloadedBytes: number | undefined;

      if (store) {
        peerflixUsedBytes = store.getTotalAllocatedBytes();
        peerflixDownloadedBytes = store.getTotalDownloadedBytes();
      } else {
        peerflixUsedBytes = await this.getPeerflixUsedBytes(targetPath);
      }

      const maxQuotaBytes =
        typeof this.maxQuotaGb === 'number' && this.maxQuotaGb > 0
          ? this.maxQuotaGb * 1024 * 1024 * 1024
          : undefined;

      const quotaPercent =
        maxQuotaBytes && maxQuotaBytes > 0
          ? Math.min(100, Math.round((peerflixUsedBytes / maxQuotaBytes) * 100))
          : undefined;

      return {
        totalBytes,
        freeBytes,
        usedBytes,
        usedPercent,
        peerflixUsedBytes,
        peerflixDownloadedBytes,
        maxQuotaBytes,
        quotaPercent
      };
    } catch (err: any) {
      console.warn(`[DiskMonitor] statfs failed for ${targetPath}:`, err.message);
      const peerflixUsedBytes = store ? store.getTotalAllocatedBytes() : await this.getPeerflixUsedBytes(targetPath);
      const peerflixDownloadedBytes = store ? store.getTotalDownloadedBytes() : undefined;
      const maxQuotaBytes =
        typeof this.maxQuotaGb === 'number' && this.maxQuotaGb > 0
          ? this.maxQuotaGb * 1024 * 1024 * 1024
          : undefined;

      return {
        totalBytes: 100 * 1024 * 1024 * 1024,
        freeBytes: 50 * 1024 * 1024 * 1024,
        usedBytes: 50 * 1024 * 1024 * 1024,
        usedPercent: 50,
        peerflixUsedBytes,
        peerflixDownloadedBytes,
        maxQuotaBytes,
        quotaPercent: maxQuotaBytes ? Math.min(100, Math.round((peerflixUsedBytes / maxQuotaBytes) * 100)) : undefined
      };
    }
  }

  public async canFitTorrent(
    requiredBytes: number,
    targetPath = this.downloadPath,
    activeTorrentsPendingBytes = 0,
    options: { excludeInfoHash?: string; store?: TorrentStore } = {}
  ): Promise<CanFitResult> {
    const store = options.store || this.store;
    const diskStats = await this.getDiskStats(targetPath, store);
    const safetyMarginBytes = this.minFreeMb * 1024 * 1024;

    // Remaining unwritten bytes to download across existing torrents
    const pendingUnwrittenBytes = store
      ? Math.max(0, store.getTotalAllocatedBytes(options.excludeInfoHash) - store.getTotalDownloadedBytes())
      : activeTorrentsPendingBytes;

    // 1. Check physical disk available space on the host partition
    const effectiveAvailable = diskStats.freeBytes - pendingUnwrittenBytes;
    let allowed = effectiveAvailable - requiredBytes >= safetyMarginBytes;
    let reason: 'PHYSICAL_DISK_FULL' | 'PEERFLIX_QUOTA_EXCEEDED' | undefined;

    if (!allowed) {
      reason = 'PHYSICAL_DISK_FULL';
    }

    // 2. Check maximum quota allocated exclusively to Peerflix (as if ALL torrents are completed)
    if (allowed && typeof this.maxQuotaGb === 'number' && this.maxQuotaGb > 0) {
      const maxQuotaBytes = this.maxQuotaGb * 1024 * 1024 * 1024;
      const currentPeerflixAllocated = store
        ? store.getTotalAllocatedBytes(options.excludeInfoHash)
        : (diskStats.peerflixUsedBytes ?? 0);

      const projectedPeerflixAllocated = currentPeerflixAllocated + requiredBytes;

      if (projectedPeerflixAllocated > maxQuotaBytes) {
        allowed = false;
        reason = 'PEERFLIX_QUOTA_EXCEEDED';
      }
    }

    return {
      allowed,
      freeBytes: diskStats.freeBytes,
      requiredBytes,
      safetyMarginBytes,
      reason
    };
  }

  public attachToStore(store: TorrentStore, io?: { emit: (event: string, data: any) => void }): void {
    this.store = store;

    store.on('torrent', (infoHash: string, engine: any) => {
      let spaceChecked = false;

      const checkSpace = async () => {
        if (spaceChecked) return;
        const torrentLength = store.getTorrentAllocatedBytes(infoHash) || engine.torrent?.length;
        if (!torrentLength || torrentLength <= 0) {
          return;
        }

        spaceChecked = true;

        const fit = await this.canFitTorrent(torrentLength, store.getDownloadPath(), 0, {
          excludeInfoHash: infoHash,
          store
        });

        if (!fit.allowed) {
          const quotaLabel = this.maxQuotaGb ? `${this.maxQuotaGb} Go` : '';
          const message =
            fit.reason === 'PEERFLIX_QUOTA_EXCEEDED'
              ? `Quota Peerflix dépassé (limite de ${quotaLabel} atteinte)`
              : 'Espace disque insuffisant sur le serveur';

          console.warn(
            `[DiskMonitor] Torrent ${infoHash} rejected: ${message} (${torrentLength} bytes required, ${fit.freeBytes} bytes free). Removing.`
          );
          await store.remove(infoHash);
          if (io && typeof io.emit === 'function') {
            io.emit('diskError', {
              infoHash,
              message
            });
          }
        }
      };

      if (engine.ready && engine.torrent?.length) {
        checkSpace();
      } else {
        engine.once('verifying', checkSpace);
        engine.once('ready', checkSpace);
      }
    });
  }
}

export const defaultDiskMonitor = new DiskMonitor();
