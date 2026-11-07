import { describe, it, expect, vi } from 'vitest';
import { DiskMonitor } from '../../src/server/services/disk-monitor.js';

describe('DiskMonitor Service', () => {
  it('should retrieve real disk stats using statfs', async () => {
    const monitor = new DiskMonitor(process.cwd());
    const stats = await monitor.getDiskStats();

    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.freeBytes).toBeGreaterThan(0);
    expect(stats.usedPercent).toBeGreaterThanOrEqual(0);
    expect(stats.usedPercent).toBeLessThanOrEqual(100);
  });

  it('should accept a 5 GB torrent when 50 GB are free with 2 GB margin', async () => {
    const monitor = new DiskMonitor('/mock/path', 2048); // 2048 MB = 2 GB margin

    // Mock getDiskStats to simulate 50 GB free, 100 GB total
    vi.spyOn(monitor, 'getDiskStats').mockResolvedValue({
      totalBytes: 100 * 1024 * 1024 * 1024,
      freeBytes: 50 * 1024 * 1024 * 1024,
      usedBytes: 50 * 1024 * 1024 * 1024,
      usedPercent: 50
    });

    const fiveGb = 5 * 1024 * 1024 * 1024;
    const result = await monitor.canFitTorrent(fiveGb);

    expect(result.allowed).toBe(true);
    expect(result.freeBytes).toBe(50 * 1024 * 1024 * 1024);
  });

  it('should reject an 80 GB torrent when only 20 GB are free', async () => {
    const monitor = new DiskMonitor('/mock/path', 2048);

    vi.spyOn(monitor, 'getDiskStats').mockResolvedValue({
      totalBytes: 100 * 1024 * 1024 * 1024,
      freeBytes: 20 * 1024 * 1024 * 1024,
      usedBytes: 80 * 1024 * 1024 * 1024,
      usedPercent: 80
    });

    const eightyGb = 80 * 1024 * 1024 * 1024;
    const result = await monitor.canFitTorrent(eightyGb);

    expect(result.allowed).toBe(false);
  });

  it('should enforce MAX_DISK_QUOTA_GB on Peerflix used storage, regardless of host used disk', async () => {
    // 200 GB quota, host has 380 GB used by other apps, but Peerflix only has 150 GB used, 500 GB free disk
    const monitor = new DiskMonitor('/mock/path', 2048, 200);

    vi.spyOn(monitor, 'getDiskStats').mockResolvedValue({
      totalBytes: 1000 * 1024 * 1024 * 1024,
      freeBytes: 500 * 1024 * 1024 * 1024,
      usedBytes: 380 * 1024 * 1024 * 1024, // Host OS & other apps
      usedPercent: 38,
      peerflixUsedBytes: 150 * 1024 * 1024 * 1024, // Peerflix downloads only
      maxQuotaBytes: 200 * 1024 * 1024 * 1024,
      quotaPercent: 75
    });

    // 40 GB torrent -> Peerflix uses 150 + 40 = 190 GB <= 200 GB -> Allowed
    const fortyGb = 40 * 1024 * 1024 * 1024;
    const resAllowed = await monitor.canFitTorrent(fortyGb);
    expect(resAllowed.allowed).toBe(true);

    // 60 GB torrent -> Peerflix uses 150 + 60 = 210 GB > 200 GB -> Rejected by quota
    const sixtyGb = 60 * 1024 * 1024 * 1024;
    const resRejected = await monitor.canFitTorrent(sixtyGb);
    expect(resRejected.allowed).toBe(false);
    expect(resRejected.reason).toBe('PEERFLIX_QUOTA_EXCEEDED');
  });
});
