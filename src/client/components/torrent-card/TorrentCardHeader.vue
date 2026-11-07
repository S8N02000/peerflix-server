<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TorrentDTO } from '../../../shared/types.js';

const props = defineProps<{
  torrent: TorrentDTO;
}>();

const emit = defineEmits<{
  (e: 'toggle-pin', infoHash: string): void;
  (e: 'pause', infoHash: string): void;
  (e: 'resume', infoHash: string): void;
  (e: 'delete', infoHash: string): void;
}>();

const isPaused = ref(false);

const categoryBadge = computed(() => {
  switch (props.torrent.category) {
    case 'video': return { label: '🎬 Vidéo', color: '#10b981' };
    case 'game_app': return { label: '🎮 Jeu / App', color: '#3b82f6' };
    case 'audio': return { label: '🎵 Musique', color: '#8b5cf6' };
    case 'archive': return { label: '📦 Archive', color: '#f59e0b' };
    case 'document': return { label: '📄 Document', color: '#06b6d4' };
    default: return { label: '📁 Autre', color: '#64748b' };
  }
});

const togglePause = () => {
  isPaused.value = !isPaused.value;
  if (isPaused.value) {
    emit('pause', props.torrent.infoHash);
  } else {
    emit('resume', props.torrent.infoHash);
  }
};

const confirmDelete = () => {
  if (window.confirm(`Voulez-vous vraiment supprimer "${props.torrent.name}" du serveur ?`)) {
    emit('delete', props.torrent.infoHash);
  }
};
</script>

<template>
  <div class="card-header">
    <div class="header-main">
      <span
        class="category-tag"
        :style="{ backgroundColor: `${categoryBadge.color}20`, color: categoryBadge.color, borderColor: `${categoryBadge.color}40` }"
      >
        {{ categoryBadge.label }}
      </span>
      <h3 class="torrent-title" :title="torrent.name">{{ torrent.name }}</h3>
    </div>

    <div class="header-controls">
      <!-- Pin Button -->
      <button
        type="button"
        class="btn-pin"
        :class="{ pinned: torrent.pinned }"
        :title="torrent.pinned ? 'Épinglé : Protégé contre le nettoyage du lundi 9h' : 'Cliquer pour épingler et protéger'"
        @click="emit('toggle-pin', torrent.infoHash)"
      >
        📌 <span class="pin-text">{{ torrent.pinned ? 'Épinglé' : 'Épingler' }}</span>
      </button>

      <!-- Status Badge -->
      <span v-if="torrent.isFullyDownloaded" class="badge-ready">
        ✓ 100% Prêt sur le serveur
      </span>
      <span v-else-if="!torrent.ready" class="badge-verifying">
        ⏳ Récupération métadonnées...
      </span>

      <!-- Pause / Resume -->
      <button
        type="button"
        class="btn-icon"
        :title="isPaused ? 'Reprendre le téléchargement' : 'Mettre en pause'"
        @click="togglePause"
      >
        {{ isPaused ? '▶' : '⏸' }}
      </button>

      <!-- Delete Button -->
      <button
        type="button"
        class="btn-icon btn-delete"
        title="Supprimer définitivement du serveur"
        @click="confirmDelete"
      >
        🗑
      </button>
    </div>
  </div>
</template>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 250px;
}

.category-tag {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid;
  white-space: nowrap;
}

.torrent-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: #f8fafc;
  word-break: break-all;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-pin {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-pin:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
}

.btn-pin.pinned {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.3);
}

.badge-ready {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  border-radius: 0.375rem;
  white-space: nowrap;
}

.badge-verifying {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  font-size: 0.75rem;
  padding: 0.3rem 0.6rem;
  border-radius: 0.375rem;
  white-space: nowrap;
}

.btn-icon {
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
}
</style>
