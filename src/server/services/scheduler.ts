import fs from 'node:fs/promises';
import path from 'node:path';
import type { TorrentStore } from './store.js';

export interface SchedulerConfig {
  enabled?: boolean;
  targetDay?: number; // 0 = Sunday, 1 = Monday, etc.
  targetHour?: number;
  targetMinute?: number;
}

export class AutoCleanScheduler {
  private enabled: boolean;
  private targetDay: number;
  private targetHour: number;
  private targetMinute: number;
  private timer: NodeJS.Timeout | null = null;
  private store: TorrentStore | null = null;
  private io: any = null;

  constructor(config: SchedulerConfig = {}) {
    this.enabled =
      config.enabled !== undefined
        ? config.enabled
        : process.env.AUTO_CLEAN_ENABLED !== 'false';
    this.targetDay =
      config.targetDay !== undefined
        ? config.targetDay
        : parseInt(process.env.AUTO_CLEAN_DAY || '1', 10);
    this.targetHour =
      config.targetHour !== undefined
        ? config.targetHour
        : parseInt(process.env.AUTO_CLEAN_HOUR || '9', 10);
    this.targetMinute =
      config.targetMinute !== undefined
        ? config.targetMinute
        : parseInt(process.env.AUTO_CLEAN_MINUTE || '0', 10);
  }

  public getNextCleanDate(now = new Date()): Date {
    const next = new Date(now.getTime());
    next.setSeconds(0, 0);
    next.setHours(this.targetHour, this.targetMinute, 0, 0);

    const currentDay = now.getDay();
    let daysUntilTarget = (this.targetDay - currentDay + 7) % 7;

    // If target day is today, check if time has already passed
    if (daysUntilTarget === 0) {
      if (now.getTime() >= next.getTime()) {
        daysUntilTarget = 7;
      }
    }

    next.setDate(next.getDate() + daysUntilTarget);
    return next;
  }

  public getNextCleanAtISO(): string {
    return this.getNextCleanDate().toISOString();
  }

  public async cleanAllUnpinned(store = this.store): Promise<{ removedCount: number; keptCount: number }> {
    if (!store) {
      return { removedCount: 0, keptCount: 0 };
    }

    const metadataList = store.listMetadata();
    let removedCount = 0;
    let keptCount = 0;
    const keptInfoHashes = new Set<string>();

    for (const meta of metadataList) {
      if (meta.pinned) {
        keptCount++;
        keptInfoHashes.add(meta.infoHash);
      } else {
        await store.remove(meta.infoHash);
        removedCount++;
      }
    }

    // Clean orphan directories in download path
    try {
      const downloadPath = store.getDownloadPath();
      const entries = await fs.readdir(downloadPath, { withFileTypes: true });
      for (const entry of entries) {
        // If an entry is named as an infoHash and not in keptInfoHashes, clean it
        if (entry.isDirectory() && /^[0-9a-fA-F]{40}$/.test(entry.name)) {
          if (!keptInfoHashes.has(entry.name.toLowerCase())) {
            await fs.rm(path.join(downloadPath, entry.name), { recursive: true, force: true });
          }
        }
      }
    } catch {
      // Ignore directory cleanup errors
    }

    if (this.io && typeof this.io.emit === 'function') {
      this.io.emit('clean', { removedCount, keptCount, nextCleanAt: this.getNextCleanAtISO() });
    }

    return { removedCount, keptCount };
  }

  public start(store: TorrentStore, io?: any): void {
    this.store = store;
    this.io = io || null;

    if (!this.enabled) {
      return;
    }

    this.scheduleNextRun();
  }

  private scheduleNextRun(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const now = new Date();
    const nextDate = this.getNextCleanDate(now);
    const delay = Math.max(1000, nextDate.getTime() - now.getTime());

    this.timer = setTimeout(async () => {
      try {
        await this.cleanAllUnpinned();
      } catch (err: any) {
        console.error('[Scheduler] Scheduled clean execution failed:', err.message);
      } finally {
        this.scheduleNextRun();
      }
    }, delay);

    // Unref timer so it doesn't block Node process exit if needed
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const defaultScheduler = new AutoCleanScheduler();
