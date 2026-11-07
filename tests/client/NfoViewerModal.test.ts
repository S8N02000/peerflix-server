import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import NfoViewerModal from '../../src/client/components/NfoViewerModal.vue';
import Sha256Modal from '../../src/client/components/Sha256Modal.vue';
import type { TorrentDTO, TorrentFileDTO } from '../../src/shared/types.js';

describe('NfoViewerModal & Sha256Modal Components', () => {
  const mockFile: TorrentFileDTO = {
    index: 0,
    name: 'release.nfo',
    path: 'release.nfo',
    folderPath: '',
    length: 4096,
    category: 'info',
    selected: true,
    isComplete: true,
    streamUrl: '/torrents/1234/files/0',
    downloadUrl: '/torrents/1234/files/0?download=1',
  };

  const mockTorrent: TorrentDTO = {
    infoHash: '1234567890123456789012345678901234567890',
    name: 'Awesome Release',
    length: 1000000,
    category: 'other',
    ready: true,
    interested: true,
    pinned: false,
    addedAt: 1700000000000,
    downloadedPercentage: 100,
    isFullyDownloaded: true,
    progress: [1],
    stats: {
      progress: 1.0,
      downloaded: 1000000,
      uploaded: 0,
      speed: { down: 0, up: 0 },
      peers: { total: 0, unchoked: 0 },
      eta: 0,
    },
    files: [mockFile],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('NfoViewerModal', () => {
    it('fetches and displays decoded ASCII art NFO content', async () => {
      const asciiArt = '  ██████╗ ███████╗███████╗██████╗ \n  ██╔══██╗██╔════╝██╔════╝██╔══██╗';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ name: 'release.nfo', content: asciiArt }),
      } as any);

      const wrapper = mount(NfoViewerModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      expect(wrapper.text()).toContain('release.nfo');
      expect(wrapper.text()).toContain('Décodage du fichier DOS CP437');

      await flushPromises();

      const pre = wrapper.find('.nfo-ascii-box');
      expect(pre.exists()).toBe(true);
      expect(pre.text()).toContain('██████╗');
    });

    it('copies NFO content to clipboard', async () => {
      const asciiArt = 'My NFO Art';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ name: 'release.nfo', content: asciiArt }),
      } as any);

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const wrapper = mount(NfoViewerModal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      await flushPromises();

      const copyBtn = wrapper.find('.btn-copy');
      await copyBtn.trigger('click');

      expect(writeTextMock).toHaveBeenCalledWith(asciiArt);
    });
  });

  describe('Sha256Modal', () => {
    it('fetches and displays SHA-256 integrity hash', async () => {
      const testHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ sha256: testHash }),
      } as any);

      const wrapper = mount(Sha256Modal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      expect(wrapper.text()).toContain('Calcul du hachage SHA-256');

      await flushPromises();

      const hashBox = wrapper.find('.hash-display');
      expect(hashBox.exists()).toBe(true);
      expect(hashBox.text()).toBe(testHash);
    });

    it('copies SHA-256 hash to clipboard', async () => {
      const testHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ sha256: testHash }),
      } as any);

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const wrapper = mount(Sha256Modal, {
        props: {
          file: mockFile,
          torrent: mockTorrent,
        },
      });

      await flushPromises();

      const copyBtn = wrapper.find('.btn-copy');
      await copyBtn.trigger('click');

      expect(writeTextMock).toHaveBeenCalledWith(testHash);
    });
  });
});
