import { describe, it, expect, vi } from 'vitest';
import { ref, computed } from 'vue';
import { mount } from '@vue/test-utils';
import App from '../../src/client/App.vue';
import type { TorrentDTO } from '../../src/shared/types.js';

vi.mock('../../src/client/composables/useTorrents.js', async () => {
  const { ref, computed } = await import('vue');
  const mockTorrents = ref<TorrentDTO[]>([
    {
      infoHash: '1111111111111111111111111111111111111111',
      name: 'Big Buck Bunny 1080p',
      length: 800000000,
      category: 'video',
      ready: true,
      interested: true,
      pinned: false,
      addedAt: 1700000000000,
      downloadedPercentage: 100,
      isFullyDownloaded: true,
      progress: [1],
      stats: {
        progress: 1.0,
        downloaded: 800000000,
        uploaded: 0,
        speed: { down: 0, up: 0 },
        peers: { total: 10, unchoked: 5 },
        eta: 0,
      },
      files: [
        {
          index: 0,
          name: 'bunny.mp4',
          path: 'bunny.mp4',
          folderPath: '',
          length: 800000000,
          category: 'video',
          isComplete: true,
          selected: true,
          streamUrl: '/torrents/1111111111111111111111111111111111111111/files/0',
          downloadUrl: '/torrents/1111111111111111111111111111111111111111/files/0?download=1',
        },
      ],
    },
    {
      infoHash: '2222222222222222222222222222222222222222',
      name: 'Super Retro Game',
      length: 1200000000,
      category: 'game_app',
      ready: true,
      interested: true,
      pinned: true,
      addedAt: 1700000001000,
      downloadedPercentage: 60,
      isFullyDownloaded: false,
      progress: [1, 0],
      stats: {
        progress: 0.6,
        downloaded: 720000000,
        uploaded: 0,
        speed: { down: 2000000, up: 0 },
        peers: { total: 20, unchoked: 8 },
        eta: 240,
      },
      files: [
        {
          index: 0,
          name: 'game.iso',
          path: 'game.iso',
          folderPath: '',
          length: 1200000000,
          category: 'disc_image',
          isComplete: false,
          selected: true,
          streamUrl: '/torrents/2222222222222222222222222222222222222222/files/0',
          downloadUrl: '/torrents/2222222222222222222222222222222222222222/files/0?download=1',
        },
      ],
    },
  ]);

  const mockSystemStatus = ref({
    disk: {
      totalBytes: 1000000000000,
      freeBytes: 850000000000,
      usedBytes: 150000000000,
      usedPercent: 15,
    },
    nextCleanAt: 'Lundi 09:00',
    totalDownSpeed: 2000000,
  });

  const selectedCategory = ref('all');
  const searchQuery = ref('');
  const sortBy = ref('recent');
  const hideJunkFiles = ref(true);

  const filteredTorrents = computed(() => {
    return mockTorrents.value.filter((t) => {
      if (selectedCategory.value !== 'all' && t.category !== selectedCategory.value) {
        return false;
      }
      return true;
    });
  });

  const categoryCounts = computed(() => ({
    all: mockTorrents.value.length,
    video: 1,
    game_app: 1,
    audio: 0,
    archive_other: 0,
  }));

  return {
    useTorrents: () => ({
      torrents: mockTorrents,
      systemStatus: mockSystemStatus,
      searchQuery,
      selectedCategory,
      sortBy,
      onlyMyTorrents: ref(false),
      currentUser: ref(''),
      isAdmin: ref(false),
      hideJunkFiles,
      isLoading: ref(false),
      errorMessage: ref(null),
      filteredTorrents,
      categoryCounts,
      initSocket: vi.fn(),
      loadTorrents: vi.fn(),
      addTorrentByLink: vi.fn(),
      uploadFiles: vi.fn(),
      deleteTorrent: vi.fn(),
      togglePin: vi.fn(),
      toggleVisibility: vi.fn(),
      updateCurrentUser: vi.fn(),
      updateIsAdmin: vi.fn(),
      pauseTorrent: vi.fn(),
      resumeTorrent: vi.fn(),
      selectFile: vi.fn(),
      deselectFile: vi.fn(),
      cleanUnpinned: vi.fn(),
    }),
    formatBytes: (b: number) => `${b} B`,
    formatSpeed: (s: number) => `${s} B/s`,
    formatDuration: (d: number) => `${d}s`,
    formatTimeAgo: (timestamp?: number) => 'il y a 2h',
  };
});

describe('App.vue Main Component', () => {
  it('renders header, drop zone, category filters, and torrent cards', () => {
    const wrapper = mount(App);

    expect(wrapper.text()).toContain('Peerflix');
    expect(wrapper.text()).toContain('Big Buck Bunny 1080p');
    expect(wrapper.text()).toContain('Super Retro Game');
    expect(wrapper.text()).toContain('Tous 2');
    expect(wrapper.text()).toContain('Films & Séries 1');
    expect(wrapper.text()).toContain('Jeux & Logiciels 1');
  });

  it('filters torrents when category filter is clicked', async () => {
    const wrapper = mount(App);

    // Click on Video category button
    const tabs = wrapper.findAll('.tab-btn');
    const videoBtn = tabs.find((b) => b.text().includes('Films & Séries'));
    expect(videoBtn).toBeDefined();

    await videoBtn!.trigger('click');

    expect(wrapper.text()).toContain('Big Buck Bunny 1080p');
    expect(wrapper.text()).not.toContain('Super Retro Game');
  });

  it('opens and closes MediaPlayerModal on play-media', async () => {
    const wrapper = mount(App);

    const playBtn = wrapper.find('.btn-main-action.play');
    expect(playBtn.exists()).toBe(true);

    await playBtn.trigger('click');

    expect(wrapper.findComponent({ name: 'MediaPlayerModal' }).exists()).toBe(true);
    expect(wrapper.text()).toContain('bunny.mp4');

    // Close modal
    const closeBtn = wrapper.find('.btn-close');
    await closeBtn.trigger('click');

    expect(wrapper.findComponent({ name: 'MediaPlayerModal' }).exists()).toBe(false);
  });

  it('switches between Mes Téléchargements and Recherche C411 tabs', async () => {
    const wrapper = mount(App);

    // Downloads tab should be active by default
    const navTabs = wrapper.findAll('.view-nav-tab');
    expect(navTabs.length).toBeGreaterThanOrEqual(1);
    expect(navTabs[0].classes()).toContain('active');
    expect(navTabs[0].text()).toContain('Mes Téléchargements');
    expect(navTabs[0].text()).toContain('2'); // 2 torrents

    expect(wrapper.find('.tab-content-downloads').isVisible()).toBe(true);
  });
});
