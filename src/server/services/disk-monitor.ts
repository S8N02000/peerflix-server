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
  private cachedPeerflixSize = 0;
  private lastSizeCheckTime = 0;

  constructor(downloadPath = '/tmp/torrent-stream', minFreeMb?: number, maxQuotaGb?: number) {
    this.downloadPath = downloadPath;
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

  public async getDiskStats(targetPath = this.downloadPath): Promise<ServerDiskStatsDTO> {
    try {
      await fs.mkdir(targetPath, { recursive: true });
      const stats = await fs.statfs(targetPath);
      const bsize = stats.bsize;
      const totalBytes = stats.blocks * bsize;
      const freeBytes = stats.bavail * bsize;
      const usedBytes = Math.max(0, totalBytes - (stats.bfree * bsize));
      const usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0;

      // Calculate size used exclusively by Peerflix downloads
      const peerflixUsedBytes = await this.getPeerflixUsedBytes(targetPath);
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
        maxQuotaBytes,
        quotaPercent
      };
    } catch (err: any) {
      console.warn(`[DiskMonitor] statfs failed for ${targetPath}:`, err.message);
      const peerflixUsedBytes = await this.getPeerflixUsedBytes(targetPath);
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
        maxQuotaBytes,
        quotaPercent: maxQuotaBytes ? Math.min(100, Math.round((peerflixUsedBytes / maxQuotaBytes) * 100)) : undefined
      };
    }
  }

  public async canFitTorrent(
    requiredBytes: number,
    targetPath = this.downloadPath,
    activeTorrentsPendingBytes = 0
  ): Promise<CanFitResult> {
    const diskStats = await this.getDiskStats(targetPath);
    const safetyMarginBytes = this.minFreeMb * 1024 * 1024;
    const effectiveAvailable = diskStats.freeBytes - activeTorrentsPendingBytes;

    // 1. Check physical disk available space on the host partition
    let allowed = effectiveAvailable - requiredBytes >= safetyMarginBytes;
    let reason: 'PHYSICAL_DISK_FULL' | 'PEERFLIX_QUOTA_EXCEEDED' | undefined;

    if (!allowed) {
      reason = 'PHYSICAL_DISK_FULL';
    }

    // 2. Check maximum quota allocated exclusively to Peerflix (not the whole host disk!)
    if (allowed && typeof this.maxQuotaGb === 'number' && this.maxQuotaGb > 0) {
      const maxQuotaBytes = this.maxQuotaGb * 1024 * 1024 * 1024;
      const currentPeerflixUsed = diskStats.peerflixUsedBytes ?? 0;
      const projectedPeerflixUsed = currentPeerflixUsed + activeTorrentsPendingBytes + requiredBytes;

      if (projectedPeerflixUsed > maxQuotaBytes) {
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
    store.on('torrent', (infoHash: string, engine: any) => {
      const checkSpace = async () => {
        const torrentLength = engine.torrent?.length;
        if (!torrentLength || torrentLength <= 0) {
          return;
        }

        const fit = await this.canFitTorrent(torrentLength, store.getDownloadPath());
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

      engine.once('verifying', checkSpace);
      engine.once('ready', checkSpace);
    });
  }
}

export const defaultDiskMonitor = new DiskMonitor();
