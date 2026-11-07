<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { TorrentDTO, TorrentFileDTO } from '../shared/types.js';
import { useTorrents } from './composables/useTorrents.js';

import AppHeader from './components/AppHeader.vue';
import DropZoneBar from './components/DropZoneBar.vue';
import CategoryFilterBar from './components/CategoryFilterBar.vue';
import TorrentCard from './components/TorrentCard.vue';
import MediaPlayerModal from './components/MediaPlayerModal.vue';
import QrCodeModal from './components/QrCodeModal.vue';
import NfoViewerModal from './components/NfoViewerModal.vue';
import Sha256Modal from './components/Sha256Modal.vue';

const {
  torrents,
  systemStatus,
  searchQuery,
  selectedCategory,
  hideJunkFiles,
  isLoading,
  errorMessage,
  filteredTorrents,
  categoryCounts,
  loadTorrents,
  addTorrentByLink,
  uploadFiles,
  togglePin,
  deleteTorrent,
  pauseTorrent,
  resumeTorrent,
  selectFile,
  deselectFile,
  initSocket,
} = useTorrents();

// Modals state
const activeVideoFile = ref<TorrentFileDTO | null>(null);
const activeVideoTorrent = ref<TorrentDTO | null>(null);

const activeQrFile = ref<TorrentFileDTO | null>(null);
const activeQrTorrent = ref<TorrentDTO | null>(null);

const activeNfoFile = ref<TorrentFileDTO | null>(null);
const activeNfoTorrent = ref<TorrentDTO | null>(null);

const activeHashFile = ref<TorrentFileDTO | null>(null);
const activeHashTorrent = ref<TorrentDTO | null>(null);

// Modal Handlers
const handlePlayMedia = (file: TorrentFileDTO, torrent: TorrentDTO) => {
  activeVideoFile.value = file;
  activeVideoTorrent.value = torrent;
};

const handleOpenQr = () => {
  if (activeVideoFile.value && activeVideoTorrent.value) {
    activeQrFile.value = activeVideoFile.value;
    activeQrTorrent.value = activeVideoTorrent.value;
  }
};

const handleOpenQrDirect = (file: TorrentFileDTO, torrent: TorrentDTO) => {
  activeQrFile.value = file;
  activeQrTorrent.value = torrent;
};

const handlePreviewNfo = (file: TorrentFileDTO, torrent: TorrentDTO) => {
  activeNfoFile.value = file;
  activeNfoTorrent.value = torrent;
};

const handleComputeHash = (file: TorrentFileDTO, torrent: TorrentDTO) => {
  activeHashFile.value = file;
  activeHashTorrent.value = torrent;
};

onMounted(() => {
  initSocket();
  loadTorrents();
});
</script>

<template>
  <div class="app-layout">
    <!-- Header with System Disk Stats & Clean trigger -->
    <AppHeader :system-status="systemStatus" />

    <main class="main-content">
      <!-- Universal Drag & Drop / Input Bar -->
      <DropZoneBar
        :is-submitting="isLoading"
        :error="errorMessage"
        @add-link="addTorrentByLink"
        @upload-files="uploadFiles"
      />

      <!-- Categories & Display Options Bar -->
      <CategoryFilterBar
        :selected-category="selectedCategory"
        :search-query="searchQuery"
        :hide-junk-files="hideJunkFiles"
        :counts="categoryCounts"
        @update:selected-category="selectedCategory = $event"
        @update:search-query="searchQuery = $event"
        @update:hide-junk-files="hideJunkFiles = $event"
      />

      <!-- Torrents List Area -->
      <section class="torrents-container">
        <!-- Empty State -->
        <div v-if="filteredTorrents.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <h3 class="empty-title">Aucun torrent actif</h3>
          <p class="empty-desc">
            Glissez-déposez un fichier <code>.torrent</code> ou collez un lien Magnet avec <kbd>Ctrl+V</kbd> pour démarrer.
          </p>
        </div>

        <!-- Torrent Cards -->
        <TorrentCard
          v-for="torrent in filteredTorrents"
          :key="torrent.infoHash"
          :torrent="torrent"
          :hide-junk-files="hideJunkFiles"
          @toggle-pin="togglePin"
          @pause="pauseTorrent"
          @resume="resumeTorrent"
          @delete="deleteTorrent"
          @select-file="selectFile"
          @deselect-file="deselectFile"
          @play-media="handlePlayMedia"
          @open-qr="handleOpenQrDirect"
          @preview-nfo="handlePreviewNfo"
          @compute-hash="handleComputeHash"
        />
      </section>
    </main>

    <!-- Modals -->
    <MediaPlayerModal
      v-if="activeVideoFile && activeVideoTorrent"
      :file="activeVideoFile"
      :torrent="activeVideoTorrent"
      @close="activeVideoFile = null; activeVideoTorrent = null"
      @open-qr="handleOpenQr"
    />

    <QrCodeModal
      v-if="activeQrFile && activeQrTorrent"
      :file="activeQrFile"
      :torrent="activeQrTorrent"
      @close="activeQrFile = null; activeQrTorrent = null"
    />

    <NfoViewerModal
      v-if="activeNfoFile && activeNfoTorrent"
      :file="activeNfoFile"
      :torrent="activeNfoTorrent"
      @close="activeNfoFile = null; activeNfoTorrent = null"
    />

    <Sha256Modal
      v-if="activeHashFile && activeHashTorrent"
      :file="activeHashFile"
      :torrent="activeHashTorrent"
      @close="activeHashFile = null; activeHashTorrent = null"
    />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: #0b0f19;
  color: #f3f4f6;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem 1.25rem;
  box-sizing: border-box;
}

.torrents-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 1.5rem;
  background: #111827;
  border-radius: 1rem;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  margin-top: 1rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #e5e7eb;
  margin: 0 0 0.5rem 0;
}

.empty-desc {
  color: #9ca3af;
  font-size: 0.9rem;
  margin: 0;
}

.empty-desc code {
  background: #1f2937;
  color: #3b82f6;
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  font-family: monospace;
}

.empty-desc kbd {
  background: #1f2937;
  color: #e5e7eb;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  border: 1px solid #374151;
  font-family: monospace;
}
</style>
