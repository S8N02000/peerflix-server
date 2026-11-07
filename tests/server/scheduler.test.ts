import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoCleanScheduler } from '../../src/server/services/scheduler.js';

describe('AutoCleanScheduler Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should accurately calculate next Monday 09:00:00', () => {
    const scheduler = new AutoCleanScheduler({
      enabled: true,
      targetDay: 1, // Monday
      targetHour: 9,
      targetMinute: 0
    });

    // Sunday Nov 8 2026, 15:30:00 -> Next clean is Monday Nov 9 2026, 09:00:00
    const sundayDate = new Date(2026, 10, 8, 15, 30, 0); // Month is 0-indexed: 10 = Nov
    const nextClean = scheduler.getNextCleanDate(sundayDate);

    expect(nextClean.getDay()).toBe(1); // Monday
    expect(nextClean.getHours()).toBe(9);
    expect(nextClean.getMinutes()).toBe(0);
    expect(nextClean.getDate()).toBe(9);

    // Monday Nov 9 2026, 08:30:00 -> Next clean is today (Monday) at 09:00:00
    const mondayMorningDate = new Date(2026, 10, 9, 8, 30, 0);
    const nextCleanMorning = scheduler.getNextCleanDate(mondayMorningDate);
    expect(nextCleanMorning.getDate()).toBe(9);
    expect(nextCleanMorning.getHours()).toBe(9);

    // Monday Nov 9 2026, 10:00:00 (past 9am) -> Next clean is next Monday Nov 16
    const mondayAfternoonDate = new Date(2026, 10, 9, 10, 0, 0);
    const nextCleanAfternoon = scheduler.getNextCleanDate(mondayAfternoonDate);
    expect(nextCleanAfternoon.getDate()).toBe(16);
    expect(nextCleanAfternoon.getHours()).toBe(9);
  });

  it('should delete only unpinned torrents when triggered at Monday 09:00:00', async () => {
    // Set system time to Sunday 20:00:00
    const sundayEvening = new Date(2026, 10, 8, 20, 0, 0);
    vi.setSystemTime(sundayEvening);

    const scheduler = new AutoCleanScheduler({
      enabled: true,
      targetDay: 1,
      targetHour: 9,
      targetMinute: 0
    });

    // Mock store with 3 torrents (2 unpinned, 1 pinned)
    const mockMetadata = [
      { infoHash: 'hash1_unpinned', pinned: false, addedAt: 1 },
      { infoHash: 'hash2_pinned', pinned: true, addedAt: 2 },
      { infoHash: 'hash3_unpinned', pinned: false, addedAt: 3 }
    ];

    const removedHashes: string[] = [];
    const mockStore: any = {
      listMetadata: vi.fn(() => [...mockMetadata]),
      remove: vi.fn(async (hash: string) => {
        removedHashes.push(hash);
        const idx = mockMetadata.findIndex((m) => m.infoHash === hash);
        if (idx !== -1) mockMetadata.splice(idx, 1);
      }),
      getDownloadPath: vi.fn(() => '/tmp/torrent-stream')
    };

    scheduler.start(mockStore);

    // Fast-forward time to Monday 09:00:01 (13 hours later)
    await vi.advanceTimersByTimeAsync(13 * 60 * 60 * 1000 + 1000);

    // Only unpinned torrents should have been removed
    expect(removedHashes).toContain('hash1_unpinned');
    expect(removedHashes).toContain('hash3_unpinned');
    expect(removedHashes).not.toContain('hash2_pinned');
    expect(mockMetadata.length).toBe(1);
    expect(mockMetadata[0].infoHash).toBe('hash2_pinned');

    scheduler.stop();
  });
});
