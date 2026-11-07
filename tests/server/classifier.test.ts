import { describe, it, expect } from 'vitest';
import {
  classifyFile,
  classifyTorrent,
  isSampleFile,
  shouldSelectFile
} from '../../src/server/services/classifier.js';

describe('Classifier service', () => {
  it('should classify a movie torrent, identify samples, and select movie + subtitles + nfo', () => {
    const movieFiles = [
      { name: 'Movie.2024.1080p.mkv', path: 'Movie.2024.1080p.mkv', length: 2_500_000_000 },
      { name: 'subs.srt', path: 'subs.srt', length: 50_000 },
      { name: 'sample.mkv', path: 'sample.mkv', length: 25_000_000 }, // 25 MB sample
      { name: 'info.nfo', path: 'info.nfo', length: 4_000 }
    ];

    expect(classifyFile('Movie.2024.1080p.mkv')).toBe('video');
    expect(classifyFile('subs.srt')).toBe('subtitle');
    expect(classifyFile('sample.mkv')).toBe('video');
    expect(classifyFile('info.nfo')).toBe('info');

    // Sample identification
    expect(isSampleFile('sample.mkv', 25_000_000)).toBe(true);
    expect(isSampleFile('Movie.2024.1080p.mkv', 2_500_000_000)).toBe(false);

    // Global torrent category
    const category = classifyTorrent(movieFiles);
    expect(category).toBe('video');

    // Selection logic
    expect(shouldSelectFile(category, movieFiles[0])).toBe(true); // Movie
    expect(shouldSelectFile(category, movieFiles[1])).toBe(true); // Subtitle
    expect(shouldSelectFile(category, movieFiles[2])).toBe(false); // Sample ignored
    expect(shouldSelectFile(category, movieFiles[3])).toBe(true); // NFO
  });

  it('should classify a game torrent and select 100% of files', () => {
    const gameFiles = [
      { name: 'setup.exe', path: 'Game/setup.exe', length: 50_000_000 },
      { name: 'fg-01.bin', path: 'Game/fg-01.bin', length: 1_500_000_000 },
      { name: 'fg-02.bin', path: 'Game/fg-02.bin', length: 1_500_000_000 },
      { name: 'steam_api.dll', path: 'Game/crack/steam_api.dll', length: 300_000 }
    ];

    expect(classifyFile('setup.exe')).toBe('executable');
    expect(classifyFile('fg-01.bin')).toBe('executable');
    expect(classifyFile('steam_api.dll')).toBe('executable');

    const category = classifyTorrent(gameFiles);
    expect(category).toBe('game_app');

    // 100% of files must be selected
    gameFiles.forEach((file) => {
      expect(shouldSelectFile(category, file)).toBe(true);
    });
  });

  it('should classify an audio album and select all audio and artwork files', () => {
    const audioFiles = Array.from({ length: 12 }, (_, i) => ({
      name: `track_${i + 1}.flac`,
      path: `Album/track_${i + 1}.flac`,
      length: 30_000_000
    }));
    audioFiles.push({ name: 'cover.jpg', path: 'Album/cover.jpg', length: 500_000 });

    const category = classifyTorrent(audioFiles);
    expect(category).toBe('audio');

    audioFiles.forEach((file) => {
      expect(shouldSelectFile(category, file)).toBe(true);
    });
  });
});
