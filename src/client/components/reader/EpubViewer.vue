<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import ePub from 'epubjs';
import type { ReaderTheme } from '../../utils/ebook-helper.js';

const props = defineProps<{
  streamUrl: string;
  initialPosition?: string | null;
  theme: ReaderTheme;
  fontSize: number;
  fontFamily: 'serif' | 'sans-serif' | 'monospace';
}>();

const emit = defineEmits<{
  (e: 'update-toc', items: Array<{ id: string; label: string; href: string }>): void;
  (e: 'update-progress', progress: { current: number; total: number; percentage: number; label: string }): void;
  (e: 'save-position', cfi: string): void;
  (e: 'toggle-chrome'): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

let book: any = null;
let rendition: any = null;

const applyTheme = (themeName: ReaderTheme) => {
  if (!rendition) return;

  rendition.themes.register('dark', {
    body: {
      background: '#0d0f18 !important',
      color: '#e2e8f0 !important',
      'padding-top': '20px !important',
      'padding-bottom': '20px !important',
    },
    'p, span, h1, h2, h3, h4, h5, div, li, blockquote': {
      color: '#e2e8f0 !important',
    },
    a: {
      color: '#38bdf8 !important',
    },
  });

  rendition.themes.register('sepia', {
    body: {
      background: '#fbf0d9 !important',
      color: '#5f4b32 !important',
      'padding-top': '20px !important',
      'padding-bottom': '20px !important',
    },
    'p, span, h1, h2, h3, h4, h5, div, li, blockquote': {
      color: '#5f4b32 !important',
    },
    a: {
      color: '#b45309 !important',
    },
  });

  rendition.themes.register('light', {
    body: {
      background: '#ffffff !important',
      color: '#1a202c !important',
      'padding-top': '20px !important',
      'padding-bottom': '20px !important',
    },
    'p, span, h1, h2, h3, h4, h5, div, li, blockquote': {
      color: '#1a202c !important',
    },
    a: {
      color: '#2563eb !important',
    },
  });

  rendition.themes.select(themeName);
};

const applyFontSettings = () => {
  if (!rendition) return;
  rendition.themes.fontSize(`${props.fontSize}px`);

  let fontCss = 'Georgia, "Times New Roman", serif';
  if (props.fontFamily === 'sans-serif') {
    fontCss = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  } else if (props.fontFamily === 'monospace') {
    fontCss = '"JetBrains Mono", Consolas, Monaco, monospace';
  }
  rendition.themes.font(fontCss);
};

const initBook = async () => {
  if (!containerRef.value) return;
  isLoading.value = true;
  errorMessage.value = null;

  try {
    // Fetch EPUB as ArrayBuffer so epubjs parses the ZIP archive completely in memory
    // and never sends broken relative HTTP requests for META-INF/container.xml
    const response = await fetch(props.streamUrl, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Erreur réseau (${response.status}) lors du téléchargement de l'eBook.`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // Instantiate epubjs with arrayBuffer
    book = (ePub as any)(arrayBuffer);

    rendition = book.renderTo(containerRef.value, {
      width: '100%',
      height: '100%',
      spread: 'auto',
      flow: 'paginated',
      minSpreadWidth: 800,
    });

    applyTheme(props.theme);
    applyFontSettings();

    // Display initial position or start
    await rendition.display(props.initialPosition || undefined);

    // Generate locations for percentage calculation in background
    book.ready.then(() => {
      return book.locations.generate(1000);
    }).then(() => {
      if (rendition?.currentLocation()?.start?.cfi) {
        const cfi = rendition.currentLocation().start.cfi;
        const pct = Math.floor(book.locations.percentageFromCfi(cfi) * 100);
        emit('update-progress', {
          current: 0,
          total: 0,
          percentage: pct,
          label: `${pct}%`,
        });
      }
    }).catch(() => {
      // Ignore background locations error
    });

    // Extract Table of Contents
    book.loaded.navigation.then((nav: any) => {
      if (Array.isArray(nav?.toc)) {
        const items = nav.toc.map((item: any) => ({
          id: item.id || item.href,
          label: (item.label || '').trim(),
          href: item.href,
        }));
        emit('update-toc', items);
      }
    });

    // Relocated (page change) listener
    rendition.on('relocated', (location: any) => {
      if (location?.start?.cfi) {
        emit('save-position', location.start.cfi);
        let pct = 0;
        if (book.locations && book.locations.length()) {
          pct = Math.floor(book.locations.percentageFromCfi(location.start.cfi) * 100);
        }
        emit('update-progress', {
          current: location.start.displayed?.page || 0,
          total: location.start.displayed?.total || 0,
          percentage: pct,
          label: pct > 0 ? `${pct}%` : '',
        });
      }
    });

    // iPad / Mobile touch swipe detection inside rendition iframe
    rendition.on('rendered', (_: any, iframeView: any) => {
      const doc = iframeView?.document;
      if (doc) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        doc.addEventListener(
          'touchstart',
          (e: TouchEvent) => {
            if (e.touches.length === 1) {
              touchStartX = e.touches[0].clientX;
              touchStartY = e.touches[0].clientY;
              touchStartTime = Date.now();
            }
          },
          { passive: true }
        );

        doc.addEventListener(
          'touchend',
          (e: TouchEvent) => {
            if (e.changedTouches.length === 1) {
              const diffX = e.changedTouches[0].clientX - touchStartX;
              const diffY = e.changedTouches[0].clientY - touchStartY;
              const elapsed = Date.now() - touchStartTime;

              // Horizontal swipe
              if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) && elapsed < 500) {
                if (diffX < 0) {
                  next();
                } else {
                  prev();
                }
              } else if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10 && elapsed < 350) {
                // Short tap on middle area toggles chrome
                emit('toggle-chrome');
              }
            }
          },
          { passive: true }
        );
      }
    });

    isLoading.value = false;
  } catch (err: any) {
    isLoading.value = false;
    errorMessage.value = err.message || "Impossible de charger l'eBook.";
  }
};

const next = () => {
  if (rendition) rendition.next();
};

const prev = () => {
  if (rendition) rendition.prev();
};

const goToHref = (href: string) => {
  if (rendition) rendition.display(href);
};

watch(() => props.theme, (newTheme) => {
  applyTheme(newTheme);
});

watch([() => props.fontSize, () => props.fontFamily], () => {
  applyFontSettings();
});

onMounted(() => {
  initBook();
});

onUnmounted(() => {
  if (rendition) {
    try {
      rendition.destroy();
    } catch {}
    rendition = null;
  }
  if (book) {
    try {
      book.destroy();
    } catch {}
    book = null;
  }
});

defineExpose({
  next,
  prev,
  goToHref,
});
</script>

<template>
  <div class="epub-viewer-container" :class="`theme-${theme}`">
    <!-- Loading Spinner -->
    <div v-if="isLoading" class="epub-loading-pane">
      <span class="spinner-icon">🔄</span>
      <p>Chargement du livre numérique...</p>
    </div>

    <!-- Error Pane -->
    <div v-else-if="errorMessage" class="epub-error-pane">
      ⚠️ {{ errorMessage }}
    </div>

    <!-- EPUB Render Target Area -->
    <div ref="containerRef" class="epub-render-stage"></div>

    <!-- Clickable Invisible Edge Hotspots for Desktop / Quick Tap -->
    <div class="edge-hotspot left-edge" title="Page précédente" @click="prev"></div>
    <div class="edge-hotspot right-edge" title="Page suivante" @click="next"></div>
  </div>
</template>

<style scoped>
.epub-viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: background-color 0.25s ease, color 0.25s ease;
}

.theme-dark {
  background: #0d0f18;
  color: #e2e8f0;
}

.theme-sepia {
  background: #fbf0d9;
  color: #5f4b32;
}

.theme-light {
  background: #ffffff;
  color: #1a202c;
}

.epub-render-stage {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.epub-loading-pane,
.epub-error-pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  z-index: 10;
}

.spinner-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Invisible side hitboxes for comfortable clicking */
.edge-hotspot {
  position: absolute;
  top: 60px;
  bottom: 60px;
  width: 12%;
  z-index: 5;
  cursor: pointer;
}

.left-edge {
  left: 0;
}

.right-edge {
  right: 0;
}
</style>
