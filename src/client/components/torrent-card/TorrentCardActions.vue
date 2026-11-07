<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TorrentDTO, TorrentFileDTO, SystemStatusDTO } from '../../../shared/types.js';
import { getExternalBaseUrl } from '../../utils/auth-url.js';

const props = defineProps<{
  torrent: TorrentDTO;
  systemStatus?: SystemStatusDTO | null;
  isExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'play-media', file: TorrentFileDTO, torrent: TorrentDTO): void;
  (e: 'preview-nfo', file: TorrentFileDTO, torrent: TorrentDTO): void;
  (e: 'toggle-expand'): void;
}>();

const mainVideoFile = computed(() => {
  if (props.torrent.category !== 'video') return null;
  return (
    props.torrent.files.find(
      (f) => f.category === 'video' && !f.name.toLowerCase().includes('sample')
    ) || props.torrent.files.find((f) => f.category === 'video')
  );
});

const nfoFile = computed(() => {
  return props.torrent.files.find((f) => f.category === 'info');
});

const copiedLinks = ref(false);

const copyAllDownloadLinks = async () => {
  const baseUrl = getExternalBaseUrl(props.systemStatus);
  const urls = props.torrent.files
    .filter((f) => f.selected !== false)
    .map((f) => `${baseUrl}${f.downloadUrl}`)
    .join('\n');

  try {
    await navigator.clipboard.writeText(urls);
    copiedLinks.value = true;
    setTimeout(() => {
      copiedLinks.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy download links:', err);
  }
};
</script>

<template>
  <div class="actions-bar">
    <!-- Main Action: Play Video if available -->
    <button
      v-if="torrent.category === 'video' && mainVideoFile"
      type="button"
      class="btn-main-action play"
      @click="emit('play-media', mainVideoFile, torrent)"
    >
      ▶ Regarder
    </button>

    <!-- Direct file download if single main video -->
    <a
      v-if="torrent.category === 'video' && mainVideoFile"
      :href="mainVideoFile.downloadUrl"
      class="btn-main-action download-file"
      download
      title="Télécharger directement le fichier vidéo principal"
    >
      ⬇ Télécharger
    </a>

    <!-- ZIP download always available -->
    <a
      :href="`/torrents/${torrent.infoHash}/archive`"
      class="btn-main-action download-zip"
      title="Télécharger l'intégralité du torrent en archive ZIP rapide"
    >
      📦 Télécharger tout (.zip)
    </a>

    <!-- VLC / Kodi M3U Playlist link -->
    <a
      :href="`/torrents/${torrent.infoHash}/files`"
      class="btn-m3u"
      download
      title="Télécharger la playlist M3U pour lancer tout le torrent dans VLC ou Kodi"
    >
      📺 Playlist VLC (.m3u)
    </a>

    <!-- Quick NFO button if available -->
    <button
      v-if="nfoFile"
      type="button"
      class="btn-nfo-quick"
      title="Lire le fichier de description NFO (ASCII Art DOS CP437)"
      @click="emit('preview-nfo', nfoFile, torrent)"
    >
      📄 Lire le .NFO
    </button>

    <!-- Copy Links for IDM / JDownloader -->
    <button
      type="button"
      class="btn-copy-links"
      :class="{ success: copiedLinks }"
      title="Copier les URLs directes de téléchargement de tous les fichiers sélectionnés (pour JDownloader / IDM)"
      @click="copyAllDownloadLinks"
    >
      {{ copiedLinks ? '✓ Liens copiés !' : '📋 Copier liens (JDownloader / IDM)' }}
    </button>

    <!-- File Accordion Toggle -->
    <button
      type="button"
      class="btn-accordion"
      @click="emit('toggle-expand')"
    >
      <span>📁 {{ torrent.files.length }} fichier{{ torrent.files.length > 1 ? 's' : '' }}</span>
      <span class="accordion-chevron" :class="{ open: isExpanded }">▼</span>
    </button>
  </div>
</template>

<style scoped>
.actions-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btn-main-action {
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
}

.btn-main-action.play {
  background: #10b981;
  color: white;
}
.btn-main-action.play:hover {
  background: #059669;
}

.btn-main-action.download-file {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  border-color: rgba(245, 158, 11, 0.4);
}
.btn-main-action.download-file:hover {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);
}

.btn-main-action.download-zip {
  background: #3b82f6;
  color: white;
}
.btn-main-action.download-zip:hover {
  background: #2563eb;
}

.btn-m3u {
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: background 0.15s;
}
.btn-m3u:hover {
  background: rgba(255, 255, 255, 0.12);
}

.btn-nfo-quick {
  font-size: 0.75rem;
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
  border: 1px solid rgba(6, 182, 212, 0.35);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-nfo-quick:hover {
  background: rgba(6, 182, 212, 0.25);
}

.btn-copy-links {
  font-size: 0.75rem;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.35);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-copy-links:hover {
  background: rgba(59, 130, 246, 0.25);
}
.btn-copy-links.success {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.4);
}

.btn-accordion {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  color: #94a3b8;
  border: none;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.15s;
}

.btn-accordion:hover {
  color: #f1f5f9;
}

.accordion-chevron {
  font-size: 0.65rem;
  transition: transform 0.2s;
}

.accordion-chevron.open {
  transform: rotate(180deg);
}
</style>
