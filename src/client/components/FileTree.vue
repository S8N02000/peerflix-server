<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TorrentFileDTO } from '../../shared/types.js';
import { isJunkFile } from '../composables/useTorrents.js';
import FileTreeNode from './FileTreeNode.vue';

const props = defineProps<{
  files: TorrentFileDTO[];
  infoHash: string;
  hideJunkFiles: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-file', index: number): void;
  (e: 'deselect-file', index: number): void;
  (e: 'select-all'): void;
  (e: 'deselect-all'): void;
  (e: 'play-media', file: TorrentFileDTO): void;
  (e: 'open-qr', file: TorrentFileDTO): void;
  (e: 'preview-nfo', file: TorrentFileDTO): void;
  (e: 'compute-hash', file: TorrentFileDTO): void;
}>();

const selectedFilesCount = computed(() => {
  return props.files.filter((f) => f.selected).length;
});

export interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  file?: TorrentFileDTO;
  children: TreeNode[];
  totalLength: number;
}

const collapsedFolders = ref<Set<string>>(new Set());

const toggleFolder = (fullPath: string) => {
  if (collapsedFolders.value.has(fullPath)) {
    collapsedFolders.value.delete(fullPath);
  } else {
    collapsedFolders.value.add(fullPath);
  }
};

const isCollapsed = (fullPath: string) => collapsedFolders.value.has(fullPath);

const treeRoot = computed<TreeNode[]>(() => {
  const rootChildren = new Map<string, any>();

  const visibleFiles = props.files.filter((file) => {
    if (props.hideJunkFiles && isJunkFile(file.name, file.category)) {
      return false;
    }
    return true;
  });

  for (const file of visibleFiles) {
    const segments = file.path.split(/[/\\]/).filter(Boolean);
    let currentMap = rootChildren;
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isFile = i === segments.length - 1;
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (isFile) {
        currentMap.set(segment, {
          name: segment,
          fullPath: currentPath,
          isFolder: false,
          file,
          children: [],
          totalLength: file.length
        });
      } else {
        if (!currentMap.has(segment)) {
          currentMap.set(segment, {
            name: segment,
            fullPath: currentPath,
            isFolder: true,
            childrenMap: new Map(),
            totalLength: 0
          });
        }
        const node = currentMap.get(segment);
        node.totalLength += file.length;
        currentMap = node.childrenMap;
      }
    }
  }

  const mapToArray = (map: Map<string, any>): TreeNode[] => {
    const list: TreeNode[] = [];
    for (const [_, item] of map.entries()) {
      if (item.isFolder) {
        list.push({
          name: item.name,
          fullPath: item.fullPath,
          isFolder: true,
          children: mapToArray(item.childrenMap),
          totalLength: item.totalLength
        });
      } else {
        list.push(item);
      }
    }
    // Sort: Folders first, then files alphabetically
    return list.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  return mapToArray(rootChildren);
});
</script>

<template>
  <div class="file-tree-container">
    <!-- Batch selection toolbar if more than 1 file -->
    <div v-if="files.length > 1" class="file-tree-toolbar">
      <span class="selection-summary">
        📁 <strong>{{ selectedFilesCount }}</strong> / {{ files.length }} fichiers sélectionnés
      </span>
      <div class="selection-actions">
        <button
          type="button"
          class="btn-batch-select"
          title="Sélectionner tous les fichiers du torrent"
          @click="emit('select-all')"
        >
          ☑ Tout cocher
        </button>
        <button
          type="button"
          class="btn-batch-select"
          title="Désélectionner tous les fichiers du torrent"
          @click="emit('deselect-all')"
        >
          ☐ Tout décocher
        </button>
      </div>
    </div>

    <div v-if="treeRoot.length === 0" class="empty-files">
      Aucun fichier visible (vérifiez vos filtres).
    </div>

    <!-- Recursive Tree Rendering via FileTreeNode -->
    <template v-else>
      <FileTreeNode
        v-for="node in treeRoot"
        :key="node.fullPath"
        :node="node"
        :info-hash="infoHash"
        :is-collapsed="isCollapsed"
        @toggle-folder="toggleFolder"
        @select-file="emit('select-file', $event)"
        @deselect-file="emit('deselect-file', $event)"
        @play-media="emit('play-media', $event)"
        @open-qr="emit('open-qr', $event)"
        @preview-nfo="emit('preview-nfo', $event)"
        @compute-hash="emit('compute-hash', $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.file-tree-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: #0f172a;
  border-radius: 0.5rem;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.file-tree-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.6rem;
  margin-bottom: 0.4rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.selection-summary {
  color: #94a3b8;
}

.selection-summary strong {
  color: #38bdf8;
}

.selection-actions {
  display: flex;
  gap: 0.4rem;
}

.btn-batch-select {
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-batch-select:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.3);
}

.empty-files {
  text-align: center;
  color: #64748b;
  font-size: 0.85rem;
  padding: 1rem;
}
</style>
