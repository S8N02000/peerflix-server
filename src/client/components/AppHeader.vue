<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SystemStatusDTO, C411ProfileDTO } from '../../shared/types.js';
import { formatBytes } from '../composables/useTorrents.js';
import { getExternalBaseUrl } from '../utils/auth-url.js';

const props = defineProps<{
  systemStatus: SystemStatusDTO | null;
  c411Profile?: C411ProfileDTO | null;
}>();

const emit = defineEmits<{
  (e: 'clean-unpinned'): void;
  (e: 'open-c411'): void;
}>();

const copied = ref(false);

const handleCleanClick = () => {
  if (typeof window !== 'undefined') {
    if (window.confirm('Supprimer tous les torrents non épinglés 📌 pour libérer de l\'espace disque ?')) {
      emit('clean-unpinned');
    }
  }
};

const diskClass = computed(() => {
  const disk = props.systemStatus?.disk;
  if (!disk) return 'disk-normal';
  const percent = typeof disk.quotaPercent === 'number' ? disk.quotaPercent : disk.usedPercent ?? 0;
  if (percent >= 90) return 'disk-danger';
  if (percent >= 75) return 'disk-warning';
  return 'disk-normal';
});

const displayPercent = computed(() => {
  const disk = props.systemStatus?.disk;
  if (!disk) return 0;
  return typeof disk.quotaPercent === 'number' ? disk.quotaPercent : disk.usedPercent ?? 0;
});

const storageTooltip = computed(() => {
  const disk = props.systemStatus?.disk;
  if (!disk) return '';
  if (typeof disk.maxQuotaBytes === 'number' && disk.maxQuotaBytes > 0) {
    const allocated = formatBytes(disk.peerflixUsedBytes ?? 0);
    const downloaded = disk.peerflixDownloadedBytes !== undefined ? formatBytes(disk.peerflixDownloadedBytes) : null;
    const quota = formatBytes(disk.maxQuotaBytes);
    const freeHost = formatBytes(disk.freeBytes);
    return downloaded
      ? `Quota Peerflix : ${allocated} alloués / ${quota} (${downloaded} téléchargés sur disque) • ${freeHost} libres sur le serveur`
      : `Quota Peerflix : ${allocated} alloués / ${quota} • ${freeHost} libres sur le serveur`;
  }
  return `Espace total serveur : ${formatBytes(disk.usedBytes)} utilisés sur ${formatBytes(disk.totalBytes)} (${formatBytes(disk.freeBytes)} libres)`;
});

const formattedStorage = computed(() => {
  const disk = props.systemStatus?.disk;
  if (!disk) return 'Stockage : Inconnu';

  // If a quota is set for Peerflix, display Peerflix storage clearly
  if (typeof disk.maxQuotaBytes === 'number' && disk.maxQuotaBytes > 0) {
    const peerflixUsed = formatBytes(disk.peerflixUsedBytes ?? 0);
    const quota = formatBytes(disk.maxQuotaBytes);
    const freeHost = formatBytes(disk.freeBytes);
    const percent = disk.quotaPercent ?? 0;
    return `Peerflix : ${peerflixUsed} / ${quota} (${freeHost} libres) ${percent}%`;
  }

  const used = formatBytes(disk.usedBytes);
  const total = formatBytes(disk.totalBytes);
  const free = formatBytes(disk.freeBytes);
  return `Stockage : ${used} / ${total} (${free} libres) ${disk.usedPercent}%`;
});

const copyPlaylistUrl = async () => {
  if (typeof window === 'undefined') return;
  const baseUrl = getExternalBaseUrl(props.systemStatus);
  const fullUrl = `${baseUrl}/playlist.m3u`;
  try {
    await navigator.clipboard.writeText(fullUrl);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Fallback prompt
    window.prompt('URL de la playlist TV :', fullUrl);
  }
};
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo-box">
        <img src="../assets/logo.svg" alt="Peerflix Logo" class="app-logo" />
      </div>
      <div class="title-box">
        <h1 class="app-title">Peerflix</h1>
      </div>
    </div>

    <div class="header-right">
      <!-- C411 User Profile Widget -->
      <div
        v-if="c411Profile?.enabled"
        class="c411-header-widget interactive"
        title="C411 Connecté - Cliquez pour ouvrir l'onglet Recherche"
        @click="emit('open-c411')"
      >
        <span class="c411-logo-badge">C411</span>
        <span v-if="c411Profile.uploadedBytes !== undefined" class="c411-stat upload">
          ↑ {{ formatBytes(c411Profile.uploadedBytes) }}
        </span>
        <span v-if="c411Profile.zenBalance !== undefined" class="c411-stat zen">
          {{ c411Profile.zenBalance }} Z
        </span>
        <span v-if="c411Profile.freeleechActive" class="c411-freeleech-badge">
          ⚡ Freeleech
        </span>
      </div>

      <!-- Disk Gauge -->
      <div
        v-if="systemStatus?.disk"
        class="disk-gauge-container"
        :class="diskClass"
        :title="storageTooltip"
      >
        <div class="disk-info">
          <span class="disk-text">{{ formattedStorage }}</span>
          <span class="disk-percent font-mono">{{ displayPercent }}%</span>
        </div>
        <div class="disk-progress-bar">
          <div
            class="disk-progress-fill"
            :style="{ width: `${displayPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- Manual / Auto Clean Trigger -->
      <button
        type="button"
        class="clean-badge btn-clean-manual"
        title="Cliquer pour supprimer immédiatement tous les torrents non épinglés (les 📌 sont protégés)"
        @click="handleCleanClick"
      >
        <span class="clean-icon">🧹</span>
        <span class="clean-text">Nettoyage auto : Lun. 09h00</span>
      </button>

      <!-- Playlist TV Button -->
      <div class="playlist-dropdown">
        <a href="/playlist.m3u" download="peerflix.m3u" class="btn-playlist" title="Télécharger la playlist M3U pour Kodi/VLC">
          📺 Playlist TV (.m3u)
        </a>
        <button
          type="button"
          class="btn-copy-playlist"
          @click="copyPlaylistUrl"
          title="Copier le lien direct vers la playlist globale M3U"
        >
          {{ copied ? '✓ Copié !' : '📋 Copier lien' }}
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.5rem;
  background-color: #0c0c12;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: #f3f4f6;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-box {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-logo {
  width: 100%;
  height: 100%;
}

.app-title {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, #f59e0b, #10b981);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.disk-gauge-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 260px;
  background: #1e293b;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.disk-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.disk-progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  overflow: hidden;
}

.disk-progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

/* Disk status classes */
.disk-normal .disk-progress-fill {
  background-color: #10b981;
}

.disk-warning .disk-progress-fill {
  background-color: #f59e0b;
}

.disk-danger {
  border-color: rgba(239, 68, 68, 0.5);
}
.disk-danger .disk-progress-fill {
  background-color: #ef4444;
}
.disk-danger .disk-percent {
  color: #ef4444;
  font-weight: 700;
}

.clean-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  background: rgba(59, 130, 246, 0.12);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.25);
  padding: 0.35rem 0.65rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clean-badge:hover {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.4);
}

.playlist-dropdown {
  display: flex;
  align-items: center;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  overflow: hidden;
}

.btn-playlist {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #e5e7eb;
  text-decoration: none;
  background: transparent;
  transition: background 0.15s;
}

.btn-playlist:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn-copy-playlist {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy-playlist:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f3f4f6;
}

.c411-header-widget {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 0.375rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  transition: all 0.15s ease;
}

.c411-header-widget.interactive {
  cursor: pointer;
}

.c411-header-widget.interactive:hover {
  background: rgba(16, 185, 129, 0.16);
  border-color: #10b981;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
  transform: translateY(-1px);
}

.c411-logo-badge {
  background: #10b981;
  color: #0b0f19;
  font-weight: 800;
  border-radius: 0.2rem;
  padding: 0.05rem 0.3rem;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}

.c411-stat.upload {
  color: #34d399;
  font-weight: 600;
}

.c411-stat.zen {
  color: #fbbf24;
  font-weight: 600;
}

.c411-freeleech-badge {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 0.2rem;
  padding: 0.05rem 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
}

@media (max-width: 768px) {
  .app-header {
    padding: 0.5rem 1rem;
  }
  .disk-gauge-container {
    min-width: 100%;
  }
}
</style>
