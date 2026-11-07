import fs from 'node:fs/promises';
import path from 'node:path';
import type { ServerDiskStatsDTO } from '../../shared/types.js';
import type { TorrentStore } from './store.js';

export interface CanFitResult {
  allowed: boolean;
  freeBytes: number;
  requiredBytes: number;
  safetyMarginBytes: number;
}

export class DiskMonitor {
  private downloadPath: string;
  private minFreeMb: number;
  private maxQuotaGb?: number;

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

  public async getDiskStats(targetPath = this.downloadPath): Promise<ServerDiskStatsDTO> {
    try {
      await fs.mkdir(targetPath, { recursive: true });
      const stats = await fs.statfs(targetPath);
      const bsize = stats.bsize;
      const totalBytes = stats.blocks * bsize;
      const freeBytes = stats.bavail * bsize;
      const usedBytes = Math.max(0, totalBytes - (stats.bfree * bsize));
      const usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0;

      return {
        totalBytes,
        freeBytes,
        usedBytes,
        usedPercent
      };
    } catch (err: any) {
      console.warn(`[DiskMonitor] statfs failed for ${targetPath}:`, err.message);
      // Fallback in case of mock/unsupported filesystem
      return {
        totalBytes: 100 * 1024 * 1024 * 1024,
        freeBytes: 50 * 1024 * 1024 * 1024,
        usedBytes: 50 * 1024 * 1024 * 1024,
        usedPercent: 50
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
    let allowed = effectiveAvailable - requiredBytes >= safetyMarginBytes;

    // Check optional maximum quota in GB
    if (allowed && this.maxQuotaGb && this.maxQuotaGb > 0) {
      const maxQuotaBytes = this.maxQuotaGb * 1024 * 1024 * 1024;
      const projectedUsed = diskStats.usedBytes + activeTorrentsPendingBytes + requiredBytes;
      if (projectedUsed > maxQuotaBytes) {
        allowed = false;
      }
    }

    return {
      allowed,
      freeBytes: diskStats.freeBytes,
      requiredBytes,
      safetyMarginBytes
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
          console.warn(
            `[DiskMonitor] Insufficient disk space for torrent ${infoHash} (${torrentLength} bytes required, ${fit.freeBytes} bytes free). Removing.`
          );
          await store.remove(infoHash);
          if (io && typeof io.emit === 'function') {
            io.emit('diskError', {
              infoHash,
              message: 'Espace disque insuffisant sur le serveur'
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
