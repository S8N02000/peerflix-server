<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { C411SearchResultDTO, C411ProfileDTO, C411SavedFilter } from '../../shared/types.js';
import { searchC411, addC411Torrent } from '../services/api.js';
import { formatBytes } from '../composables/useTorrents.js';
import { parseReleaseMetadata } from '../utils/release-parser.js';
import C411TorrentDetailsModal from './C411TorrentDetailsModal.vue';
import C411ResultRow from './c411/C411ResultRow.vue';
import {
  C411_STORAGE_PRESETS_KEY,
  C411_CATEGORIES as categories,
  C411_SUBCAT_OPTIONS_MAP as subCatOptionsMap,
  C411_RESOLUTION_OPTIONS as resolutionOptions,
  C411_VIDEO_SOURCE_OPTIONS as videoSourceOptions,
  C411_HDR_OPTIONS as hdrOptions,
  C411_AUDIO_OPTIONS as audioOptions,
  C411_CODEC_OPTIONS as codecOptions,
  C411_VIDEO_LANGUAGE_OPTIONS as videoLanguageOptions,
  C411_SUBTITLE_OPTIONS as subtitleOptions,
  C411_SEASON_OPTIONS as seasonOptions,
  C411_YEAR_OPTIONS as yearOptions,
  C411_EBOOK_FORMAT_OPTIONS as ebookFormatOptions,
  C411_GENERAL_LANGUAGE_OPTIONS as generalLanguageOptions,
  C411_AUDIO_FORMAT_OPTIONS as audioFormatOptions,
  C411_AUDIO_SOURCE_OPTIONS as audioSourceOptions,
  C411_PRINT3D_FORMAT_OPTIONS as print3dFormatOptions,
  C411_DEFAULT_PRESETS,
} from '../utils/c411-constants.js';

const props = defineProps<{
  c411Profile?: C411ProfileDTO | null;
  activeHashes?: Set<string>;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'torrent-added', infoHash: string): void;
}>();

// Torrent Details Modal state
const selectedItemForModal = ref<C411SearchResultDTO | null>(null);
const isDetailsModalOpen = ref(false);

const openDetailsModal = (item: C411SearchResultDTO) => {
  selectedItemForModal.value = item;
  isDetailsModalOpen.value = true;
};

const closeDetailsModal = () => {
  isDetailsModalOpen.value = false;
};

// Main Search & Server Query State
const searchQuery = ref('');
const selectedCat = ref('');
const sortBy = ref<'age' | 'seeders' | 'leechers' | 'size' | 'title'>('age');
const rawResults = ref<C411SearchResultDTO[]>([]);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const addingId = ref<string | null>(null);
const addedIds = ref<Set<string>>(new Set());

// XXX Category access rights
const canAccessXxx = computed(() => {
  const mode = props.c411Profile?.xxxAccess || 'admin';
  if (mode === 'none') return false;
  if (mode === 'all') return true;
  return Boolean(props.isAdmin);
});

const visibleCategories = computed(() => {
  return categories.filter((c: any) => !c.isXxx || canAccessXxx.value);
});

// Multi-Dimension Filters
const filterSubCat = ref('');
const filterSeason = ref('');
const filterResolution = ref('');
const filterLanguage = ref('');
const filterSubtitles = ref('');
const filterSource = ref('');
const filterHdr = ref('');
const filterAudio = ref('');
const filterCodec = ref('');
const filterYear = ref('');
const filterFormat = ref('');
const filterTeam = ref('');
const filterUploader = ref('');
const filterExclusives = ref(false);
const filterPalliative = ref(false);

// Preset filters saved in localStorage
const savedPresets = ref<C411SavedFilter[]>([]);
const showPresetModal = ref(false);
const presetNameInput = ref('');
const STORAGE_PRESETS_KEY = C411_STORAGE_PRESETS_KEY;

// Image load tracking
const brokenImages = ref<Set<string>>(new Set());

const currentSubCatOptions = computed(() => {
  return subCatOptionsMap[selectedCat.value] || [];
});

// Metadata cache
const metaCache = new Map<string, ReturnType<typeof parseReleaseMetadata>>();
const getMeta = (item: C411SearchResultDTO) => {
  let m = metaCache.get(item.title);
  if (!m) {
    m = parseReleaseMetadata(item.title);
    metaCache.set(item.title, m);
  }
  return m;
};

// API Search with dynamic parameters
const performSearch = async () => {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const apiFilters: Record<string, string> = {};
    if (filterSubCat.value) apiFilters.subcat = filterSubCat.value;
    if (filterResolution.value) apiFilters.resolution = filterResolution.value;
    if (filterLanguage.value) apiFilters.lang = filterLanguage.value;
    if (filterSubtitles.value) apiFilters.subtitles = filterSubtitles.value;
    if (filterSource.value) apiFilters.source = filterSource.value;
    if (filterHdr.value) apiFilters.hdr = filterHdr.value;
    if (filterAudio.value) apiFilters.audioType = filterAudio.value;
    if (filterCodec.value) apiFilters.codec = filterCodec.value;
    if (filterYear.value && !filterYear.value.includes('<') && !filterYear.value.includes('-')) {
      apiFilters.year = filterYear.value;
    }
    if (filterTeam.value.trim()) apiFilters.team = filterTeam.value.trim();
    if (filterUploader.value.trim()) apiFilters.uploader = filterUploader.value.trim();

    const res = await searchC411(searchQuery.value, selectedCat.value, apiFilters);
    rawResults.value = res.results;
  } catch (err: any) {
    errorMessage.value = err.message || 'Échec de la recherche C411';
  } finally {
    isLoading.value = false;
  }
};

const isCategoryActive = (c: { cat: string; subcat?: string }) => {
  if (c.cat !== selectedCat.value) return false;
  if (c.subcat) {
    return filterSubCat.value === c.subcat;
  }
  if (c.cat === '1') {
    return !filterSubCat.value;
  }
  return true;
};

const selectCategory = (cat: string, subcat?: string) => {
  if (cat === '8' && !canAccessXxx.value) {
    return;
  }
  selectedCat.value = cat;
  filterSubCat.value = subcat || '';
  filterFormat.value = '';
  performSearch();
};

const onFilterChange = () => {
  performSearch();
};

const handleAdd = async (item: C411SearchResultDTO, isPrivate: boolean = false) => {
  if (item.alreadyAdded || addedIds.value.has(item.id)) return;
  addingId.value = item.id;
  try {
    const res = await addC411Torrent(item.id, { isPrivate });
    addedIds.value.add(item.id);
    emit('torrent-added', res.infoHash);
  } catch (err: any) {
    alert(err.message || "Erreur lors de l'ajout du torrent");
  } finally {
    addingId.value = null;
  }
};

const handleAddFromModal = async (id: string, isPrivate: boolean = false) => {
  const item = rawResults.value.find((r) => r.id === id) || selectedItemForModal.value;
  if (item) {
    await handleAdd(item, isPrivate);
  }
};

// Filtering logic (0ms instant response)
const filteredResults = computed(() => {
  return rawResults.value.filter((item) => {
    const meta = getMeta(item);

    // Sous-catégorie
    if (filterSubCat.value) {
      const targetSub = filterSubCat.value;
      const matchCat =
        (item.subcategoryId && item.subcategoryId === targetSub) ||
        (item.subcategoryName && item.subcategoryName.toLowerCase().includes(targetSub.toLowerCase())) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(targetSub.toLowerCase())) ||
        (meta.subCat && meta.subCat.toLowerCase().includes(targetSub.toLowerCase()));
      if (!matchCat) return false;
    }

    // Format (Ebook / 3D)
    if (filterFormat.value) {
      const targetFmt = filterFormat.value.toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (!rawLower.includes(targetFmt)) return false;
    }

    // Saison
    if (filterSeason.value) {
      const sTarget = filterSeason.value;
      const itemS = item.season ?? meta.season;
      if (sTarget === 'S10+') {
        if (!itemS || itemS < 10) return false;
      } else {
        const sNum = parseInt(sTarget.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(sNum) && itemS !== sNum) {
          return false;
        }
      }
    }

    // Résolution
    if (filterResolution.value) {
      const targetRes = filterResolution.value.toLowerCase();
      const itemRes = (item.resolution || meta.resolution || '').toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetRes === '2160p') {
        if (!itemRes.includes('2160') && !rawLower.includes('2160p') && !rawLower.includes('4k') && !rawLower.includes('uhd')) {
          return false;
        }
      } else if (targetRes === '1080p') {
        if (!itemRes.includes('1080') && !rawLower.includes('1080p') && !rawLower.includes('1080i')) {
          return false;
        }
      } else if (targetRes === '720p') {
        if (!itemRes.includes('720') && !rawLower.includes('720p')) {
          return false;
        }
      } else if (targetRes === 'sd') {
        if (!itemRes.includes('sd') && !rawLower.includes('576p') && !rawLower.includes('480p') && !rawLower.includes('dvdrip')) {
          return false;
        }
      }
    }

    // Langue
    if (filterLanguage.value) {
      const targetLang = filterLanguage.value.toLowerCase();
      const itemLang = (item.language || '').toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetLang === 'multi') {
        if (!itemLang.includes('multi') && !rawLower.includes('multi')) return false;
      } else if (targetLang === 'vff') {
        if (!itemLang.includes('vff') && !itemLang.includes('french') && !rawLower.includes('vff') && !rawLower.includes('french') && !rawLower.includes('truefrench')) return false;
      } else if (targetLang === 'vfq') {
        if (!itemLang.includes('vfq') && !rawLower.includes('vfq')) return false;
      } else if (targetLang === 'vostfr') {
        if (!itemLang.includes('vostfr') && !rawLower.includes('vostfr')) return false;
      } else if (targetLang === 'vo') {
        if (!itemLang.includes('vo') && !itemLang.includes('anglais') && !rawLower.includes('english') && !rawLower.includes('vostfr')) return false;
      }
    }

    // Sous-titres
    if (filterSubtitles.value) {
      const targetSub = filterSubtitles.value.toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetSub === 'vostfr' && !rawLower.includes('vostfr')) return false;
      if ((targetSub === 'forced' || targetSub === 'forcés') && !rawLower.includes('force') && !rawLower.includes('forced')) return false;
      if (targetSub === 'multi' && !rawLower.includes('multi')) return false;
      if ((targetSub === 'french' || targetSub === 'français') && !rawLower.includes('french') && !rawLower.includes('stfr') && !rawLower.includes('vostfr')) return false;
      if ((targetSub === 'english' || targetSub === 'anglais') && !rawLower.includes('english') && !rawLower.includes('sub')) return false;
    }

    // Source
    if (filterSource.value) {
      const targetSrc = filterSource.value.toLowerCase();
      const itemSrc = (item.source || meta.source || '').toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (!itemSrc.includes(targetSrc) && !rawLower.includes(targetSrc)) {
        return false;
      }
    }

    // HDR
    if (filterHdr.value) {
      const targetHdr = filterHdr.value.toLowerCase();
      const itemHdr = (item.hdr || '').toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetHdr.includes('dolby vision') && !itemHdr.includes('vision') && !rawLower.includes('dolby.vision') && !rawLower.includes('dovi') && !rawLower.includes('dv')) return false;
      if (targetHdr.includes('hdr10+') && !itemHdr.includes('10+') && !rawLower.includes('hdr10+') && !rawLower.includes('hdr10plus')) return false;
      if (targetHdr === 'hdr10' && !itemHdr.includes('hdr10') && !rawLower.includes('hdr10') && !rawLower.includes('hdr')) return false;
    }

    // Audio
    if (filterAudio.value) {
      const targetAudio = filterAudio.value.toLowerCase();
      const itemAudio = (item.audio || '').toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetAudio.includes('atmos') && !itemAudio.includes('atmos') && !rawLower.includes('atmos')) return false;
      if (targetAudio.includes('lossless') && !itemAudio.includes('lossless') && !itemAudio.includes('flac') && !rawLower.includes('flac') && !rawLower.includes('truehd')) return false;
      if (targetAudio.includes('dts') && !itemAudio.includes('dts') && !rawLower.includes('dts')) return false;
      if (targetAudio.includes('eac3') && !itemAudio.includes('eac3') && !rawLower.includes('eac3') && !rawLower.includes('ddp')) return false;
      if (targetAudio.includes('ac3') && !itemAudio.includes('ac3') && !rawLower.includes('ac3') && !rawLower.includes('dd5.1')) return false;
      if (targetAudio.includes('flac') && !itemAudio.includes('flac') && !rawLower.includes('flac')) return false;
      if (targetAudio.includes('mp3') && !itemAudio.includes('mp3') && !rawLower.includes('mp3')) return false;
    }

    // Codec
    if (filterCodec.value) {
      const targetCodec = filterCodec.value.toLowerCase();
      const itemCodec = (item.codec || '').toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetCodec.includes('hevc')) {
        if (!itemCodec.includes('hevc') && !itemCodec.includes('x265') && !rawLower.includes('hevc') && !rawLower.includes('x265') && !rawLower.includes('h.265') && !rawLower.includes('h265')) return false;
      } else if (targetCodec.includes('av1')) {
        if (!itemCodec.includes('av1') && !rawLower.includes('av1')) return false;
      } else if (targetCodec.includes('x264') || targetCodec.includes('h.264')) {
        if (!itemCodec.includes('264') && !rawLower.includes('x264') && !rawLower.includes('h.264') && !rawLower.includes('h264') && !rawLower.includes('avc')) return false;
      }
    }

    // Année
    if (filterYear.value) {
      const yStr = filterYear.value.trim();
      const itemYear = item.year || meta.year;
      const num = itemYear ? parseInt(itemYear, 10) : NaN;
      if (yStr === '< 2015') {
        if (isNaN(num) || num >= 2015) return false;
      } else if (yStr === '2015-2018') {
        if (isNaN(num) || num < 2015 || num > 2018) return false;
      } else {
        if (itemYear !== yStr && !item.title.includes(yStr)) return false;
      }
    }

    // Team
    if (filterTeam.value.trim()) {
      const targetTeam = filterTeam.value.toLowerCase().trim();
      const itemTeam = (item.team || '').toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (!itemTeam.includes(targetTeam) && !rawLower.includes(targetTeam)) return false;
    }

    // Uploader
    if (filterUploader.value.trim()) {
      const targetUp = filterUploader.value.toLowerCase().trim();
      const itemUp = (item.uploader || '').toLowerCase();
      if (!itemUp.includes(targetUp)) return false;
    }

    // Exclusivités
    if (filterExclusives.value && !item.isExclusive) {
      return false;
    }

    // Soins palliatifs (critiques : seeders <= 1)
    if (filterPalliative.value && item.seeders > 1) {
      return false;
    }

    return true;
  });
});

// Sorting
const sortedResults = computed(() => {
  const list = [...filteredResults.value];
  return list.sort((a, b) => {
    if (sortBy.value === 'seeders') return b.seeders - a.seeders;
    if (sortBy.value === 'leechers') return b.leechers - a.leechers;
    if (sortBy.value === 'size') return b.size - a.size;
    if (sortBy.value === 'title') return a.title.localeCompare(b.title);
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });
});

// Active tags for quick removal
const activeTags = computed(() => {
  const tags: Array<{ key: string; label: string }> = [];
  if (filterSubCat.value) {
    const found = currentSubCatOptions.value.find((o) => o.value === filterSubCat.value);
    tags.push({ key: 'subCat', label: `Sous-catégorie : ${found?.label || filterSubCat.value}` });
  }
  if (filterFormat.value) tags.push({ key: 'format', label: `Format : ${filterFormat.value.toUpperCase()}` });
  if (filterSeason.value) tags.push({ key: 'season', label: `Saison : ${filterSeason.value}` });
  if (filterResolution.value) tags.push({ key: 'resolution', label: `Résolution : ${filterResolution.value.toUpperCase()}` });
  if (filterLanguage.value) tags.push({ key: 'language', label: `Langue : ${filterLanguage.value.toUpperCase()}` });
  if (filterSubtitles.value) tags.push({ key: 'subtitles', label: `Sous-titres : ${filterSubtitles.value}` });
  if (filterSource.value) tags.push({ key: 'source', label: `Source : ${filterSource.value.toUpperCase()}` });
  if (filterHdr.value) tags.push({ key: 'hdr', label: `HDR : ${filterHdr.value.toUpperCase()}` });
  if (filterAudio.value) tags.push({ key: 'audio', label: `Audio : ${filterAudio.value.toUpperCase()}` });
  if (filterCodec.value) tags.push({ key: 'codec', label: `Codec : ${filterCodec.value.toUpperCase()}` });
  if (filterYear.value) tags.push({ key: 'year', label: `Année : ${filterYear.value}` });
  if (filterTeam.value.trim()) tags.push({ key: 'team', label: `Team : ${filterTeam.value.trim()}` });
  if (filterUploader.value.trim()) tags.push({ key: 'uploader', label: `Uploader : ${filterUploader.value.trim()}` });
  if (filterExclusives.value) tags.push({ key: 'exclusives', label: `⭐ Exclusivités` });
  if (filterPalliative.value) tags.push({ key: 'palliative', label: `❤️ Soins palliatifs` });
  return tags;
});

const removeTag = (key: string) => {
  if (key === 'subCat') filterSubCat.value = '';
  if (key === 'format') filterFormat.value = '';
  if (key === 'season') filterSeason.value = '';
  if (key === 'resolution') filterResolution.value = '';
  if (key === 'language') filterLanguage.value = '';
  if (key === 'subtitles') filterSubtitles.value = '';
  if (key === 'source') filterSource.value = '';
  if (key === 'hdr') filterHdr.value = '';
  if (key === 'audio') filterAudio.value = '';
  if (key === 'codec') filterCodec.value = '';
  if (key === 'year') filterYear.value = '';
  if (key === 'team') filterTeam.value = '';
  if (key === 'uploader') filterUploader.value = '';
  if (key === 'exclusives') filterExclusives.value = false;
  if (key === 'palliative') filterPalliative.value = false;
  onFilterChange();
};

const clearAllFilters = () => {
  filterSubCat.value = '';
  filterFormat.value = '';
  filterSeason.value = '';
  filterResolution.value = '';
  filterLanguage.value = '';
  filterSubtitles.value = '';
  filterSource.value = '';
  filterHdr.value = '';
  filterAudio.value = '';
  filterCodec.value = '';
  filterYear.value = '';
  filterTeam.value = '';
  filterUploader.value = '';
  filterExclusives.value = false;
  filterPalliative.value = false;
  onFilterChange();
};

// Preset Management
const loadPresetsFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_PRESETS_KEY);
    if (raw) {
      savedPresets.value = JSON.parse(raw);
    } else {
      // Default initial presets
      savedPresets.value = [
        { id: '1', name: '🎬 Films 4K HDR', cat: '1', resolution: '2160p', hdr: 'HDR10' },
        { id: '2', name: '📺 Séries TV MULTI', cat: '1', subCat: '7', language: 'MULTI' },
        { id: '3', name: '💎 Remux 4K', cat: '1', source: 'Remux', resolution: '2160p' },
        { id: '4', name: '📚 Ebooks & BD', cat: '2' },
        { id: '5', name: '🎵 Musique Lossless', cat: '3', audio: 'lossless' },
      ];
      localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(savedPresets.value));
    }
  } catch {
    savedPresets.value = [];
  }
};

const applyPreset = (preset: C411SavedFilter) => {
  if (preset.subCat !== undefined) filterSubCat.value = preset.subCat;
  if (preset.season !== undefined) filterSeason.value = preset.season;
  if (preset.resolution !== undefined) filterResolution.value = preset.resolution;
  if (preset.language !== undefined) filterLanguage.value = preset.language;
  if (preset.subtitles !== undefined) filterSubtitles.value = preset.subtitles;
  if (preset.source !== undefined) filterSource.value = preset.source;
  if (preset.hdr !== undefined) filterHdr.value = preset.hdr;
  if (preset.audio !== undefined) filterAudio.value = preset.audio;
  if (preset.codec !== undefined) filterCodec.value = preset.codec;
  if (preset.year !== undefined) filterYear.value = preset.year;
  if (preset.team !== undefined) filterTeam.value = preset.team;
  if (preset.uploader !== undefined) filterUploader.value = preset.uploader;
  if (preset.isExclusive !== undefined) filterExclusives.value = preset.isExclusive;
  if (preset.isPalliative !== undefined) filterPalliative.value = preset.isPalliative;
  if (preset.cat !== undefined && preset.cat !== selectedCat.value) {
    selectedCat.value = preset.cat;
  }
  performSearch();
};

const saveCurrentAsPreset = () => {
  const name = presetNameInput.value.trim() || `Filtre ${savedPresets.value.length + 1}`;
  const newPreset: C411SavedFilter = {
    id: Date.now().toString(),
    name,
    cat: selectedCat.value,
    subCat: filterSubCat.value,
    season: filterSeason.value,
    resolution: filterResolution.value,
    language: filterLanguage.value,
    subtitles: filterSubtitles.value,
    source: filterSource.value,
    hdr: filterHdr.value,
    audio: filterAudio.value,
    codec: filterCodec.value,
    year: filterYear.value,
    team: filterTeam.value,
    uploader: filterUploader.value,
    isExclusive: filterExclusives.value,
    isPalliative: filterPalliative.value,
  };

  savedPresets.value.push(newPreset);
  try {
    localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(savedPresets.value));
  } catch (e) {
    console.error(e);
  }
  presetNameInput.value = '';
  showPresetModal.value = false;
};

const deletePreset = (id: string, e: Event) => {
  e.stopPropagation();
  savedPresets.value = savedPresets.value.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(savedPresets.value));
  } catch (e) {
    console.error(e);
  }
};

// Image Error Handling
const handleImgError = (id: string) => {
  brokenImages.value.add(id);
};

// UI Category Fallback Icon
const getCategoryIcon = (item: C411SearchResultDTO): string => {
  const cat = (item.categoryName || '').toLowerCase();
  const title = item.title.toLowerCase();
  if (cat.includes('série') || title.includes('s0') || title.includes('s1')) return '📺';
  if (cat.includes('film')) return '🎬';
  if (cat.includes('anime') || title.includes('anime')) return '🎌';
  if (cat.includes('musique') || cat.includes('audio')) return '🎵';
  if (cat.includes('jeu')) return '🎮';
  if (cat.includes('app')) return '💾';
  if (cat.includes('livre') || cat.includes('bd')) return '📖';
  return '🎬';
};

const getCategoryShortLabel = (item: C411SearchResultDTO): string => {
  return item.categoryName || getMeta(item).subCat || 'Média';
};

const formatPubDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return "à l'instant";
  if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR');
};

onMounted(() => {
  loadPresetsFromStorage();
  performSearch();
});
</script>

<template>
  <div class="c411-search-panel">
    <!-- Header with Search Input & Action Button -->
    <div class="search-top-bar">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="search"
          class="c411-search-input"
          placeholder="Titre, série, film, anime ou release sur C411..."
          @keydown.enter="performSearch"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="btn-clear-search"
          title="Effacer le texte"
          @click="searchQuery = ''; performSearch()"
        >
          ✕
        </button>
      </div>
      <button
        type="button"
        class="btn-c411-search"
        :disabled="isLoading"
        @click="performSearch"
      >
        {{ isLoading ? 'Recherche...' : 'Rechercher' }}
      </button>
    </div>

    <!-- Category Pills with Colored Dots (Style C411) -->
    <div class="category-pills-bar">
      <button
        v-for="cat in visibleCategories"
        :key="cat.label"
        type="button"
        class="cat-pill-btn"
        :class="{ active: isCategoryActive(cat) }"
        @click="selectCategory(cat.cat, cat.subcat)"
      >
        <span class="pill-dot" :style="{ backgroundColor: cat.dotColor }"></span>
        <span>{{ cat.label }}</span>
      </button>
    </div>

    <!-- Saved Filter Presets Bar -->
    <div class="presets-bar">
      <span class="presets-label">⭐ FILTRES FAVORIS :</span>
      <div class="presets-list">
        <button
          v-for="preset in savedPresets"
          :key="preset.id"
          type="button"
          class="preset-chip"
          @click="applyPreset(preset)"
        >
          <span>{{ preset.name }}</span>
          <span
            class="preset-remove-btn"
            title="Supprimer ce filtre"
            @click="deletePreset(preset.id, $event)"
          >
            ✕
          </span>
        </button>
        <button
          type="button"
          class="btn-save-current-filter"
          title="Enregistrer la combinaison de filtres actuelle"
          @click="showPresetModal = true"
        >
          + Sauvegarder filtre
        </button>
      </div>
    </div>

    <!-- Save Preset Modal Dialog -->
    <div v-if="showPresetModal" class="preset-modal-backdrop" @click.self="showPresetModal = false">
      <div class="preset-modal-content">
        <h4 class="modal-title">⭐ Sauvegarder ce filtre favori</h4>
        <p class="modal-desc">
          Donnez un nom mémorable à cette sélection (ex: "Séries 4K MULTI", "Films Remux HDR", "Anime VOSTFR") :
        </p>
        <input
          v-model="presetNameInput"
          type="text"
          class="preset-name-input"
          placeholder="Nom du filtre favori..."
          @keydown.enter="saveCurrentAsPreset"
        />
        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="showPresetModal = false">Annuler</button>
          <button type="button" class="btn-confirm-save" @click="saveCurrentAsPreset">Sauvegarder</button>
        </div>
      </div>
    </div>

    <!-- Dynamic Category-Specific Filter Controls Grid -->
    <div class="filter-controls-grid">
      <!-- 1. Tout ('') -->
      <template v-if="selectedCat === ''">
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <div class="cat-hint-pill">
          💡 Sélectionnez une catégorie pour filtrer par résolution, source, codecs, plateforme...
        </div>
      </template>

      <!-- 2. Films & Vidéos ('1') -->
      <template v-else-if="selectedCat === '1'">
        <!-- Sous-catégorie -->
        <select v-model="filterSubCat" class="c411-select" title="Sous-catégorie" @change="onFilterChange">
          <option v-for="opt in currentSubCatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Résolution -->
        <select v-model="filterResolution" class="c411-select" title="Résolution" @change="onFilterChange">
          <option v-for="opt in resolutionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Source -->
        <select v-model="filterSource" class="c411-select" title="Source" @change="onFilterChange">
          <option v-for="opt in videoSourceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- HDR -->
        <select v-model="filterHdr" class="c411-select" title="HDR" @change="onFilterChange">
          <option v-for="opt in hdrOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Audio -->
        <select v-model="filterAudio" class="c411-select" title="Audio" @change="onFilterChange">
          <option v-for="opt in audioOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Codec -->
        <select v-model="filterCodec" class="c411-select" title="Codec" @change="onFilterChange">
          <option v-for="opt in codecOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Langue -->
        <select v-model="filterLanguage" class="c411-select" title="Langue audio" @change="onFilterChange">
          <option v-for="opt in videoLanguageOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Sous-titres -->
        <select v-model="filterSubtitles" class="c411-select" title="Langue des sous-titres" @change="onFilterChange">
          <option v-for="opt in subtitleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Saison -->
        <select v-model="filterSeason" class="c411-select" title="Saison" @change="onFilterChange">
          <option v-for="opt in seasonOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Année -->
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </template>

      <!-- 3. Ebook ('2') -->
      <template v-else-if="selectedCat === '2'">
        <!-- Sous-catégorie -->
        <select v-model="filterSubCat" class="c411-select" title="Sous-catégorie" @change="onFilterChange">
          <option v-for="opt in currentSubCatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Format Ebook -->
        <select v-model="filterFormat" class="c411-select" title="Format Ebook" @change="onFilterChange">
          <option v-for="opt in ebookFormatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Langue -->
        <select v-model="filterLanguage" class="c411-select" title="Langue" @change="onFilterChange">
          <option v-for="opt in generalLanguageOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Année -->
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </template>

      <!-- 4. Audio ('3') -->
      <template v-else-if="selectedCat === '3'">
        <!-- Sous-catégorie -->
        <select v-model="filterSubCat" class="c411-select" title="Sous-catégorie" @change="onFilterChange">
          <option v-for="opt in currentSubCatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Format Audio -->
        <select v-model="filterAudio" class="c411-select" title="Format Audio" @change="onFilterChange">
          <option v-for="opt in audioFormatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Source -->
        <select v-model="filterSource" class="c411-select" title="Source" @change="onFilterChange">
          <option v-for="opt in audioSourceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Année -->
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </template>

      <!-- 5. Applications ('4') -->
      <template v-else-if="selectedCat === '4'">
        <!-- Sous-catégorie (Plateforme) -->
        <select v-model="filterSubCat" class="c411-select" title="Plateforme / OS" @change="onFilterChange">
          <option v-for="opt in currentSubCatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Langue -->
        <select v-model="filterLanguage" class="c411-select" title="Langue" @change="onFilterChange">
          <option v-for="opt in generalLanguageOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Année -->
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </template>

      <!-- 6. Jeux Vidéo ('5') -->
      <template v-else-if="selectedCat === '5'">
        <!-- Sous-catégorie (Plateforme) -->
        <select v-model="filterSubCat" class="c411-select" title="Plateforme" @change="onFilterChange">
          <option v-for="opt in currentSubCatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Langue -->
        <select v-model="filterLanguage" class="c411-select" title="Langue" @change="onFilterChange">
          <option v-for="opt in generalLanguageOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Année -->
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </template>

      <!-- 7. Émulation ('6') -->
      <template v-else-if="selectedCat === '6'">
        <!-- Sous-catégorie -->
        <select v-model="filterSubCat" class="c411-select" title="Type" @change="onFilterChange">
          <option v-for="opt in currentSubCatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Année -->
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </template>

      <!-- 8. Imprimante 3D ('10') -->
      <template v-else-if="selectedCat === '10'">
        <!-- Sous-catégorie -->
        <select v-model="filterSubCat" class="c411-select" title="Type d'objet" @change="onFilterChange">
          <option v-for="opt in currentSubCatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Format 3D -->
        <select v-model="filterFormat" class="c411-select" title="Format 3D" @change="onFilterChange">
          <option v-for="opt in print3dFormatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Année -->
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </template>

      <!-- 9. XXX ('8') -->
      <template v-else-if="selectedCat === '8'">
        <!-- Sous-catégorie -->
        <select v-model="filterSubCat" class="c411-select" title="Sous-catégorie" @change="onFilterChange">
          <option v-for="opt in currentSubCatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Langue -->
        <select v-model="filterLanguage" class="c411-select" title="Langue" @change="onFilterChange">
          <option v-for="opt in generalLanguageOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Qualité -->
        <select v-model="filterResolution" class="c411-select" title="Qualité" @change="onFilterChange">
          <option v-for="opt in resolutionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Année -->
        <select v-model="filterYear" class="c411-select" title="Année" @change="onFilterChange">
          <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <!-- Team -->
        <input
          v-model="filterTeam"
          type="text"
          class="c411-input-filter"
          placeholder="Team..."
          title="Filtrer par Team"
          @input="onFilterChange"
        />
        <!-- Uploader -->
        <input
          v-model="filterUploader"
          type="text"
          class="c411-input-filter"
          placeholder="Uploader..."
          title="Filtrer par Uploader"
          @input="onFilterChange"
        />
        <!-- Spacer -->
        <span class="flex-spacer"></span>
        <!-- Exclusivités -->
        <button
          type="button"
          class="btn-badge-filter btn-exclusives"
          :class="{ active: filterExclusives }"
          @click="filterExclusives = !filterExclusives; onFilterChange()"
        >
          <span class="filter-icon">⭐</span> Exclusivités
        </button>
        <!-- Soins palliatifs -->
        <button
          type="button"
          class="btn-badge-filter btn-palliative"
          :class="{ active: filterPalliative }"
          @click="filterPalliative = !filterPalliative; onFilterChange()"
        >
          <span class="filter-icon">❤️</span> Soins palliatifs
        </button>
        <!-- Tout effacer -->
        <button
          type="button"
          class="btn-clear-inline"
          @click="clearAllFilters"
        >
          Tout effacer
        </button>
      </template>
    </div>

    <!-- Active Filter Tags Bar with Removable Chips (Screenshot style) -->
    <div v-if="activeTags.length > 0" class="active-tags-bar">
      <span class="active-tags-label">Filtres actifs :</span>
      <div class="active-tags-container">
        <span
          v-for="tag in activeTags"
          :key="tag.key"
          class="active-tag-chip"
        >
          {{ tag.label }}
          <button type="button" class="btn-remove-tag" @click="removeTag(tag.key)">✕</button>
        </span>
        <button
          type="button"
          class="btn-clear-all"
          @click="clearAllFilters"
        >
          Tout effacer
        </button>
      </div>
    </div>

    <!-- Sort Toolbar & Count -->
    <div class="sort-toolbar">
      <div class="sort-tabs-group">
        <span class="sort-label">TRIER :</span>
        <button
          type="button"
          class="sort-tab"
          :class="{ active: sortBy === 'age' }"
          @click="sortBy = 'age'"
        >
          Âge
        </button>
        <button
          type="button"
          class="sort-tab"
          :class="{ active: sortBy === 'seeders' }"
          @click="sortBy = 'seeders'"
        >
          Seeders
        </button>
        <button
          type="button"
          class="sort-tab"
          :class="{ active: sortBy === 'leechers' }"
          @click="sortBy = 'leechers'"
        >
          Leechers
        </button>
        <button
          type="button"
          class="sort-tab"
          :class="{ active: sortBy === 'size' }"
          @click="sortBy = 'size'"
        >
          Taille
        </button>
        <button
          type="button"
          class="sort-tab"
          :class="{ active: sortBy === 'title' }"
          @click="sortBy = 'title'"
        >
          Nom
        </button>
      </div>

      <div class="results-count">
        <span v-if="rawResults.length > 0">
          <strong>{{ sortedResults.length }}</strong> résultat{{ sortedResults.length > 1 ? 's' : '' }}
          <span v-if="sortedResults.length !== rawResults.length" class="text-muted">
            (filtrés parmi {{ rawResults.length }})
          </span>
        </span>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="errorMessage" class="error-banner">
      ⚠️ {{ errorMessage }}
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && rawResults.length === 0" class="loading-state">
      <span class="spinner-icon">🔄</span> Recherche instantanée des torrents sur C411...
    </div>

    <!-- Results List (Cards with Posters) -->
    <div v-else-if="sortedResults.length > 0" class="c411-results-list">
      <C411ResultRow
        v-for="item in sortedResults"
        :key="item.id"
        :item="item"
        :adding-id="addingId"
        :added-ids="addedIds"
        :broken-images="brokenImages"
        @open-details="openDetailsModal"
        @add="handleAdd"
        @img-error="handleImgError"
      />
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading" class="empty-state">
      <div class="empty-icon">📂</div>
      <p>Aucun torrent ne correspond à vos critères de recherche et filtres actuels.</p>
      <button v-if="activeTags.length > 0" type="button" class="btn-reset-filters" @click="clearAllFilters">
        Réinitialiser les filtres
      </button>
    </div>

    <!-- C411 Torrent Details Modal (Rich description, images, guide & user comments) -->
    <C411TorrentDetailsModal
      :is-open="isDetailsModalOpen"
      :item="selectedItemForModal"
      :is-adding="Boolean(selectedItemForModal && addingId === selectedItemForModal.id)"
      :is-added="Boolean(selectedItemForModal && (addedIds.has(selectedItemForModal.id) || (selectedItemForModal.infoHash && activeHashes?.has(selectedItemForModal.infoHash.toLowerCase()))))"
      @close="closeDetailsModal"
      @add="handleAddFromModal"
    />
  </div>
</template>

<style scoped>
.c411-search-panel {
  background: #0d0f18;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
  max-width: 1200px;
  margin: 0 auto 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

/* Search Top Bar */
.search-top-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.search-input-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0 0.75rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input-wrapper:focus-within {
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.search-icon {
  font-size: 0.85rem;
  opacity: 0.6;
}

.c411-search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: #f3f4f6;
  font-size: 0.9rem;
  padding: 0.7rem 0.6rem;
}

.c411-search-input::placeholder {
  color: #64748b;
}

.btn-clear-search {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  font-size: 0.85rem;
}

.btn-clear-search:hover {
  color: #ffffff;
}

.btn-c411-search {
  background: #f97316;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 0 1.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 110px;
  transition: background 0.15s, transform 0.05s;
}

.btn-c411-search:hover:not(:disabled) {
  background: #ea580c;
}

.btn-c411-search:active:not(:disabled) {
  transform: scale(0.98);
}

/* Category Pills Bar */
.category-pills-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 0.85rem;
}

.cat-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cat-pill-btn:hover {
  background: #1e2235;
  color: #e2e8f0;
  border-color: rgba(255, 255, 255, 0.18);
}

.cat-pill-btn.active {
  background: #1e293b;
  border-color: #38bdf8;
  color: #ffffff;
  font-weight: 600;
}

.pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Saved Presets Bar */
.presets-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
  font-size: 0.78rem;
}

.presets-label {
  color: #f59e0b;
  font-weight: 700;
  letter-spacing: 0.04em;
  font-size: 0.75rem;
}

.presets-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.preset-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fbbf24;
  border-radius: 9999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-chip:hover {
  background: rgba(245, 158, 11, 0.2);
  border-color: #f59e0b;
  color: #ffffff;
}

.preset-remove-btn {
  font-size: 0.7rem;
  opacity: 0.6;
  margin-left: 0.15rem;
}

.preset-remove-btn:hover {
  opacity: 1;
  color: #f87171;
}

.btn-save-current-filter {
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: #94a3b8;
  border-radius: 9999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-save-current-filter:hover {
  border-color: #10b981;
  color: #10b981;
  background: rgba(16, 185, 129, 0.08);
}

/* Modal for saving preset */
.preset-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.preset-modal-content {
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
}

.modal-title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: #ffffff;
  font-weight: 600;
}

.modal-desc {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.preset-name-input {
  width: 100%;
  background: #0d0f18;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  color: #ffffff;
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
  outline: none;
}

.preset-name-input:focus {
  border-color: #10b981;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-cancel {
  background: #1e2235;
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-confirm-save {
  background: #10b981;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  padding: 0.5rem 1.2rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm-save:hover {
  background: #059669;
}

/* Filter Controls Grid (Dropdowns) */
.filter-controls-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}

.c411-select {
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 0.8rem;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.c411-select:focus,
.c411-select:hover {
  border-color: rgba(255, 255, 255, 0.25);
}

.c411-select option {
  background: #141724;
  color: #f3f4f6;
}

.c411-input-filter {
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 0.8rem;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  outline: none;
  max-width: 140px;
  transition: border-color 0.15s;
}

.c411-input-filter:focus {
  border-color: #10b981;
}

.flex-spacer {
  flex: 1;
}

.btn-badge-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 9999px;
  padding: 0.35rem 0.75rem;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  white-space: nowrap;
}

.btn-exclusives {
  border-color: rgba(245, 158, 11, 0.35);
  color: #fbbf24;
  background: transparent;
}

.btn-exclusives:hover,
.btn-exclusives.active {
  background: rgba(245, 158, 11, 0.18);
  border-color: #f59e0b;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.2);
}

.btn-palliative {
  border-color: rgba(244, 63, 94, 0.35);
  color: #fb7185;
  background: transparent;
}

.btn-palliative:hover,
.btn-palliative.active {
  background: rgba(244, 63, 94, 0.18);
  border-color: #f43f5e;
  box-shadow: 0 0 10px rgba(244, 63, 94, 0.2);
}

.btn-clear-inline {
  background: transparent;
  border: none;
  font-size: 12.5px;
  font-weight: 500;
  color: #34d399;
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  text-decoration: none;
  white-space: nowrap;
}

.btn-clear-inline:hover {
  text-decoration: underline;
  color: #10b981;
}

.cat-hint-pill {
  display: inline-flex;
  align-items: center;
  font-size: 0.78rem;
  color: #94a3b8;
  padding: 0.35rem 0.6rem;
  font-style: italic;
}

/* Active Tags Bar */
.active-tags-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  background: #131726;
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.85rem;
}

.active-tags-label {
  font-size: 0.75rem;
  color: #38bdf8;
  font-weight: 600;
}

.active-tags-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.active-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #e0f2fe;
  font-size: 0.75rem;
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
}

.btn-remove-tag {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.btn-remove-tag:hover {
  color: #f87171;
}

.btn-clear-all {
  background: none;
  border: none;
  color: #f87171;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  margin-left: 0.5rem;
  text-decoration: underline;
}

/* Sort Toolbar */
.sort-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 0.4rem 0.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sort-tabs-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.sort-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  margin-right: 0.25rem;
}

.sort-tab {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.8rem;
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.sort-tab:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.sort-tab.active {
  color: #38bdf8;
  font-weight: 600;
  background: rgba(56, 189, 248, 0.1);
}

.results-count {
  font-size: 0.8rem;
  color: #cbd5e1;
}

.text-muted {
  color: #64748b;
  font-size: 0.75rem;
}

/* Results List & Cards */
.c411-results-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.c411-results-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* States */
.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.spinner-icon {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.btn-reset-filters {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #38bdf8;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  margin-top: 0.75rem;
  cursor: pointer;
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .filter-controls-grid {
    gap: 0.35rem;
  }
  .c411-select {
    flex: 1 1 calc(50% - 0.35rem);
    min-width: 120px;
    font-size: 0.75rem;
    padding: 0.35rem 0.5rem;
  }
}
</style>
