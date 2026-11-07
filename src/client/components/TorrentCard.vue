<script setup lang="ts">
import { ref } from 'vue';
import type { TorrentDTO, TorrentFileDTO } from '../../shared/types.js';
import FileTree from './FileTree.vue';
import TorrentCardHeader from './torrent-card/TorrentCardHeader.vue';
import TorrentCardProgress from './torrent-card/TorrentCardProgress.vue';
import TorrentCardActions from './torrent-card/TorrentCardActions.vue';

defineProps<{
  torrent: TorrentDTO;
  hideJunkFiles: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-pin', infoHash: string): void;
  (e: 'pause', infoHash: string): void;
  (e: 'resume', infoHash: string): void;
  (e: 'delete', infoHash: string): void;
  (e: 'select-file', infoHash: string, fileIndex: number): void;
  (e: 'deselect-file', infoHash: string, fileIndex: number): void;
  (e: 'play-media', file: TorrentFileDTO, torrent: TorrentDTO): void;
  (e: 'open-qr', file: TorrentFileDTO, torrent: TorrentDTO): void;
  (e: 'preview-nfo', file: TorrentFileDTO, torrent: TorrentDTO): void;
  (e: 'compute-hash', file: TorrentFileDTO, torrent: TorrentDTO): void;
}>();

const isExpanded = ref(false);
</script>

<template>
  <div class="torrent-card" :class="{ 'is-complete': torrent.isFullyDownloaded }">
    <!-- Card Header -->
    <TorrentCardHeader
      :torrent="torrent"
      @toggle-pin="emit('toggle-pin', $event)"
      @pause="emit('pause', $event)"
      @resume="emit('resume', $event)"
      @delete="emit('delete', $event)"
    />

    <!-- Progress Bar & Speed Stats -->
    <TorrentCardProgress :torrent="torrent" />

    <!-- Quick Action Bar -->
    <TorrentCardActions
      :torrent="torrent"
      :is-expanded="isExpanded"
      @play-media="emit('play-media', $event, torrent)"
      @preview-nfo="emit('preview-nfo', $event, torrent)"
      @toggle-expand="isExpanded = !isExpanded"
    />

    <!-- Expandable File Tree Area -->
    <div v-if="isExpanded" class="accordion-content">
      <FileTree
        :files="torrent.files"
        :info-hash="torrent.infoHash"
        :hide-junk-files="hideJunkFiles"
        @select-file="emit('select-file', torrent.infoHash, $event)"
        @deselect-file="emit('deselect-file', torrent.infoHash, $event)"
        @play-media="emit('play-media', $event, torrent)"
        @open-qr="emit('open-qr', $event, torrent)"
        @preview-nfo="emit('preview-nfo', $event, torrent)"
        @compute-hash="emit('compute-hash', $event, torrent)"
      />
    </div>
  </div>
</template>

<style scoped>
.torrent-card {
  background: #1e293b;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 1.25rem;
  margin-bottom: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.torrent-card.is-complete {
  border-color: rgba(16, 185, 129, 0.35);
}

.accordion-content {
  margin-top: 1rem;
  padding-top: 0.5rem;
}
</style>
