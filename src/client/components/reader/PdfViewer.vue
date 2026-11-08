<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ReaderTheme } from '../../utils/ebook-helper.js';

const props = defineProps<{
  streamUrl: string;
  theme: ReaderTheme;
}>();

const emit = defineEmits<{
  (e: 'toggle-chrome'): void;
}>();

const zoomLevel = ref<number>(100);
const isLoading = ref<boolean>(true);
const hasError = ref<boolean>(false);

const zoomScale = computed(() => zoomLevel.value / 100);

const zoomIn = () => {
  zoomLevel.value = Math.min(250, zoomLevel.value + 25);
};

const zoomOut = () => {
  zoomLevel.value = Math.max(50, zoomLevel.value - 25);
};

const resetZoom = () => {
  zoomLevel.value = 100;
};

const onIframeLoaded = () => {
  isLoading.value = false;
};

const onIframeError = () => {
  isLoading.value = false;
  hasError.value = true;
};
</script>

<template>
  <div class="pdf-viewer-container" :class="`theme-${theme}`">
    <!-- Floating Quick Toolbar -->
    <div class="pdf-quick-toolbar">
      <div class="zoom-controls">
        <button type="button" class="btn-tool" title="Zoom arrière" :disabled="zoomLevel <= 50" @click="zoomOut">
          🔍−
        </button>
        <span class="zoom-indicator" @click="resetZoom" title="Réinitialiser zoom">{{ zoomLevel }}%</span>
        <button type="button" class="btn-tool" title="Zoom avant" :disabled="zoomLevel >= 250" @click="zoomIn">
          🔍+
        </button>
      </div>

      <div class="tool-actions">
        <a :href="streamUrl" target="_blank" rel="noopener noreferrer" class="btn-tool link-tool" title="Ouvrir dans un nouvel onglet Safari / Chrome">
          ↗ Nouvel onglet
        </a>
        <a :href="streamUrl" download class="btn-tool link-tool" title="Télécharger le fichier PDF">
          ⬇ Télécharger
        </a>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="pdf-loading-pane">
      <span class="spinner-icon">🔄</span>
      <p>Chargement du document PDF...</p>
    </div>

    <!-- Error State -->
    <div v-if="hasError" class="pdf-error-pane">
      <p>⚠️ Impossible d'afficher le document directement.</p>
      <a :href="streamUrl" target="_blank" class="btn-open-fallback">Ouvrir dans Safari / Navigateur</a>
    </div>

    <!-- PDF Presentation Stage -->
    <div class="pdf-stage" :style="{ transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none', transformOrigin: 'top center' }">
      <iframe
        :src="streamUrl"
        class="pdf-frame"
        title="Lecteur PDF"
        @load="onIframeLoaded"
        @error="onIframeError"
      ></iframe>
    </div>
  </div>
</template>

<style scoped>
.pdf-viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: background-color 0.25s ease;
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

.pdf-quick-toolbar {
  position: absolute;
  top: 1rem;
  right: 1.25rem;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(17, 24, 39, 0.85);
  backdrop-filter: blur(8px);
  padding: 0.35rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.zoom-controls,
.tool-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.btn-tool {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #f1f5f9;
  border-radius: 0.5rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-tool:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.btn-tool:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.zoom-indicator {
  font-size: 0.8rem;
  color: #94a3b8;
  padding: 0 0.25rem;
  cursor: pointer;
  min-width: 42px;
  text-align: center;
}

.pdf-stage {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  transition: transform 0.2s ease-out;
}

.pdf-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.pdf-loading-pane,
.pdf-error-pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 10;
  background: rgba(13, 15, 24, 0.8);
}

.spinner-icon {
  font-size: 2.2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-open-fallback {
  background: #3b82f6;
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 600;
}
</style>
