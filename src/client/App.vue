<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
import C411SearchPanel from './components/C411SearchPanel.vue';
import TvGuideModal from './components/TvGuideModal.vue';
import { fetchC411Status } from './services/api.js';
import type { C411ProfileDTO } from '../shared/types.js';

const {
  torrents,
  systemStatus,
  searchQuery,
  selectedCategory,
  sortBy,
  onlyMyTorrents,
  currentUser,
  isAdmin,
  hideJunkFiles,
  isLoading,
  errorMessage,
  filteredTorrents,
  categoryCounts,
  loadTorrents,
  addTorrentByLink,
  uploadFiles,
  togglePin,
  toggleVisibility,
  updateCurrentUser,
  updateIsAdmin,
  deleteTorrent,
  pauseTorrent,
  resumeTorrent,
  selectFile,
  deselectFile,
  selectAllFiles,
  deselectAllFiles,
  cleanUnpinned,
  initSocket,
} = useTorrents();

// Modals state
const isTvGuideOpen = ref(false);
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

const c411Profile = ref<C411ProfileDTO | null>(null);
const currentTab = ref<'downloads' | 'c411'>('downloads');
const activeHashes = computed(() => new Set(torrents.value.map((t) => t.infoHash)));

const showAddedToast = ref(false);
const lastAddedName = ref('');
let toastTimer: any = null;

const handleComputeHash = (file: TorrentFileDTO, torrent: TorrentDTO) => {
  activeHashFile.value = file;
  activeHashTorrent.value = torrent;
};

const handleC411TorrentAdded = async (infoHash: string) => {
  await loadTorrents();
  const found = torrents.value.find((t) => t.infoHash === infoHash);
  lastAddedName.value = found?.name || 'Nouveau torrent C411';
  showAddedToast.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    showAddedToast.value = false;
  }, 6000);
};

const switchToDownloads = () => {
  currentTab.value = 'downloads';
  showAddedToast.value = false;
};

onMounted(async () => {
  initSocket();
  loadTorrents();
  try {
    const status = await fetchC411Status();
    c411Profile.value = status;
  } catch {
    // Non-blocking
  }
});
</script>

<template>
  <div class="app-layout">
    <!-- Header with System Disk Stats & Clean trigger -->
    <AppHeader
      :system-status="systemStatus"
      :c411-profile="c411Profile"
      :current-user="currentUser"
      :is-admin="isAdmin"
      @clean-unpinned="cleanUnpinned"
      @open-c411="currentTab = 'c411'"
      @open-tv-guide="isTvGuideOpen = true"
      @update:current-user="updateCurrentUser"
      @update:is-admin="updateIsAdmin"
    />

    <main class="main-content">
      <!-- Main Navigation Tabs Bar -->
      <nav class="main-view-nav">
        <button
          type="button"
          class="view-nav-tab"
          :class="{ active: currentTab === 'downloads' }"
          @click="currentTab = 'downloads'"
        >
          <span class="nav-tab-icon">📥</span>
          <span class="nav-tab-label">Mes Téléchargements</span>
          <span v-if="torrents.length > 0" class="nav-tab-counter">{{ torrents.length }}</span>
        </button>

        <button
          v-if="c411Profile?.enabled"
          type="button"
          class="view-nav-tab view-nav-tab-c411"
          :class="{ active: currentTab === 'c411' }"
          @click="currentTab = 'c411'"
        >
          <span class="nav-tab-icon">🔍</span>
          <span class="nav-tab-label">Recherche C411</span>
          <span class="nav-tab-live-dot" title="Catalogue C411 actif"></span>
        </button>
      </nav>

      <!-- TAB 1: Mes Téléchargements & Streaming -->
      <div v-show="currentTab === 'downloads'" class="tab-content-downloads">
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
          :sort-by="sortBy"
          :counts="categoryCounts"
          :only-my-torrents="onlyMyTorrents"
          @update:selected-category="selectedCategory = $event"
          @update:search-query="searchQuery = $event"
          @update:sort-by="sortBy = $event"
          @update:only-my-torrents="onlyMyTorrents = $event"
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
            :system-status="systemStatus"
            :hide-junk-files="hideJunkFiles"
            :current-user="currentUser"
            :is-admin="isAdmin"
            @toggle-pin="togglePin"
            @toggle-visibility="toggleVisibility"
            @pause="pauseTorrent"
            @resume="resumeTorrent"
            @delete="deleteTorrent"
            @select-file="selectFile"
            @deselect-file="deselectFile"
            @select-all="selectAllFiles"
            @deselect-all="deselectAllFiles"
            @play-media="handlePlayMedia"
            @open-qr="handleOpenQrDirect"
            @preview-nfo="handlePreviewNfo"
            @compute-hash="handleComputeHash"
          />
        </section>
      </div>

      <!-- TAB 2: Recherche C411 -->
      <div v-show="currentTab === 'c411'" class="tab-content-c411">
        <C411SearchPanel
          v-if="c411Profile?.enabled"
          :c411-profile="c411Profile"
          :active-hashes="activeHashes"
          @torrent-added="handleC411TorrentAdded"
        />
      </div>

      <!-- Floating Toast for added C411 torrent -->
      <transition name="toast-slide">
        <div v-if="showAddedToast" class="c411-toast-alert">
          <div class="toast-body">
            <span class="toast-icon">🚀</span>
            <div class="toast-info">
              <div class="toast-title">Torrent lancé dans Peerflix !</div>
              <div class="toast-subtitle">{{ lastAddedName }}</div>
            </div>
          </div>
          <button type="button" class="btn-toast-switch" @click="switchToDownloads">
            Voir mes torrents ➔
          </button>
          <button type="button" class="btn-toast-dismiss" title="Fermer" @click="showAddedToast = false">✕</button>
        </div>
      </transition>
    </main>

    <!-- Modals -->
    <MediaPlayerModal
      v-if="activeVideoFile && activeVideoTorrent"
      :file="activeVideoFile"
      :torrent="activeVideoTorrent"
      :system-status="systemStatus"
      @close="activeVideoFile = null; activeVideoTorrent = null"
      @open-qr="handleOpenQr"
      @change-file="activeVideoFile = $event"
    />

    <QrCodeModal
      v-if="activeQrFile && activeQrTorrent"
      :file="activeQrFile"
      :torrent="activeQrTorrent"
      :system-status="systemStatus"
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

    <TvGuideModal
      :is-open="isTvGuideOpen"
      :system-status="systemStatus"
      :current-user="currentUser"
      @close="isTvGuideOpen = false"
    />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: #09090d;
  background-image: radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.07) 0%, rgba(139, 92, 246, 0.04) 35%, transparent 70%);
  color: #f4f4f6;
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
  background: #12131a;
  border-radius: 14px;
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

/* Main View Nav Tabs */
.main-view-nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 0.75rem;
}

.view-nav-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.65rem 1.25rem;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.view-nav-tab:hover {
  background: #1c2033;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.view-nav-tab.active {
  background: #1e293b;
  color: #38bdf8;
  border-color: #38bdf8;
  box-shadow: 0 4px 16px rgba(56, 189, 248, 0.15);
}

.view-nav-tab-c411.active {
  color: #10b981;
  border-color: #10b981;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.15);
}

.nav-tab-icon {
  font-size: 1.1rem;
}

.nav-tab-counter {
  background: #3b82f6;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  margin-left: 0.2rem;
}

.nav-tab-live-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 8px #10b981;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

/* Floating Toast Alert */
.c411-toast-alert {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: #141724;
  border: 1px solid #10b981;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
  z-index: 999;
  max-width: 450px;
}

.toast-body {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.toast-icon {
  font-size: 1.5rem;
}

.toast-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.toast-title {
  font-weight: 700;
  color: #10b981;
  font-size: 0.9rem;
}

.toast-subtitle {
  font-size: 0.78rem;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-toast-switch {
  background: #10b981;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 0.45rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.btn-toast-switch:hover {
  background: #059669;
}

.btn-toast-dismiss {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.2rem;
}

.btn-toast-dismiss:hover {
  color: #ffffff;
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-enter-from {
  transform: translateY(20px);
  opacity: 0;
}

.toast-slide-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
