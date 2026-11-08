<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { TorrentFileDTO, TorrentDTO } from '../../shared/types.js';
import {
  getEbookFormat,
  getSavedEbookPosition,
  saveEbookPosition,
  getReaderPreferences,
  saveReaderPreferences,
  type ReaderTheme,
  type ComicReadingMode,
} from '../utils/ebook-helper.js';
import EpubViewer from './reader/EpubViewer.vue';
import PdfViewer from './reader/PdfViewer.vue';
import ComicViewer from './reader/ComicViewer.vue';

const props = defineProps<{
  file: TorrentFileDTO;
  torrent: TorrentDTO;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const format = computed(() => getEbookFormat(props.file.name));

// Preferences
const prefs = getReaderPreferences();
const currentTheme = ref<ReaderTheme>(prefs.theme);
const fontSize = ref<number>(prefs.fontSize);
const fontFamily = ref<'serif' | 'sans-serif' | 'monospace'>(prefs.fontFamily);
const comicMode = ref<ComicReadingMode>(prefs.comicMode);

// UI States
const isFullscreen = ref<boolean>(false);
const showChrome = ref<boolean>(true);
const isTocOpen = ref<boolean>(false);
const tocItems = ref<Array<{ id: string; label: string; href: string }>>([]);

// Progress
const currentProgress = ref<{
  current: number;
  total: number;
  percentage: number;
  label: string;
}>({
  current: 0,
  total: 0,
  percentage: 0,
  label: '',
});

// Component references
const epubRef = ref<any>(null);
const comicRef = ref<any>(null);
const modalContainerRef = ref<HTMLDivElement | null>(null);

// Saved position
const savedPosition = computed(() => {
  return getSavedEbookPosition(props.torrent.infoHash, props.file.index);
});

const onThemeChange = (theme: ReaderTheme) => {
  currentTheme.value = theme;
  saveReaderPreferences({ theme });
};

const onFontSizeChange = (delta: number) => {
  const newSize = Math.min(32, Math.max(12, fontSize.value + delta));
  fontSize.value = newSize;
  saveReaderPreferences({ fontSize: newSize });
};

const onFontFamilyChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  const newFont = target.value as 'serif' | 'sans-serif' | 'monospace';
  fontFamily.value = newFont;
  saveReaderPreferences({ fontFamily: newFont });
};

const onComicModeChange = (mode: ComicReadingMode) => {
  comicMode.value = mode;
  saveReaderPreferences({ comicMode: mode });
};

const onUpdateProgress = (prog: { current: number; total: number; percentage: number; label: string }) => {
  currentProgress.value = prog;
};

const onSavePosition = (pos: string) => {
  saveEbookPosition(props.torrent.infoHash, props.file.index, pos);
};

const onUpdateToc = (items: Array<{ id: string; label: string; href: string }>) => {
  tocItems.value = items;
};

const toggleToc = () => {
  isTocOpen.value = !isTocOpen.value;
};

const goToChapter = (href: string) => {
  if (epubRef.value) {
    epubRef.value.goToHref(href);
  }
  isTocOpen.value = false;
};

const toggleChrome = () => {
  showChrome.value = !showChrome.value;
};

const toggleFullscreen = async () => {
  const el = modalContainerRef.value as any;
  if (!el) return;

  try {
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
      isFullscreen.value = true;
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      }
      isFullscreen.value = false;
    }
  } catch (err) {
    console.warn('Fullscreen request failed:', err);
  }
};

const handleSliderChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const val = parseInt(target.value, 10);
  if (format.value === 'comic' && comicRef.value) {
    comicRef.value.goToPage(val - 1);
  }
};

const onKeydown = (e: KeyboardEvent) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
    return;
  }
  if (e.key === 'Escape') {
    if (isTocOpen.value) {
      isTocOpen.value = false;
    } else {
      emit('close');
    }
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="reader-modal-backdrop" @click.self="emit('close')">
    <div
      ref="modalContainerRef"
      class="reader-container"
      :class="[`theme-${currentTheme}`, { 'hide-chrome': !showChrome }]"
    >
      <!-- Top Chrome Bar -->
      <header v-show="showChrome" class="reader-header">
        <div class="header-left">
          <span class="badge-format" :class="format">
            {{ format === 'comic' ? 'BD / Manga' : format.toUpperCase() }}
          </span>
          <h2 class="book-title" :title="file.name">{{ file.name }}</h2>
        </div>

        <!-- Center Controls: Themes, Fonts, Comic Modes -->
        <div class="header-center">
          <!-- Theme Selector -->
          <div class="theme-selector-group">
            <button
              type="button"
              class="btn-theme dark"
              :class="{ active: currentTheme === 'dark' }"
              title="Thème Sombre"
              @click="onThemeChange('dark')"
            >
              🌙
            </button>
            <button
              type="button"
              class="btn-theme sepia"
              :class="{ active: currentTheme === 'sepia' }"
              title="Thème Sépia (confort des yeux)"
              @click="onThemeChange('sepia')"
            >
              📜
            </button>
            <button
              type="button"
              class="btn-theme light"
              :class="{ active: currentTheme === 'light' }"
              title="Thème Clair"
              @click="onThemeChange('light')"
            >
              ☀️
            </button>
          </div>

          <!-- Font Size & Family for EPUB -->
          <div v-if="format === 'epub'" class="font-controls-group">
            <button type="button" class="btn-ctrl" title="Diminuer la taille de police" @click="onFontSizeChange(-2)">
              A−
            </button>
            <span class="font-size-label">{{ fontSize }}px</span>
            <button type="button" class="btn-ctrl" title="Agrandir la taille de police" @click="onFontSizeChange(2)">
              A+
            </button>
            <select :value="fontFamily" class="select-font" @change="onFontFamilyChange" title="Police d'écriture">
              <option value="serif">Serif</option>
              <option value="sans-serif">Sans-Serif</option>
              <option value="monospace">Monospace</option>
            </select>
          </div>

          <!-- Comic Reading Modes (Webtoon, Single, Double) -->
          <div v-if="format === 'comic'" class="comic-mode-group">
            <button
              type="button"
              class="btn-ctrl"
              :class="{ active: comicMode === 'webtoon' }"
              title="Mode Webtoon (Défilement vertical continu iPad)"
              @click="onComicModeChange('webtoon')"
            >
              📱 Webtoon
            </button>
            <button
              type="button"
              class="btn-ctrl"
              :class="{ active: comicMode === 'single' }"
              title="Page simple"
              @click="onComicModeChange('single')"
            >
              📖 Page
            </button>
            <button
              type="button"
              class="btn-ctrl"
              :class="{ active: comicMode === 'double' }"
              title="Double page côte à côte (paysage)"
              @click="onComicModeChange('double')"
            >
              📑 Double
            </button>
          </div>

          <!-- Table of Contents Toggle (EPUB) -->
          <button
            v-if="tocItems.length > 0"
            type="button"
            class="btn-ctrl"
            :class="{ active: isTocOpen }"
            title="Sommaire / Chapitres"
            @click="toggleToc"
          >
            📋 Sommaire
          </button>
        </div>

        <!-- Right Controls: Fullscreen, Close -->
        <div class="header-right">
          <button
            type="button"
            class="btn-icon"
            :title="isFullscreen ? 'Quitter le plein écran' : 'Mode Plein Écran (Touche F)'"
            @click="toggleFullscreen"
          >
            {{ isFullscreen ? '⛶' : '⛶' }}
          </button>
          <button
            type="button"
            class="btn-icon btn-close"
            title="Fermer le lecteur (Échap)"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>
      </header>

      <!-- Main Reader Body -->
      <main class="reader-body">
        <!-- EPUB Viewer -->
        <EpubViewer
          v-if="format === 'epub'"
          ref="epubRef"
          :stream-url="file.streamUrl"
          :initial-position="savedPosition"
          :theme="currentTheme"
          :font-size="fontSize"
          :font-family="fontFamily"
          @update-toc="onUpdateToc"
          @update-progress="onUpdateProgress"
          @save-position="onSavePosition"
          @toggle-chrome="toggleChrome"
        />

        <!-- PDF Viewer -->
        <PdfViewer
          v-else-if="format === 'pdf'"
          :stream-url="file.streamUrl"
          :theme="currentTheme"
          @toggle-chrome="toggleChrome"
        />

        <!-- Comic / Manga / BD Viewer -->
        <ComicViewer
          v-else-if="format === 'comic'"
          ref="comicRef"
          :stream-url="file.streamUrl"
          :theme="currentTheme"
          :mode="comicMode"
          :initial-page="savedPosition ? parseInt(savedPosition, 10) : 0"
          @update-progress="onUpdateProgress"
          @save-position="onSavePosition"
          @toggle-chrome="toggleChrome"
        />

        <!-- Backdrop behind TOC Drawer for clicking outside to close -->
        <div v-if="isTocOpen" class="toc-backdrop" @click="isTocOpen = false"></div>

        <!-- Sliding Drawer for Table of Contents -->
        <transition name="slide-drawer">
          <aside v-if="isTocOpen" class="toc-drawer">
            <div class="drawer-header">
              <h3>Table des matières</h3>
              <button type="button" class="btn-drawer-close" @click="isTocOpen = false">✕</button>
            </div>
            <ul class="toc-list">
              <li
                v-for="item in tocItems"
                :key="item.id"
                class="toc-item"
                @click="goToChapter(item.href)"
              >
                {{ item.label || 'Chapitre' }}
              </li>
            </ul>
          </aside>
        </transition>
      </main>

      <!-- Bottom Progress Bar -->
      <footer v-show="showChrome && (currentProgress.total > 0 || currentProgress.percentage > 0)" class="reader-footer">
        <div class="footer-indicator">
          {{ currentProgress.label || `${currentProgress.percentage}%` }}
        </div>

        <div v-if="format === 'comic' && currentProgress.total > 0" class="footer-slider-wrapper">
          <input
            type="range"
            min="1"
            :max="currentProgress.total"
            :value="currentProgress.current"
            class="page-slider"
            @input="handleSliderChange"
          />
        </div>

        <div class="footer-hints">
          <span class="hint-pill">Balayez pour tourner les pages • Tapez au centre pour masquer</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.reader-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 0;
}

.reader-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background-color 0.25s ease, color 0.25s ease;
}

/* Themes */
.theme-dark {
  background: #0d0f18;
  color: #f1f5f9;
}

.theme-sepia {
  background: #fbf0d9;
  color: #5f4b32;
}

.theme-light {
  background: #ffffff;
  color: #1a202c;
}

/* Header */
.reader-header {
  height: 56px;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: inherit;
  z-index: 50;
  gap: 1rem;
}

.theme-sepia .reader-header {
  border-bottom-color: rgba(95, 75, 50, 0.15);
}

.theme-light .reader-header {
  border-bottom-color: rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
}

.badge-format {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge-format.epub {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.badge-format.pdf {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-format.comic {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.book-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Center Tools */
.header-center {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.theme-selector-group,
.font-controls-group,
.comic-mode-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.08);
  padding: 0.2rem 0.4rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.theme-sepia .theme-selector-group,
.theme-sepia .font-controls-group,
.theme-sepia .comic-mode-group {
  background: rgba(95, 75, 50, 0.08);
  border-color: rgba(95, 75, 50, 0.15);
}

.theme-light .theme-selector-group,
.theme-light .font-controls-group,
.theme-light .comic-mode-group {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.1);
}

.btn-theme {
  background: none;
  border: none;
  font-size: 1rem;
  padding: 0.2rem 0.35rem;
  border-radius: 0.35rem;
  cursor: pointer;
  opacity: 0.65;
  transition: all 0.2s;
}

.btn-theme.active,
.btn-theme:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.15);
}

.btn-ctrl {
  background: none;
  border: none;
  color: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.25rem 0.55rem;
  border-radius: 0.35rem;
  cursor: pointer;
  opacity: 0.75;
  transition: all 0.2s;
}

.btn-ctrl.active,
.btn-ctrl:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.15);
}

.font-size-label {
  font-size: 0.75rem;
  min-width: 32px;
  text-align: center;
  opacity: 0.8;
}

.select-font {
  background: transparent;
  color: inherit;
  border: none;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  outline: none;
}

.select-font option {
  background: #111827;
  color: #f1f5f9;
}

/* Right Controls */
.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-icon {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: inherit;
  border-radius: 0.5rem;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-close {
  color: #ef4444;
}

.btn-close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ffffff;
}

/* Body */
.reader-body {
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* Sliding Table of Contents Drawer Backdrop & Container */
.toc-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 95;
  animation: fadeIn 0.15s ease-out;
}

.toc-drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 340px;
  max-width: 85vw;
  background: #111424;
  color: #f1f5f9;
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 12px 0 35px rgba(0, 0, 0, 0.85);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.theme-dark .toc-drawer {
  background: #111424;
  color: #f1f5f9;
  border-right-color: rgba(255, 255, 255, 0.15);
}

.theme-sepia .toc-drawer {
  background: #f4e8cc;
  color: #5f4b32;
  border-right-color: rgba(95, 75, 50, 0.25);
  box-shadow: 12px 0 35px rgba(0, 0, 0, 0.35);
}

.theme-light .toc-drawer {
  background: #ffffff;
  color: #1a202c;
  border-right-color: rgba(0, 0, 0, 0.15);
  box-shadow: 12px 0 35px rgba(0, 0, 0, 0.25);
}

.drawer-header {
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.drawer-header h3 {
  margin: 0;
  font-size: 1rem;
}

.btn-drawer-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.1rem;
  cursor: pointer;
  opacity: 0.7;
}

.btn-drawer-close:hover {
  opacity: 1;
}

.toc-list {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0;
  overflow-y: auto;
  flex: 1;
}

.toc-item {
  padding: 0.75rem 1.25rem;
  font-size: 0.85rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background-color 0.2s;
}

.toc-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Drawer Transitions */
.slide-drawer-enter-active,
.slide-drawer-leave-active {
  transition: transform 0.25s ease-out;
}

.slide-drawer-enter-from,
.slide-drawer-leave-to {
  transform: translateX(-100%);
}

/* Footer */
.reader-footer {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: inherit;
  z-index: 50;
  font-size: 0.8rem;
  gap: 1.5rem;
}

.theme-sepia .reader-footer {
  border-top-color: rgba(95, 75, 50, 0.15);
}

.theme-light .reader-footer {
  border-top-color: rgba(0, 0, 0, 0.1);
}

.footer-indicator {
  font-weight: 600;
  opacity: 0.85;
  white-space: nowrap;
}

.footer-slider-wrapper {
  flex: 1;
  max-width: 450px;
  display: flex;
  align-items: center;
}

.page-slider {
  width: 100%;
  accent-color: #8b5cf6;
  cursor: pointer;
}

.footer-hints {
  opacity: 0.6;
  font-size: 0.75rem;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .footer-hints {
    display: none;
  }
  .header-center {
    display: none;
  }
}
</style>
