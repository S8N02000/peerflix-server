<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import JSZip from 'jszip';
import type { ReaderTheme, ComicReadingMode } from '../../utils/ebook-helper.js';

const props = defineProps<{
  streamUrl: string;
  theme: ReaderTheme;
  mode: ComicReadingMode;
  initialPage?: number;
}>();

const emit = defineEmits<{
  (e: 'update-progress', progress: { current: number; total: number; percentage: number; label: string }): void;
  (e: 'save-position', position: string): void;
  (e: 'toggle-chrome'): void;
}>();

const isLoading = ref<boolean>(true);
const loadingMessage = ref<string>('Téléchargement de la BD...');
const errorMessage = ref<string | null>(null);

const pages = ref<string[]>([]);
const currentPageIndex = ref<number>(props.initialPage || 0);
const containerRef = ref<HTMLDivElement | null>(null);

const totalPages = computed(() => pages.value.length);

const currentPagesInView = computed(() => {
  if (props.mode === 'double') {
    const list = [pages.value[currentPageIndex.value]];
    if (currentPageIndex.value + 1 < totalPages.value) {
      list.push(pages.value[currentPageIndex.value + 1]);
    }
    return list.filter(Boolean);
  }
  return [pages.value[currentPageIndex.value]].filter(Boolean);
});

const emitProgress = () => {
  if (totalPages.value === 0) return;
  const current = currentPageIndex.value + 1;
  const total = totalPages.value;
  const percentage = Math.round((current / total) * 100);
  emit('update-progress', {
    current,
    total,
    percentage,
    label: `Page ${current} / ${total}`,
  });
  emit('save-position', currentPageIndex.value.toString());
};

const goToPage = (index: number) => {
  if (index < 0) index = 0;
  if (index >= totalPages.value) index = totalPages.value - 1;
  currentPageIndex.value = index;
  emitProgress();
};

const next = () => {
  const step = props.mode === 'double' ? 2 : 1;
  if (currentPageIndex.value + step < totalPages.value) {
    goToPage(currentPageIndex.value + step);
  } else if (currentPageIndex.value < totalPages.value - 1) {
    goToPage(totalPages.value - 1);
  }
};

const prev = () => {
  const step = props.mode === 'double' ? 2 : 1;
  if (currentPageIndex.value - step >= 0) {
    goToPage(currentPageIndex.value - step);
  } else if (currentPageIndex.value > 0) {
    goToPage(0);
  }
};

const loadComicArchive = async () => {
  isLoading.value = true;
  errorMessage.value = null;
  loadingMessage.value = 'Téléchargement de la bande dessinée...';

  try {
    const response = await fetch(props.streamUrl, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Erreur réseau (${response.status}) lors du téléchargement.`);
    }

    loadingMessage.value = 'Extraction des pages (CBZ / ZIP)...';
    const arrayBuffer = await response.arrayBuffer();

    const zip = await JSZip.loadAsync(arrayBuffer);
    const imageEntries: Array<{ name: string; file: JSZip.JSZipObject }> = [];

    zip.forEach((relativePath, zipEntry) => {
      if (
        !zipEntry.dir &&
        !relativePath.startsWith('__MACOSX') &&
        !relativePath.includes('/.') &&
        /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(relativePath)
      ) {
        imageEntries.push({ name: relativePath, file: zipEntry });
      }
    });

    if (imageEntries.length === 0) {
      throw new Error("Aucune image valide n'a été trouvée dans cette archive.");
    }

    // Natural sort: page 1, 2, ... 10, etc.
    imageEntries.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    loadingMessage.value = `Préparation des ${imageEntries.length} planches...`;

    // Convert all images to ObjectURLs
    const blobUrls: string[] = [];
    for (const item of imageEntries) {
      const blob = await item.file.async('blob');
      blobUrls.push(URL.createObjectURL(blob));
    }

    pages.value = blobUrls;
    if (props.initialPage && props.initialPage < blobUrls.length) {
      currentPageIndex.value = props.initialPage;
    }
    emitProgress();
    isLoading.value = false;
  } catch (err: any) {
    isLoading.value = false;
    errorMessage.value = err.message || "Erreur lors de l'extraction de la BD.";
  }
};

// iPad touch swipe detection
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

const onTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }
};

const onTouchEnd = (e: TouchEvent) => {
  if (e.changedTouches.length === 1) {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;
    const elapsed = Date.now() - touchStartTime;

    // In webtoon mode, let native vertical scroll take over
    if (props.mode === 'webtoon') {
      if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15 && elapsed < 350) {
        emit('toggle-chrome');
      }
      return;
    }

    // Swipe left/right
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) && elapsed < 500) {
      if (diffX < 0) {
        next();
      } else {
        prev();
      }
    } else if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15 && elapsed < 350) {
      // Tap in center zone toggles controls
      emit('toggle-chrome');
    }
  }
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    next();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    prev();
  }
};

watch(() => props.mode, () => {
  emitProgress();
});

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  loadComicArchive();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  // Clean up object URLs
  pages.value.forEach((url) => {
    URL.revokeObjectURL(url);
  });
});

defineExpose({
  next,
  prev,
  goToPage,
});
</script>

<template>
  <div
    ref="containerRef"
    class="comic-viewer-container"
    :class="[`theme-${theme}`, `mode-${mode}`]"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <!-- Loading State -->
    <div v-if="isLoading" class="comic-loading-pane">
      <span class="spinner-icon">📚</span>
      <p>{{ loadingMessage }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMessage" class="comic-error-pane">
      ⚠️ {{ errorMessage }}
    </div>

    <!-- Webtoon Mode: Continuous vertical scroll -->
    <div v-else-if="mode === 'webtoon'" class="webtoon-stage">
      <div v-for="(pageUrl, idx) in pages" :key="idx" class="webtoon-page-item">
        <img :src="pageUrl" :alt="`Page ${idx + 1}`" class="webtoon-img" loading="lazy" />
      </div>
    </div>

    <!-- Single or Double Page Mode -->
    <div v-else class="page-stage">
      <div class="spread-wrapper" :class="{ 'is-double': mode === 'double' && currentPagesInView.length > 1 }">
        <img
          v-for="(pageUrl, idx) in currentPagesInView"
          :key="idx"
          :src="pageUrl"
          :alt="`Planche ${currentPageIndex + idx + 1}`"
          class="comic-img"
        />
      </div>

      <!-- Hitbox hotspot zones for left / right page clicks -->
      <div class="edge-hotspot left-edge" title="Page précédente" @click="prev"></div>
      <div class="edge-hotspot right-edge" title="Page suivante" @click="next"></div>
    </div>
  </div>
</template>

<style scoped>
.comic-viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  user-select: none;
  -webkit-user-select: none;
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

/* Single / Double Page Stage */
.page-stage {
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.spread-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
  gap: 8px;
}

.comic-img {
  max-width: 100%;
  max-height: calc(100vh - 120px);
  object-fit: contain;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.spread-wrapper.is-double .comic-img {
  max-width: 49vw;
}

/* Webtoon Continuous Scroll Mode */
.webtoon-stage {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0;
}

.webtoon-page-item {
  width: 100%;
  max-width: 900px;
  display: flex;
  justify-content: center;
}

.webtoon-img {
  width: 100%;
  height: auto;
  display: block;
}

/* Edge Hitboxes for desktop & iPad taps */
.edge-hotspot {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 25%;
  z-index: 10;
  cursor: pointer;
}

.left-edge {
  left: 0;
}

.right-edge {
  right: 0;
}

.comic-loading-pane,
.comic-error-pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 15;
}

.spinner-icon {
  font-size: 2.5rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
}
</style>
