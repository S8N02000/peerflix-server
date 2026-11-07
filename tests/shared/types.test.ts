import { describe, it, expect } from 'vitest';
import type {
  TorrentDTO,
  TorrentFileDTO,
  TorrentStatsDTO,
  ServerDiskStatsDTO,
  FileCategory,
  TorrentCategory,
  SystemStatusDTO
} from '../../src/shared/types.js';

describe('Shared types validation', () => {
  it('should construct a valid TorrentDTO conforming to all interfaces', () => {
    const fileCategory: FileCategory = 'video';
    const torrentCategory: TorrentCategory = 'video';

    const fileDto: TorrentFileDTO = {
      index: 0,
      name: 'movie.mp4',
      path: 'Movies/movie.mp4',
      folderPath: 'Movies',
      length: 1048576,
      selected: true,
      category: fileCategory,
      isComplete: true,
      streamUrl: '/torrents/abc/files/0',
      downloadUrl: '/torrents/abc/files/0?download=1',
      subtitleUrl: '/torrents/abc/subtitles/1'
    };

    const statsDto: TorrentStatsDTO = {
      eta: 120,
      progress: 1,
      downloaded: 1048576,
      uploaded: 0,
      speed: {
        down: 5242880,
        up: 0
      },
      peers: {
        total: 10,
        unchoked: 5
      }
    };

    const diskDto: ServerDiskStatsDTO = {
      totalBytes: 1000000000,
      freeBytes: 500000000,
      usedBytes: 500000000,
      usedPercent: 50
    };

    const systemDto: SystemStatusDTO = {
      disk: diskDto,
      nextCleanAt: '2026-11-09T09:00:00.000Z',
      totalDownSpeed: 5242880
    };

    const torrentDto: TorrentDTO = {
      infoHash: 'abcdef0123456789abcdef0123456789abcdef01',
      name: 'Test Movie',
      length: 1048576,
      ready: true,
      interested: true,
      pinned: false,
      addedAt: Date.now(),
      category: torrentCategory,
      isFullyDownloaded: true,
      downloadedPercentage: 100,
      progress: [1],
      stats: statsDto,
      files: [fileDto]
    };

    expect(torrentDto.infoHash).toHaveLength(40);
    expect(torrentDto.files[0].category).toBe('video');
    expect(systemDto.disk.usedPercent).toBe(50);
  });
});
