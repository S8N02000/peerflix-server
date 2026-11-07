import { describe, it, expect, vi } from 'vitest';
import { useTorrents } from '../../src/client/composables/useTorrents.js';
import type { TorrentDTO } from '../../src/shared/types.js';

describe('useTorrents Composable', () => {
  const createMockTorrent = (
    infoHash: string,
    name: string,
    category: any,
    files: string[] = []
  ): TorrentDTO => ({
    infoHash,
    name,
    length: 1000,
    ready: true,
    interested: true,
    pinned: false,
    addedAt: 1,
    category,
    isFullyDownloaded: false,
    downloadedPercentage: 0,
    progress: [0],
    stats: {
      eta: 0,
      progress: 0,
      downloaded: 0,
      uploaded: 0,
      speed: { down: 0, up: 0 },
      peers: { total: 0, unchoked: 0 }
    },
    files: files.map((fileName, idx) => ({
      index: idx,
      name: fileName,
      path: fileName,
      folderPath: '',
      length: 100,
      selected: true,
      category: 'video',
      isComplete: false,
      streamUrl: '',
      downloadUrl: ''
    }))
  });

  it('should filter torrents by category and text search accurately', () => {
    const { torrents, searchQuery, selectedCategory, filteredTorrents } = useTorrents();

    torrents.value = [
      createMockTorrent('hash1', 'Dune Movie 2024', 'video', ['dune.mkv']),
      createMockTorrent('hash2', 'Cyberpunk 2077', 'game_app', ['setup.exe']),
      createMockTorrent('hash3', 'Daft Punk Discovery', 'audio', ['one_more_time.flac']),
      createMockTorrent('hash4', 'Documents Backup', 'archive', ['data.zip'])
    ];

    expect(filteredTorrents.value.length).toBe(4);

    // Filter by video
    selectedCategory.value = 'video';
    expect(filteredTorrents.value.length).toBe(1);
    expect(filteredTorrents.value[0].infoHash).toBe('hash1');

    // Filter by game_app
    selectedCategory.value = 'game_app';
    expect(filteredTorrents.value.length).toBe(1);
    expect(filteredTorrents.value[0].infoHash).toBe('hash2');

    // Filter by archive_other
    selectedCategory.value = 'archive_other';
    expect(filteredTorrents.value.length).toBe(1);
    expect(filteredTorrents.value[0].infoHash).toBe('hash4');

    // Reset category and search text
    selectedCategory.value = 'all';
    searchQuery.value = 'punk';
    expect(filteredTorrents.value.length).toBe(2); // Cyberpunk & Daft Punk

    // Search by inner file name
    searchQuery.value = 'setup.exe';
    expect(filteredTorrents.value.length).toBe(1);
    expect(filteredTorrents.value[0].name).toBe('Cyberpunk 2077');
  });

  it('should reactively update torrent stats and downloaded percentage on progress events', () => {
    const { torrents } = useTorrents();
    const mock = createMockTorrent('hash1', 'Test Movie', 'video');
    torrents.value = [mock];

    // Simulate incoming stats mutation
    const torrent = torrents.value[0];
    torrent.stats.progress = 0.75;
    torrent.stats.speed.down = 2048000;
    torrent.downloadedPercentage = Math.round(torrent.stats.progress * 100);

    expect(torrent.downloadedPercentage).toBe(75);
    expect(torrent.stats.speed.down).toBe(2048000);

    // Complete to 100%
    torrent.stats.progress = 1.0;
    torrent.isFullyDownloaded = true;
    torrent.downloadedPercentage = 100;

    expect(torrent.isFullyDownloaded).toBe(true);
    expect(torrent.downloadedPercentage).toBe(100);
  });
});
