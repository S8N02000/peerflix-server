import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import C411SearchPanel from '../../src/client/components/C411SearchPanel.vue';
import type { C411SearchResultDTO } from '../../src/shared/types.js';

describe('C411SearchPanel.vue Component', () => {
  const sampleResults: C411SearchResultDTO[] = [
    {
      id: 'abc1234567890def',
      title: 'Dexter.Resurrection.2025.S02E02.MULTI.VFF.2160p.WEBRip.HDR10.AAC-WHY',
      size: 4500000000,
      pubDate: '2025-03-03T14:00:00Z',
      seeders: 131,
      leechers: 14,
      completed: 167,
      isFreeleech: true,
      categoryName: 'Séries TV',
      alreadyAdded: false,
      posterUrl: 'https://img.c411.org/covers/dexter_s02.jpg'
    },
    {
      id: 'fed0987654321cba',
      title: 'Inception.2010.MULTI.1080p.BluRay.x264-FRATERNiTY',
      size: 8500000000,
      pubDate: '2025-03-02T10:00:00Z',
      seeders: 55,
      leechers: 2,
      completed: 450,
      isFreeleech: false,
      categoryName: 'Films',
      alreadyAdded: true
    }
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.mock('../../src/client/services/api.js', () => ({
      searchC411: vi.fn().mockResolvedValue({
        results: [
          {
            id: 'abc1234567890def',
            title: 'Dexter.Resurrection.2025.S02E02.MULTI.VFF.2160p.WEBRip.HDR10.AAC-WHY',
            size: 4500000000,
            pubDate: '2025-03-03T14:00:00Z',
            seeders: 131,
            leechers: 14,
            completed: 167,
            isFreeleech: true,
            categoryName: 'Séries TV',
            alreadyAdded: false,
            posterUrl: 'https://img.c411.org/covers/dexter_s02.jpg'
          },
          {
            id: 'fed0987654321cba',
            title: 'Inception.2010.MULTI.1080p.BluRay.x264-FRATERNiTY',
            size: 8500000000,
            pubDate: '2025-03-02T10:00:00Z',
            seeders: 55,
            leechers: 2,
            completed: 450,
            isFreeleech: false,
            categoryName: 'Films',
            alreadyAdded: true
          }
        ]
      }),
      addC411Torrent: vi.fn().mockResolvedValue({ infoHash: 'new_hash_456' }),
      fetchC411Status: vi.fn().mockResolvedValue({ enabled: true })
    }));
  });

  it('renders search input and category pills with colored dots', () => {
    const wrapper = mount(C411SearchPanel, {
      props: {
        c411Profile: { enabled: true },
      },
    });

    expect(wrapper.find('.c411-search-input').exists()).toBe(true);
    const pills = wrapper.findAll('.cat-pill-btn');
    expect(pills.length).toBeGreaterThanOrEqual(8);
    expect(wrapper.text()).toContain('Films & Vidéos');
    expect(wrapper.text()).toContain('Ebook');
    expect(wrapper.text()).toContain('Jeux Vidéo');
    expect(wrapper.text()).toContain('Animation (film)');
    expect(wrapper.text()).toContain('Animation (Série anime)');
  });

  it('renders search results with clean titles, green release names, badges, seeds, leechers, and posters', async () => {
    const wrapper = mount(C411SearchPanel, {
      props: {
        c411Profile: { enabled: true },
      },
    });

    // Wait for onMounted search
    await new Promise((r) => setTimeout(r, 60));

    expect(wrapper.text()).toContain('Dexter');
    expect(wrapper.text()).toContain('2025');
    expect(wrapper.text()).toContain('FREELEECH');
    expect(wrapper.text()).toContain('↑ 131');
    expect(wrapper.text()).toContain('↓ 14');
    expect(wrapper.text()).toContain('4.2 Go');
    expect(wrapper.text()).toContain('167 compl.');

    // Check poster image exists for Dexter
    const posterImg = wrapper.find('img.poster-img');
    expect(posterImg.exists()).toBe(true);
    expect(posterImg.attributes('src')).toBe('https://img.c411.org/covers/dexter_s02.jpg');

    // Check placeholder for Inception (no posterUrl)
    const placeholders = wrapper.findAll('.poster-placeholder');
    expect(placeholders.length).toBeGreaterThanOrEqual(1);

    // Click launch button
    const addBtn = wrapper.find('.btn-add-torrent:not(.added)');
    expect(addBtn.exists()).toBe(true);
    await addBtn.trigger('click');

    await new Promise((r) => setTimeout(r, 60));
    expect(wrapper.emitted('torrent-added')).toBeTruthy();
  });

  it('filters results dynamically by resolution', async () => {
    const wrapper = mount(C411SearchPanel, {
      props: {
        c411Profile: { enabled: true },
      },
    });
    await new Promise((r) => setTimeout(r, 60));

    // Initially both Dexter (2160p) and Inception (1080p) are visible
    expect(wrapper.text()).toContain('Dexter');
    expect(wrapper.text()).toContain('Inception');

    // Select category "Films & Vidéos"
    const filmCat = wrapper.findAll('.cat-pill-btn').find((p) => p.text().includes('Films & Vidéos'));
    expect(filmCat).toBeDefined();
    await filmCat!.trigger('click');
    await new Promise((r) => setTimeout(r, 60));

    // Filter by 2160p
    const resSelect = wrapper.find('select[title="Résolution"]');
    expect(resSelect.exists()).toBe(true);
    // Check both 4K and 2160p are distinct options
    const resOptions = resSelect.findAll('option');
    expect(resOptions.some((o) => o.text() === '4K')).toBe(true);
    expect(resOptions.some((o) => o.text() === '2160p')).toBe(true);

    await resSelect.setValue('2160p');

    expect(wrapper.text()).toContain('Dexter');
    expect(wrapper.text()).not.toContain('Inception');

    // Check season options has up to 100 seasons
    const seasonSelect = wrapper.find('select[title="Saison"]');
    expect(seasonSelect.exists()).toBe(true);
    const seasonOpts = seasonSelect.findAll('option');
    expect(seasonOpts.length).toBe(101); // 1 default + 100 seasons
    expect(seasonOpts[100].text()).toBe('Saison 100');

    // Check subtitles select exists with French, Forced, VOSTFR, etc.
    const subSelect = wrapper.find('select[title="Langue des sous-titres"]');
    expect(subSelect.exists()).toBe(true);
    expect(subSelect.text()).toContain('VOSTFR');
    expect(subSelect.text()).toContain('Français');

    // Active tags bar should display the resolution chip
    expect(wrapper.find('.active-tags-bar').exists()).toBe(true);
    expect(wrapper.text()).toContain('Résolution : 2160P');

    // Click "Tout effacer"
    const clearBtn = wrapper.find('.btn-clear-all');
    await clearBtn.trigger('click');

    expect(wrapper.text()).toContain('Dexter');
    expect(wrapper.text()).toContain('Inception');
  });

  it('allows applying and managing saved presets in localStorage', async () => {
    const wrapper = mount(C411SearchPanel, {
      props: {
        c411Profile: { enabled: true },
      },
    });
    await new Promise((r) => setTimeout(r, 60));

    // Preset bar should exist with initial presets
    const presetChips = wrapper.findAll('.preset-chip');
    expect(presetChips.length).toBeGreaterThanOrEqual(1);

    // Click on Films 4K HDR preset
    const preset4k = presetChips.find((p) => p.text().includes('Films 4K HDR'));
    expect(preset4k).toBeDefined();
    await preset4k!.trigger('click');
    await new Promise((r) => setTimeout(r, 60));

    // Dexter is 2160p, Inception is 1080p
    expect(wrapper.text()).toContain('Dexter');
    expect(wrapper.text()).not.toContain('Inception');
  });

  it('opens C411TorrentDetailsModal when clicking on the Fiche button', async () => {
    const wrapper = mount(C411SearchPanel, {
      props: {
        c411Profile: { enabled: true },
      },
    });
    await new Promise((r) => setTimeout(r, 60));

    const ficheBtns = wrapper.findAll('.btn-view-details');
    expect(ficheBtns.length).toBeGreaterThanOrEqual(1);

    await ficheBtns[0].trigger('click');
    await new Promise((r) => setTimeout(r, 20));

    expect(wrapper.find('.c411-modal-overlay').exists()).toBe(true);
  });
});
