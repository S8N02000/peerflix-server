import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import MediaPlayerModal from '../../src/client/components/MediaPlayerModal.vue';
import QrCodeModal from '../../src/client/components/QrCodeModal.vue';
import type { TorrentDTO, TorrentFileDTO } from '../../src/shared/types.js';

describe('MediaPlayerModal & QrCodeModal Components', () => {
  const mockFile: TorrentFileDTO = {
    index: 0,
    name: 'Inception.2010.1080p.mkv',
    path: 'Inception.2010.1080p.mkv',
    folderPath: '',
    length: 2500000000,
    category: 'video',
    selected: true,
    isComplete: false,
    streamUrl: '/torrents/1234567890123456789012345678901234567890/files/0',
    downloadUrl: '/torrents/1234567890123456789012345678901234567890/files/0?download=1',
    subtitleUrl: '/torrents/1234567890123456789012345678901234567890/subtitles/subs.srt',
  };

  const mockTorrent: TorrentDTO = {
    infoHash: '1234567890123456789012345678901234567890',
    name: 'Inception 2010',
    length: 2500000000,
    category: 'video',
    ready: true,
    interested: true,
    pinned: false,
    addedAt: 1700000000000,
    downloadedPercentage: 50,
    isFullyDownloaded: false,
    progress: [1, 0],
    stats: {
      progress: 0.5,
      downloaded: 1250000000,
      uploaded: 0,
      speed: { down: 1000000, up: 0 },
      peers: { total: 10, unchoked: 5 },
      eta: 1200,
    },
    files: [mockFile],
  };

  describe('MediaPlayerModal', () => {
    it('renders video element with streamUrl, x-webkit-airplay, and subtitle track', () => {
      const wrapper = mount(MediaPlayerModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      expect(wrapper.text()).toContain('Inception.2010.1080p.mkv');
      const video = wrapper.find('video');
      expect(video.exists()).toBe(true);
      expect(video.attributes('src')).toBe(mockFile.streamUrl);
      expect(video.attributes('x-webkit-airplay')).toBe('allow');

      const track = wrapper.find('track');
      expect(track.exists()).toBe(true);
      expect(track.attributes('src')).toBe(mockFile.subtitleUrl);
    });

    it('renders VLC M3U download link in header', () => {
      const wrapper = mount(MediaPlayerModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      const vlcBtn = wrapper.find('.btn-action-icon.btn-vlc');
      expect(vlcBtn.exists()).toBe(true);
      expect(vlcBtn.attributes('href')).toBe(`/torrents/${mockTorrent.infoHash}/files/${mockFile.index}/vlc.m3u`);
    });

    it('renders audio track selector when probe returns multiple or DTS audio tracks', async () => {
      const probeData = {
        videoStreams: [{ index: 0, codec: 'hevc', width: 3840, height: 2160, browserSupported: true }],
        audioStreams: [
          { index: 1, audioTrackIndex: 0, codec: 'dts', channels: 6, language: 'fre', title: 'VFQ', browserSupported: false },
          { index: 2, audioTrackIndex: 1, codec: 'truehd', channels: 8, language: 'eng', title: 'VO', browserSupported: false }
        ],
        subtitleStreams: [],
        needsAudioRemux: true
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(probeData)
      } as any);

      const wrapper = mount(MediaPlayerModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      // Wait for fetch probe
      await new Promise((r) => setTimeout(r, 50));

      const selector = wrapper.find('.select-audio');
      expect(selector.exists()).toBe(true);
      expect(selector.text()).toContain('VFQ');
      expect(selector.text()).toContain('VO');
      expect(wrapper.text()).toContain('Audio : Conversion AAC auto ✓');

      // Change audio track to track 1
      await selector.setValue(1);
      const video = wrapper.find('video');
      expect(video.attributes('src')).toContain('audioTrack=1');
    });

    it('shows codec error overlay when video emits error', async () => {
      const wrapper = mount(MediaPlayerModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      expect(wrapper.find('.codec-error-overlay').exists()).toBe(false);

      const video = wrapper.find('video');
      await video.trigger('error');

      expect(wrapper.find('.codec-error-overlay').exists()).toBe(true);
      expect(wrapper.text()).toContain('Format vidéo non lisible dans ce navigateur');
      expect(wrapper.find('.btn-codec-action.vlc').exists()).toBe(true);
    });

    it('emits close when close button or Escape key is pressed', async () => {
      const wrapper = mount(MediaPlayerModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      const closeBtn = wrapper.find('.btn-close');
      await closeBtn.trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(wrapper.emitted('close')!.length).toBe(2);
    });

    it('emits open-qr when QR button is clicked', async () => {
      const wrapper = mount(MediaPlayerModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      const qrBtn = wrapper.find('.btn-qr');
      await qrBtn.trigger('click');
      expect(wrapper.emitted('open-qr')).toBeTruthy();
    });
  });

  describe('QrCodeModal', () => {
    it('renders canvas and input with full stream url', () => {
      const wrapper = mount(QrCodeModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      expect(wrapper.find('canvas').exists()).toBe(true);
      const input = wrapper.find('input');
      expect(input.exists()).toBe(true);
      expect(input.element.value).toContain(mockFile.streamUrl);
    });

    it('copies url to clipboard on copy button click', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const wrapper = mount(QrCodeModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      const copyBtn = wrapper.find('.btn-copy');
      await copyBtn.trigger('click');

      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining(mockFile.streamUrl));
    });
  });
});
