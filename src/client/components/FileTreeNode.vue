<script setup lang="ts">
import type { TorrentFileDTO, FileCategory } from '../../shared/types.js';
import { formatBytes } from '../composables/useTorrents.js';
import type { TreeNode } from './FileTree.vue';

defineProps<{
  node: TreeNode;
  infoHash: string;
  isCollapsed: (path: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-folder', path: string): void;
  (e: 'select-file', index: number): void;
  (e: 'deselect-file', index: number): void;
  (e: 'play-media', file: TorrentFileDTO): void;
  (e: 'open-qr', file: TorrentFileDTO): void;
  (e: 'preview-nfo', file: TorrentFileDTO): void;
  (e: 'compute-hash', file: TorrentFileDTO): void;
}>();

const getFileIcon = (category: FileCategory): string => {
  switch (category) {
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'subtitle': return '💬';
    case 'executable': return '⚙️';
    case 'disc_image': return '💿';
    case 'archive': return '📦';
    case 'document': return '📄';
    case 'info': return 'ℹ️';
    default: return '📄';
  }
};

const onCheckboxChange = (file: TorrentFileDTO, e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    emit('select-file', file.index);
  } else {
    emit('deselect-file', file.index);
  }
};
</script>

<template>
  <div class="tree-node">
    <!-- Folder Branch -->
    <div v-if="node.isFolder" class="folder-group">
      <div class="folder-header" @click="emit('toggle-folder', node.fullPath)">
        <span class="chevron" :class="{ open: !isCollapsed(node.fullPath) }">▶</span>
        <span class="folder-icon">📁</span>
        <span class="folder-name">{{ node.name }}</span>
        <span class="folder-size">({{ formatBytes(node.totalLength) }})</span>
        <a
          :href="`/torrents/${infoHash}/archive?folder=${encodeURIComponent(node.fullPath)}`"
          class="btn-folder-zip"
          title="Télécharger ce dossier complet sous forme d'archive ZIP"
          @click.stop
        >
          📦 ZIP Dossier
        </a>
      </div>

      <div v-if="!isCollapsed(node.fullPath)" class="folder-children">
        <!-- Recursive call for children of any depth -->
        <FileTreeNode
          v-for="child in node.children"
          :key="child.fullPath"
          :node="child"
          :info-hash="infoHash"
          :is-collapsed="isCollapsed"
          @toggle-folder="emit('toggle-folder', $event)"
          @select-file="emit('select-file', $event)"
          @deselect-file="emit('deselect-file', $event)"
          @play-media="emit('play-media', $event)"
          @open-qr="emit('open-qr', $event)"
          @preview-nfo="emit('preview-nfo', $event)"
          @compute-hash="emit('compute-hash', $event)"
        />
      </div>
    </div>

    <!-- Leaf File Row -->
    <div v-else-if="node.file" class="file-row">
      <input
        type="checkbox"
        :checked="node.file.selected"
        class="file-checkbox"
        @change="onCheckboxChange(node.file, $event)"
      />
      <span class="file-icon">{{ getFileIcon(node.file.category) }}</span>
      <span class="file-name" :title="node.file.name">{{ node.file.name }}</span>
      <span class="file-size">{{ formatBytes(node.file.length) }}</span>
      <span v-if="node.file.isComplete" class="badge-complete">100% Prêt</span>

      <div class="file-actions">
        <!-- Video & Audio buttons: Play + VLC + QR -->
        <template v-if="node.file.category === 'video' || node.file.category === 'audio'">
          <button
            type="button"
            class="btn-action play"
            @click="emit('play-media', node.file!)"
          >
            ▶ {{ node.file.category === 'video' ? 'Regarder' : 'Écouter' }}
          </button>
          <a
            :href="`/torrents/${infoHash}/files/${node.file.index}/vlc.m3u`"
            class="btn-action vlc"
            download
            title="Télécharger la playlist M3U pour lancer instantanément dans VLC (PC / Mac / Mobile)"
          >
            🟠 VLC
          </a>
          <button
            type="button"
            class="btn-action qr"
            title="Afficher le QR code pour diffuser sur mobile ou TV"
            @click="emit('open-qr', node.file!)"
          >
            📱 QR
          </button>
        </template>

        <!-- NFO viewer button -->
        <button
          v-if="node.file.category === 'info'"
          type="button"
          class="btn-action nfo"
          @click="emit('preview-nfo', node.file!)"
        >
          👁 NFO
        </button>

        <!-- SHA-256 integrity hash -->
        <button
          v-if="node.file.isComplete"
          type="button"
          class="btn-action hash"
          title="Vérifier l'empreinte SHA-256"
          @click="emit('compute-hash', node.file!)"
        >
          #️⃣ SHA-256
        </button>

        <!-- Download button -->
        <a :href="node.file.downloadUrl" class="btn-action download" title="Télécharger le fichier directement">
          ⬇
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
}

.folder-group {
  margin-bottom: 0.25rem;
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 0.375rem;
  cursor: pointer;
  user-select: none;
  font-size: 0.85rem;
  transition: background 0.15s;
}

.folder-header:hover {
  background: rgba(255, 255, 255, 0.07);
}

.chevron {
  font-size: 0.7rem;
  color: #9ca3af;
  transition: transform 0.2s;
  display: inline-block;
}

.chevron.open {
  transform: rotate(90deg);
}

.folder-name {
  font-weight: 600;
  color: #e2e8f0;
}

.folder-size {
  color: #94a3b8;
  font-size: 0.75rem;
}

.btn-folder-zip {
  margin-left: auto;
  font-size: 0.7rem;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
  text-decoration: none;
  transition: background 0.15s;
}

.btn-folder-zip:hover {
  background: rgba(245, 158, 11, 0.25);
}

.folder-children {
  margin-left: 1.25rem;
  padding-left: 0.5rem;
  border-left: 1px dashed rgba(255, 255, 255, 0.1);
  margin-top: 0.25rem;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.6rem;
  border-radius: 0.375rem;
  font-size: 0.85rem;
  transition: background 0.15s;
}

.file-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.file-checkbox {
  cursor: pointer;
  accent-color: #3b82f6;
}

.file-icon {
  font-size: 1rem;
}

.file-name {
  flex: 1;
  color: #cbd5e1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #94a3b8;
  font-size: 0.75rem;
  white-space: nowrap;
}

.badge-complete {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.4);
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  white-space: nowrap;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.btn-action {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: background 0.15s, border-color 0.15s;
}

.btn-action.play {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.btn-action.play:hover {
  background: rgba(16, 185, 129, 0.3);
}

.btn-action.vlc {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
  border-color: rgba(249, 115, 22, 0.3);
}

.btn-action.vlc:hover {
  background: rgba(249, 115, 22, 0.3);
}

.btn-action.qr {
  background: rgba(147, 51, 234, 0.15);
  color: #c084fc;
  border-color: rgba(147, 51, 234, 0.3);
}

.btn-action.qr:hover {
  background: rgba(147, 51, 234, 0.3);
}

.btn-action.nfo {
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
  border-color: rgba(6, 182, 212, 0.3);
}

.btn-action.nfo:hover {
  background: rgba(6, 182, 212, 0.3);
}

.btn-action.hash {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border-color: rgba(99, 102, 241, 0.3);
}

.btn-action.hash:hover {
  background: rgba(99, 102, 241, 0.3);
}

.btn-action.download {
  background: #374151;
  color: #e5e7eb;
  border-color: rgba(255, 255, 255, 0.1);
}

.btn-action.download:hover {
  background: #4b5563;
  color: #ffffff;
}
</style>
