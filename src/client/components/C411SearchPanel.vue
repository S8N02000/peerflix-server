<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { C411SearchResultDTO, C411ProfileDTO, C411SavedFilter } from '../../shared/types.js';
import { searchC411, addC411Torrent } from '../services/api.js';
import { formatBytes } from '../composables/useTorrents.js';
import { parseReleaseMetadata } from '../utils/release-parser.js';
import C411TorrentDetailsModal from './C411TorrentDetailsModal.vue';

const props = defineProps<{
  c411Profile?: C411ProfileDTO | null;
  activeHashes?: Set<string>;
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
const filterFreeleechOnly = ref(false);

// Preset filters saved in localStorage
const savedPresets = ref<C411SavedFilter[]>([]);
const showPresetModal = ref(false);
const presetNameInput = ref('');
const STORAGE_PRESETS_KEY = 'peerflix_c411_saved_filters';

// Image load tracking
const brokenImages = ref<Set<string>>(new Set());

// Category pills matching C411
const categories = [
  { label: 'Tout', cat: '', dotColor: '#10b981' },
  { label: 'Films & Vidéos', cat: '2000,5000', dotColor: '#38bdf8' },
  { label: 'Films', cat: '2000', dotColor: '#60a5fa' },
  { label: 'Séries TV', cat: '5000', dotColor: '#818cf8' },
  { label: 'Anime', cat: '2060,5070', dotColor: '#ec4899' },
  { label: 'Audio / Musique', cat: '3010', dotColor: '#a855f7' },
  { label: 'Jeux Vidéo', cat: '4050', dotColor: '#06b6d4' },
  { label: 'Applications', cat: '4000', dotColor: '#14b8a6' },
  { label: 'eBooks / BD', cat: '7020,7030', dotColor: '#f97316' },
];

// Dropdown options
const subCatOptions = [
  { label: 'Sous-catégorie', value: '' },
  { label: 'Séries TV', value: 'Séries TV' },
  { label: 'Films', value: 'Films' },
  { label: 'Animation / Anime', value: 'Anime' },
  { label: 'Documentaires', value: 'Documentaires' },
  { label: 'Spectacles / Concerts', value: 'Spectacles' },
];

const seasonOptions = [
  { label: 'Saison', value: '' },
  { label: 'Saison 1', value: 'S01' },
  { label: 'Saison 2', value: 'S02' },
  { label: 'Saison 3', value: 'S03' },
  { label: 'Saison 4', value: 'S04' },
  { label: 'Saison 5', value: 'S05' },
  { label: 'Saison 6', value: 'S06' },
  { label: 'Saison 7', value: 'S07' },
  { label: 'Saison 8', value: 'S08' },
  { label: 'Saison 9', value: 'S09' },
  { label: 'Saison 10+', value: 'S10+' },
];

const resolutionOptions = [
  { label: 'Résolution', value: '' },
  { label: '4K / 2160p', value: '2160p' },
  { label: '1080p FHD', value: '1080p' },
  { label: '720p HD', value: '720p' },
  { label: 'SD / 576p', value: 'sd' },
];

const languageOptions = [
  { label: 'Langue', value: '' },
  { label: 'MULTI', value: 'multi' },
  { label: 'MULTI VFF', value: 'multi vff' },
  { label: 'MULTI VFQ', value: 'multi vfq' },
  { label: 'VFF / TrueFrench', value: 'vff' },
  { label: 'VFQ', value: 'vfq' },
  { label: 'VOSTFR', value: 'vostfr' },
  { label: 'Français (Tous)', value: 'fr' },
];

const subtitleOptions = [
  { label: 'Sous-titres', value: '' },
  { label: 'Français', value: 'français' },
  { label: 'Forcés', value: 'forcés' },
  { label: 'Multi', value: 'multi' },
  { label: 'VOSTFR', value: 'vostfr' },
];

const sourceOptions = [
  { label: 'Source', value: '' },
  { label: 'WEB-DL', value: 'web-dl' },
  { label: 'WEBRip', value: 'webrip' },
  { label: 'BluRay', value: 'bluray' },
  { label: 'Remux', value: 'remux' },
  { label: 'HDTV', value: 'hdtv' },
];

const hdrOptions = [
  { label: 'HDR', value: '' },
  { label: 'DV HDR10+', value: 'dv hdr10+' },
  { label: 'DV HDR', value: 'dv hdr' },
  { label: 'Dolby Vision', value: 'dolby vision' },
  { label: 'HDR10+', value: 'hdr10+' },
  { label: 'HDR10', value: 'hdr10' },
];

const audioOptions = [
  { label: 'Audio', value: '' },
  { label: 'TrueHD Atmos', value: 'atmos' },
  { label: 'DTS-HD MA', value: 'dts-hd' },
  { label: 'E-AC3 Atmos / DDP', value: 'e-ac3' },
  { label: 'AC3 5.1 / DD', value: 'ac3' },
  { label: 'FLAC Lossless', value: 'flac' },
  { label: 'AAC', value: 'aac' },
];

const codecOptions = [
  { label: 'Codec', value: '' },
  { label: 'HEVC / x265', value: 'hevc' },
  { label: 'AV1', value: 'av1' },
  { label: 'H.264 / x264', value: 'h.264' },
];

const yearOptions = [
  { label: 'Année', value: '' },
  { label: '2026', value: '2026' },
  { label: '2025', value: '2025' },
  { label: '2024', value: '2024' },
  { label: '2023', value: '2023' },
  { label: '2022', value: '2022' },
  { label: '2021', value: '2021' },
  { label: '2020', value: '2020' },
  { label: '2019', value: '2019' },
  { label: '2015 - 2018', value: '2015-2018' },
  { label: '< 2015', value: '< 2015' },
];

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

// API Search
const performSearch = async () => {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const res = await searchC411(searchQuery.value, selectedCat.value);
    rawResults.value = res.results;
  } catch (err: any) {
    errorMessage.value = err.message || 'Échec de la recherche C411';
  } finally {
    isLoading.value = false;
  }
};

const selectCategory = (cat: string) => {
  selectedCat.value = cat;
  performSearch();
};

const handleAdd = async (item: C411SearchResultDTO) => {
  if (item.alreadyAdded || addedIds.value.has(item.id)) return;
  addingId.value = item.id;
  try {
    const res = await addC411Torrent(item.id);
    addedIds.value.add(item.id);
    emit('torrent-added', res.infoHash);
  } catch (err: any) {
    alert(err.message || "Erreur lors de l'ajout du torrent");
  } finally {
    addingId.value = null;
  }
};

const handleAddFromModal = async (id: string) => {
  const item = rawResults.value.find((r) => r.id === id) || selectedItemForModal.value;
  if (item) {
    await handleAdd(item);
  }
};

// Filtering logic (0ms instant response)
const filteredResults = computed(() => {
  return rawResults.value.filter((item) => {
    const meta = getMeta(item);

    // Freeleech
    if (filterFreeleechOnly.value && !item.isFreeleech) {
      return false;
    }

    // Sous-catégorie
    if (filterSubCat.value) {
      const targetSub = filterSubCat.value.toLowerCase();
      const matchCat =
        (item.categoryName && item.categoryName.toLowerCase().includes(targetSub)) ||
        (meta.subCat && meta.subCat.toLowerCase().includes(targetSub));
      if (!matchCat) return false;
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
      const rawLower = item.title.toLowerCase();
      if (targetLang === 'multi') {
        if (!rawLower.includes('multi')) return false;
      } else if (targetLang === 'multi vff') {
        if (!rawLower.includes('multi') || (!rawLower.includes('vff') && !rawLower.includes('french'))) return false;
      } else if (targetLang === 'multi vfq') {
        if (!rawLower.includes('multi') || !rawLower.includes('vfq')) return false;
      } else if (targetLang === 'vff') {
        if (!rawLower.includes('vff') && !rawLower.includes('french') && !rawLower.includes('truefrench')) return false;
      } else if (targetLang === 'truefrench') {
        if (!rawLower.includes('truefrench')) return false;
      } else if (targetLang === 'vfq') {
        if (!rawLower.includes('vfq')) return false;
      } else if (targetLang === 'vostfr') {
        if (!rawLower.includes('vostfr')) return false;
      } else if (targetLang === 'fr') {
        if (!rawLower.includes('french') && !rawLower.includes('vff') && !rawLower.includes('vfq') && !rawLower.includes('truefrench')) return false;
      }
    }

    // Sous-titres
    if (filterSubtitles.value) {
      const targetSub = filterSubtitles.value.toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetSub === 'vostfr' && !rawLower.includes('vostfr')) return false;
      if (targetSub === 'forcés' && !rawLower.includes('force') && !rawLower.includes('forced')) return false;
      if (targetSub === 'multi' && !rawLower.includes('multi')) return false;
      if (targetSub === 'français' && !rawLower.includes('french') && !rawLower.includes('stfr') && !rawLower.includes('vostfr')) return false;
    }

    // Source
    if (filterSource.value) {
      const targetSrc = filterSource.value.toLowerCase();
      const itemSrc = (meta.source || '').toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (!itemSrc.includes(targetSrc) && !rawLower.includes(targetSrc)) {
        return false;
      }
    }

    // HDR
    if (filterHdr.value) {
      const targetHdr = filterHdr.value.toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetHdr.includes('dv') && !rawLower.includes('dv') && !rawLower.includes('dolby.vision')) return false;
      if (targetHdr.includes('hdr10+') && !rawLower.includes('hdr10+') && !rawLower.includes('hdr10plus')) return false;
      if (targetHdr === 'hdr10' && !rawLower.includes('hdr10') && !rawLower.includes('hdr')) return false;
      if (targetHdr === 'dolby vision' && !rawLower.includes('dolby.vision') && !rawLower.includes('dovi')) return false;
    }

    // Audio
    if (filterAudio.value) {
      const targetAudio = filterAudio.value.toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetAudio.includes('atmos') && !rawLower.includes('atmos')) return false;
      if (targetAudio.includes('dts-hd') && !rawLower.includes('dts-hd')) return false;
      if (targetAudio.includes('truehd') && !rawLower.includes('truehd')) return false;
      if (targetAudio.includes('e-ac3') && !rawLower.includes('eac3') && !rawLower.includes('ddp')) return false;
      if (targetAudio.includes('ac3') && !rawLower.includes('ac3') && !rawLower.includes('dd5.1')) return false;
      if (targetAudio.includes('flac') && !rawLower.includes('flac')) return false;
      if (targetAudio.includes('aac') && !rawLower.includes('aac')) return false;
    }

    // Codec
    if (filterCodec.value) {
      const targetCodec = filterCodec.value.toLowerCase();
      const rawLower = item.title.toLowerCase();
      if (targetCodec.includes('hevc')) {
        if (!rawLower.includes('hevc') && !rawLower.includes('x265') && !rawLower.includes('h.265') && !rawLower.includes('h265')) return false;
      } else if (targetCodec.includes('av1')) {
        if (!rawLower.includes('av1')) return false;
      } else if (targetCodec.includes('h.264')) {
        if (!rawLower.includes('x264') && !rawLower.includes('h.264') && !rawLower.includes('h264') && !rawLower.includes('avc')) return false;
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
  if (filterSubCat.value) tags.push({ key: 'subCat', label: `Sous-catégorie : ${filterSubCat.value}` });
  if (filterSeason.value) tags.push({ key: 'season', label: `Saison : ${filterSeason.value}` });
  if (filterResolution.value) tags.push({ key: 'resolution', label: `Résolution : ${filterResolution.value.toUpperCase()}` });
  if (filterLanguage.value) tags.push({ key: 'language', label: `Langue : ${filterLanguage.value.toUpperCase()}` });
  if (filterSubtitles.value) tags.push({ key: 'subtitles', label: `Sous-titres : ${filterSubtitles.value}` });
  if (filterSource.value) tags.push({ key: 'source', label: `Source : ${filterSource.value.toUpperCase()}` });
  if (filterHdr.value) tags.push({ key: 'hdr', label: `HDR : ${filterHdr.value.toUpperCase()}` });
  if (filterAudio.value) tags.push({ key: 'audio', label: `Audio : ${filterAudio.value.toUpperCase()}` });
  if (filterCodec.value) tags.push({ key: 'codec', label: `Codec : ${filterCodec.value.toUpperCase()}` });
  if (filterYear.value) tags.push({ key: 'year', label: `Année : ${filterYear.value}` });
  if (filterFreeleechOnly.value) tags.push({ key: 'freeleech', label: '⚡ Freeleech seulement' });
  return tags;
});

const removeTag = (key: string) => {
  if (key === 'subCat') filterSubCat.value = '';
  if (key === 'season') filterSeason.value = '';
  if (key === 'resolution') filterResolution.value = '';
  if (key === 'language') filterLanguage.value = '';
  if (key === 'subtitles') filterSubtitles.value = '';
  if (key === 'source') filterSource.value = '';
  if (key === 'hdr') filterHdr.value = '';
  if (key === 'audio') filterAudio.value = '';
  if (key === 'codec') filterCodec.value = '';
  if (key === 'year') filterYear.value = '';
  if (key === 'freeleech') filterFreeleechOnly.value = false;
};

const clearAllFilters = () => {
  filterSubCat.value = '';
  filterSeason.value = '';
  filterResolution.value = '';
  filterLanguage.value = '';
  filterSubtitles.value = '';
  filterSource.value = '';
  filterHdr.value = '';
  filterAudio.value = '';
  filterCodec.value = '';
  filterYear.value = '';
  filterFreeleechOnly.value = false;
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
        { id: '1', name: '🎬 Films 4K HDR', resolution: '2160p', hdr: 'hdr10' },
        { id: '2', name: '📺 Séries TV MULTI', subCat: 'Séries TV', language: 'multi' },
        { id: '3', name: '💎 Remux 4K', source: 'remux', resolution: '2160p' },
        { id: '4', name: '⚡ Freeleech', freeleechOnly: true },
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
  if (preset.freeleechOnly !== undefined) filterFreeleechOnly.value = preset.freeleechOnly;
  if (preset.cat !== undefined && preset.cat !== selectedCat.value) {
    selectedCat.value = preset.cat;
    performSearch();
  }
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
    freeleechOnly: filterFreeleechOnly.value,
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
        v-for="cat in categories"
        :key="cat.cat"
        type="button"
        class="cat-pill-btn"
        :class="{ active: selectedCat === cat.cat }"
        @click="selectCategory(cat.cat)"
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

    <!-- Complete C411 Dropdowns Filter Grid -->
    <div class="filter-controls-grid">
      <!-- Sous-catégorie -->
      <select v-model="filterSubCat" class="c411-select" title="Sous-catégorie">
        <option v-for="opt in subCatOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Saison -->
      <select v-model="filterSeason" class="c411-select" title="Saison">
        <option v-for="opt in seasonOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Résolution -->
      <select v-model="filterResolution" class="c411-select" title="Résolution">
        <option v-for="opt in resolutionOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Langue -->
      <select v-model="filterLanguage" class="c411-select" title="Langue">
        <option v-for="opt in languageOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Sous-titres -->
      <select v-model="filterSubtitles" class="c411-select" title="Sous-titres">
        <option v-for="opt in subtitleOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Source -->
      <select v-model="filterSource" class="c411-select" title="Source">
        <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- HDR -->
      <select v-model="filterHdr" class="c411-select" title="HDR">
        <option v-for="opt in hdrOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Audio -->
      <select v-model="filterAudio" class="c411-select" title="Audio">
        <option v-for="opt in audioOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Codec -->
      <select v-model="filterCodec" class="c411-select" title="Codec">
        <option v-for="opt in codecOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Année -->
      <select v-model="filterYear" class="c411-select" title="Année">
        <option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Freeleech Toggle Button -->
      <button
        type="button"
        class="btn-freeleech-toggle"
        :class="{ active: filterFreeleechOnly }"
        @click="filterFreeleechOnly = !filterFreeleechOnly"
      >
        <span>⚡ Freeleech</span>
      </button>
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
      <div
        v-for="item in sortedResults"
        :key="item.id"
        class="c411-result-row"
      >
        <!-- Poster / Cover Image on the Left -->
        <div class="result-poster-box clickable" title="Voir la fiche détaillée C411 (description & commentaires)" @click="openDetailsModal(item)">
          <img
            v-if="item.posterUrl && !brokenImages.has(item.id)"
            :src="item.posterUrl"
            :alt="item.title"
            class="poster-img"
            loading="lazy"
            @error="handleImgError(item.id)"
          />
          <div v-else class="poster-placeholder">
            <span class="placeholder-icon">{{ getCategoryIcon(item) }}</span>
            <span class="placeholder-label">{{ getCategoryShortLabel(item) }}</span>
          </div>
        </div>

        <!-- Center Metadata Information -->
        <div class="result-center">
          <!-- Row 1: Category badge + Clean Title + Season/Episode + Year + Freeleech -->
          <div class="row-title">
            <span v-if="item.categoryName" class="badge-cat">{{ item.categoryName }}</span>
            <span class="item-clean-title clickable" title="Voir la fiche détaillée C411 (description & commentaires)" @click="openDetailsModal(item)">
              {{ getMeta(item).cleanTitle }}
            </span>
            <span v-if="getMeta(item).seasonEpisodeLabel" class="badge-season-episode">
              {{ getMeta(item).seasonEpisodeLabel }}
            </span>
            <span v-if="getMeta(item).year || item.year" class="badge-year">
              {{ getMeta(item).year || item.year }}
            </span>
            <span v-if="item.isFreeleech" class="badge-freeleech">⚡ FREELEECH</span>
          </div>

          <!-- Row 2: Raw Release Name in Monospace Green (#10b981) -->
          <div class="row-raw-release clickable" :title="item.title + ' (Cliquer pour voir la fiche)'" @click="openDetailsModal(item)">
            {{ item.title }}
          </div>

          <!-- Row 3: Technical Badges parsed accurately -->
          <div class="row-tech-badges">
            <span
              v-for="(badge, bIdx) in getMeta(item).badges"
              :key="bIdx"
              class="tech-badge"
              :style="{ borderColor: badge.color, color: badge.color }"
            >
              {{ badge.label }}
            </span>
          </div>
        </div>

        <!-- Right Side: Stats, Peers & Action Button -->
        <div class="result-right">
          <!-- Size & Age -->
          <div class="meta-size-age">
            <span class="item-size font-mono">{{ formatBytes(item.size) }}</span>
            <span class="item-age">{{ formatPubDate(item.pubDate) }}</span>
          </div>

          <!-- Peers & Completed -->
          <div class="meta-peers">
            <div class="peers-counts">
              <span class="seeders" title="Seeders">↑ {{ item.seeders }}</span>
              <span class="leechers" title="Leechers">↓ {{ item.leechers }}</span>
              <span v-if="item.completed !== undefined" class="completed" title="Téléchargements réussis">
                {{ item.completed }} compl.
              </span>
            </div>
            <!-- Mini Ratio Bar -->
            <div class="peers-ratio-bar">
              <div
                class="ratio-seed"
                :style="{
                  width: `${(item.seeders / (item.seeders + item.leechers || 1)) * 100}%`
                }"
              ></div>
            </div>
          </div>

          <!-- Download Action Button -->
          <div class="action-btn-box">
            <button
              type="button"
              class="btn-view-details"
              title="Voir la description, les images et les commentaires sur C411"
              @click="openDetailsModal(item)"
            >
              📄 Fiche
            </button>
            <button
              type="button"
              class="btn-add-torrent"
              :class="{
                added: item.alreadyAdded || addedIds.has(item.id),
                loading: addingId === item.id
              }"
              :disabled="item.alreadyAdded || addedIds.has(item.id) || addingId === item.id"
              title="Lancer le téléchargement et streaming immédiat sur Peerflix"
              @click="handleAdd(item)"
            >
              <span v-if="addingId === item.id">⏳ Ajout...</span>
              <span v-else-if="item.alreadyAdded || addedIds.has(item.id)">✓ Actif</span>
              <span v-else>⬇ Lancer</span>
            </button>
          </div>
        </div>
      </div>
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

.btn-freeleech-toggle {
  display: inline-flex;
  align-items: center;
  background: #141724;
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #94a3b8;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-freeleech-toggle:hover {
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.4);
}

.btn-freeleech-toggle.active {
  background: rgba(245, 158, 11, 0.15);
  border-color: #f59e0b;
  color: #fbbf24;
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

.c411-result-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.c411-result-row:hover {
  border-color: rgba(56, 189, 248, 0.3);
  transform: translateY(-1px);
  background: #171b2b;
}

/* Poster Area */
.result-poster-box {
  width: 75px;
  height: 105px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  background: #0d0f18;
}

.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  color: #94a3b8;
  padding: 0.25rem;
  text-align: center;
  user-select: none;
}

.placeholder-icon {
  font-size: 1.6rem;
  margin-bottom: 0.25rem;
}

.placeholder-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* Center Content */
.result-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.row-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.badge-cat {
  background: #1e293b;
  color: #38bdf8;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.item-clean-title {
  font-size: 1rem;
  font-weight: 700;
  color: #ffffff;
}

.badge-season-episode {
  background: #3b82f6;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.badge-year {
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.badge-freeleech {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.row-raw-release {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  color: #10b981;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(16, 185, 129, 0.05);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  width: fit-content;
  max-width: 100%;
}

.row-tech-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.tech-badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.1rem 0.35rem;
  border: 1px solid;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
  text-transform: uppercase;
}

/* Right Content */
.result-right {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
}

.meta-size-age {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 75px;
}

.item-size {
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffffff;
}

.item-age {
  font-size: 0.7rem;
  color: #94a3b8;
}

.meta-peers {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 90px;
}

.peers-counts {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.seeders {
  color: #10b981;
}

.leechers {
  color: #38bdf8;
}

.completed {
  color: #94a3b8;
  font-size: 0.68rem;
}

.peers-ratio-bar {
  width: 100%;
  height: 4px;
  background: #1e293b;
  border-radius: 2px;
  overflow: hidden;
}

.ratio-seed {
  height: 100%;
  background: #10b981;
  transition: width 0.3s ease;
}

/* Launch Button */
.btn-add-torrent {
  background: #f97316;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-add-torrent:hover:not(:disabled) {
  background: #ea580c;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}

.btn-add-torrent.added {
  background: #1e293b;
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  cursor: default;
}

.btn-add-torrent.loading {
  opacity: 0.7;
  cursor: wait;
}

.action-btn-box {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.btn-view-details {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #94a3b8;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-view-details:hover {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.2);
}

.clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}

.clickable:hover {
  opacity: 0.85;
}

.item-clean-title.clickable:hover {
  color: #38bdf8;
  text-decoration: underline;
}

.row-raw-release.clickable:hover {
  color: #34d399;
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
  .c411-result-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .result-right {
    width: 100%;
    justify-content: space-between;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
}
</style>
