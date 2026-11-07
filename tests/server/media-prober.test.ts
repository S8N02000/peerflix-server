import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { parseFfprobeOutput } from '../../src/server/services/media-prober.js';
import { createApp } from '../../src/server/app.js';

describe('Media Prober & Audio Remux Service', () => {
  it('should parse ffprobe output of a 4K Remux with DTS and TrueHD audio and multiple subtitles', () => {
    const sampleFfprobeJson = {
      streams: [
        {
          index: 0,
          codec_type: 'video',
          codec_name: 'hevc',
          width: 3840,
          height: 2160
        },
        {
          index: 1,
          codec_type: 'audio',
          codec_name: 'dts',
          channels: 6,
          tags: { language: 'fre', title: 'VFQ DTS-HD MA 5.1' }
        },
        {
          index: 2,
          codec_type: 'audio',
          codec_name: 'truehd',
          channels: 8,
          tags: { language: 'eng', title: 'VO TrueHD Atmos 7.1' }
        },
        {
          index: 3,
          codec_type: 'subtitle',
          codec_name: 'subrip',
          tags: { language: 'fre', title: 'Français Forcé' }
        },
        {
          index: 4,
          codec_type: 'subtitle',
          codec_name: 'subrip',
          tags: { language: 'fre', title: 'Français Complet' }
        }
      ]
    };

    const probe = parseFfprobeOutput(sampleFfprobeJson);

    // Video streams
    expect(probe.videoStreams.length).toBe(1);
    expect(probe.videoStreams[0].codec).toBe('hevc');
    expect(probe.videoStreams[0].width).toBe(3840);
    expect(probe.videoStreams[0].browserSupported).toBe(true);

    // Audio streams
    expect(probe.audioStreams.length).toBe(2);
    expect(probe.audioStreams[0].codec).toBe('dts');
    expect(probe.audioStreams[0].browserSupported).toBe(false);
    expect(probe.audioStreams[0].audioTrackIndex).toBe(0);

    expect(probe.audioStreams[1].codec).toBe('truehd');
    expect(probe.audioStreams[1].browserSupported).toBe(false);
    expect(probe.audioStreams[1].audioTrackIndex).toBe(1);

    // Subtitle streams
    expect(probe.subtitleStreams.length).toBe(2);
    expect(probe.subtitleStreams[0].isTextBased).toBe(true);
    expect(probe.subtitleStreams[0].subTrackIndex).toBe(0);
    expect(probe.subtitleStreams[1].subTrackIndex).toBe(1);

    // needsAudioRemux
    expect(probe.needsAudioRemux).toBe(true);
  });

  it('should mark needsAudioRemux as false for simple MP4 with single AAC track', () => {
    const simpleMp4 = {
      streams: [
        { index: 0, codec_type: 'video', codec_name: 'h264' },
        { index: 1, codec_type: 'audio', codec_name: 'aac', channels: 2 }
      ]
    };

    const probe = parseFfprobeOutput(simpleMp4);
    expect(probe.audioStreams.length).toBe(1);
    expect(probe.audioStreams[0].browserSupported).toBe(true);
    expect(probe.needsAudioRemux).toBe(false);
  });

  it('should handle /probe and /remux error states gracefully when torrent or file not found', async () => {
    const mockStore: any = {
      get: vi.fn().mockReturnValue(null),
      getMetadata: vi.fn().mockReturnValue(undefined),
      getDownloadPath: vi.fn().mockReturnValue('/tmp'),
      list: vi.fn().mockReturnValue([]),
      on: vi.fn()
    };

    const app = createApp({ store: mockStore, enableLogging: false });

    const probeRes = await request(app).get('/torrents/123/probe/0');
    expect(probeRes.status).toBe(404);
    expect(probeRes.body.error).toBe('NotFound');

    const remuxRes = await request(app).get('/torrents/123/remux/0');
    expect(remuxRes.status).toBe(404);
  });

  it('should extract durationSeconds and mark PGS bitmap subtitles as isTextBased: false', () => {
    const pgsSample = {
      format: { duration: '7352.420000' },
      streams: [
        { index: 0, codec_type: 'video', codec_name: 'hevc' },
        { index: 1, codec_type: 'audio', codec_name: 'aac' },
        { index: 2, codec_type: 'subtitle', codec_name: 'hdmv_pgs_subtitle', tags: { language: 'fre' } }
      ]
    };

    const probe = parseFfprobeOutput(pgsSample);
    expect(probe.durationSeconds).toBe(7352.4);
    expect(probe.subtitleStreams.length).toBe(1);
    expect(probe.subtitleStreams[0].codec).toBe('hdmv_pgs_subtitle');
    expect(probe.subtitleStreams[0].isTextBased).toBe(false);
  });
});
