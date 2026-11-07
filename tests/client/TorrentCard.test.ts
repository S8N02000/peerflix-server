import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TorrentCard from '../../src/client/components/TorrentCard.vue';
import type { TorrentDTO } from '../../src/shared/types.js';

describe('TorrentCard Component', () => {
  const baseTorrent: TorrentDTO = {
    infoHash: '0123456789abcdef0123456789abcdef01234567',
    name: 'Ubuntu 24.04 LTS Desktop amd64',
    length: 5000000000,
    category: 'video',
    ready: true,
    interested: true,
    pinned: false,
    addedAt: 1700000000000,
    downloadedPercentage: 45,
    isFullyDownloaded: false,
    progress: [1, 0, 1, 0],
    stats: {
      progress: 0.45,
      downloaded: 2250000000,
      uploaded: 0,
      speed: {
        down: 5242880, // 5 MB/s
        up: 0,
      },
      peers: {
        total: 25,
        unchoked: 12,
      },
      eta: 520,
    },
    files: [
      {
        index: 0,
        name: 'ubuntu-sample.mkv',
        path: 'ubuntu-sample.mkv',
        folderPath: '',
        length: 20000000,
        category: 'video',
        isComplete: false,
        selected: false,
        streamUrl: '/torrents/0123456789abcdef0123456789abcdef01234567/files/0',
        downloadUrl: '/torrents/0123456789abcdef0123456789abcdef01234567/files/0?download=1',
      },
      {
        index: 1,
        name: 'ubuntu-movie.mkv',
        path: 'ubuntu-movie.mkv',
        folderPath: '',
        length: 4980000000,
        category: 'video',
        isComplete: false,
        selected: true,
        streamUrl: '/torrents/0123456789abcdef0123456789abcdef01234567/files/1',
        downloadUrl: '/torrents/0123456789abcdef0123456789abcdef01234567/files/1?download=1',
      },
    ],
  };

  it('renders progress, download speed, and unchoked peers count', () => {
    const wrapper = mount(TorrentCard, {
      props: {
        torrent: baseTorrent,
        hideJunkFiles: false,
      },
    });

    expect(wrapper.text()).toContain('Ubuntu 24.04 LTS Desktop amd64');
    expect(wrapper.text()).toContain('45%');
    expect(wrapper.text()).toContain('5 Mo/s');
    expect(wrapper.text()).toContain('12/25 pairs');
    expect(wrapper.find('.badge-ready').exists()).toBe(false);
  });

  it('displays 100% Ready badge when isFullyDownloaded is true', () => {
    const fullyDownloadedTorrent: TorrentDTO = {
      ...baseTorrent,
      downloadedPercentage: 100,
      isFullyDownloaded: true,
      stats: {
        ...baseTorrent.stats,
        downloaded: baseTorrent.length,
        speed: { down: 0, up: 0 },
        eta: 0,
      },
    };

    const wrapper = mount(TorrentCard, {
      props: {
        torrent: fullyDownloadedTorrent,
        hideJunkFiles: false,
      },
    });

    const readyBadge = wrapper.find('.badge-ready');
    expect(readyBadge.exists()).toBe(true);
    expect(readyBadge.text()).toContain('100% Prêt sur le serveur');
  });

  it('emits toggle-pin when pin button is clicked', async () => {
    const wrapper = mount(TorrentCard, {
      props: {
        torrent: baseTorrent,
        hideJunkFiles: false,
      },
    });

    const pinBtn = wrapper.find('.btn-pin');
    expect(pinBtn.exists()).toBe(true);
    expect(pinBtn.classes()).not.toContain('pinned');

    await pinBtn.trigger('click');

    expect(wrapper.emitted('toggle-pin')).toBeTruthy();
    expect(wrapper.emitted('toggle-pin')![0]).toEqual([baseTorrent.infoHash]);
  });

  it('renders video watch button for video torrents and emits play-media for main file', async () => {
    const wrapper = mount(TorrentCard, {
      props: {
        torrent: baseTorrent,
        hideJunkFiles: false,
      },
    });

    const playBtn = wrapper.find('.btn-main-action.play');
    expect(playBtn.exists()).toBe(true);
    expect(playBtn.text()).toContain('Regarder');

    // Both Regarder and ZIP are available on video torrents
    const zipBtn = wrapper.find('.btn-main-action.download-zip');
    expect(zipBtn.exists()).toBe(true);

    await playBtn.trigger('click');

    expect(wrapper.emitted('play-media')).toBeTruthy();
    const emitted = wrapper.emitted('play-media')![0] as any[];
    expect(emitted[0].name).toBe('ubuntu-movie.mkv');
    expect(emitted[1].infoHash).toBe(baseTorrent.infoHash);
  });

  it('renders ZIP download button for non-video torrents (game_app, archive, etc.)', () => {
    const gameTorrent: TorrentDTO = {
      ...baseTorrent,
      category: 'game_app',
      files: [
        {
          index: 0,
          name: 'setup.exe',
          path: 'setup.exe',
          folderPath: '',
          length: 5000000000,
          category: 'executable',
          isComplete: false,
          selected: true,
          streamUrl: '/torrents/0123456789abcdef0123456789abcdef01234567/files/0',
          downloadUrl: '/torrents/0123456789abcdef0123456789abcdef01234567/files/0?download=1',
        },
      ],
    };

    const wrapper = mount(TorrentCard, {
      props: {
        torrent: gameTorrent,
        hideJunkFiles: false,
      },
    });

    expect(wrapper.find('.btn-main-action.play').exists()).toBe(false);
    const zipBtn = wrapper.find('.btn-main-action.download-zip');
    expect(zipBtn.exists()).toBe(true);
    expect(zipBtn.attributes('href')).toBe(`/torrents/${gameTorrent.infoHash}/archive`);
    expect(zipBtn.text()).toContain('Télécharger tout (.zip)');
  });

  it('renders quick NFO button when torrent contains an info file and emits preview-nfo', async () => {
    const torrentWithNfo: TorrentDTO = {
      ...baseTorrent,
      files: [
        ...baseTorrent.files,
        {
          index: 2,
          name: 'release.nfo',
          path: 'release.nfo',
          folderPath: '',
          length: 2048,
          category: 'info',
          isComplete: true,
          selected: true,
          streamUrl: '/torrents/123/files/2',
          downloadUrl: '/torrents/123/files/2?download=1',
        },
      ],
    };

    const wrapper = mount(TorrentCard, {
      props: {
        torrent: torrentWithNfo,
        hideJunkFiles: false,
      },
    });

    const nfoBtn = wrapper.find('.btn-nfo-quick');
    expect(nfoBtn.exists()).toBe(true);
    expect(nfoBtn.text()).toContain('Lire le .NFO');

    await nfoBtn.trigger('click');
    expect(wrapper.emitted('preview-nfo')).toBeTruthy();
  });

  it('copies all download links to clipboard when copy links button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const wrapper = mount(TorrentCard, {
      props: {
        torrent: baseTorrent,
        hideJunkFiles: false,
      },
    });

    const copyBtn = wrapper.find('.btn-copy-links');
    expect(copyBtn.exists()).toBe(true);
    expect(copyBtn.text()).toContain('Copier liens (JDownloader / IDM)');

    await copyBtn.trigger('click');

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain(baseTorrent.files[1].downloadUrl);
  });
});
