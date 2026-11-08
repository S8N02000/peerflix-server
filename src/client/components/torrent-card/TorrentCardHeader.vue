<script setup lang="ts">
import { computed } from 'vue';
import type { TorrentDTO } from '../../../shared/types.js';
import { parseReleaseMetadata } from '../../utils/release-parser.js';
import { formatTimeAgo } from '../../composables/useTorrents.js';

const props = defineProps<{
  torrent: TorrentDTO;
  currentUser?: string;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-pin', infoHash: string): void;
  (e: 'toggle-visibility', infoHash: string, isPrivate: boolean): void;
  (e: 'pause', infoHash: string): void;
  (e: 'resume', infoHash: string): void;
  (e: 'delete', infoHash: string): void;
}>();

const releaseMeta = computed(() => parseReleaseMetadata(props.torrent.name));

const user = computed(() => (props.currentUser || '').toLowerCase().trim());
const isAddedByMe = computed(() => {
  if (!props.torrent.addedBy) return false;
  return props.torrent.addedBy.toLowerCase().trim() === user.value;
});
const timeAgo = computed(() => formatTimeAgo(props.torrent.addedAt));

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

const isTorrentPaused = computed(() => Boolean(props.torrent.paused || props.torrent.stats?.paused));

const togglePause = () => {
  if (isTorrentPaused.value) {
    emit('resume', props.torrent.infoHash);
  } else {
    emit('pause', props.torrent.infoHash);
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
      <div class="title-and-badges">
        <div class="title-row">
          <span
            class="category-tag"
            :style="{ backgroundColor: `${categoryBadge.color}20`, color: categoryBadge.color, borderColor: `${categoryBadge.color}40` }"
          >
            {{ categoryBadge.label }}
          </span>

          <span
            v-if="torrent.addedBy || torrent.addedAt"
            class="badge-author"
            :class="{ 'is-mine': isAddedByMe }"
            :title="isAddedByMe ? 'Ajouté par vous' : (torrent.addedBy ? 'Ajouté par ' + torrent.addedBy : '')"
          >
            👤 {{ isAddedByMe ? 'Moi' : (torrent.addedBy || 'Ajouté') }} • {{ timeAgo }}
          </span>

          <span
            v-if="torrent.isPrivate"
            class="badge-private"
            title="Ce torrent est privé (visible uniquement par son auteur et l'admin)"
          >
            🔒 Privé
          </span>

          <h3 class="torrent-clean-title" :title="torrent.name">
            {{ releaseMeta.cleanTitle }}
            <span v-if="releaseMeta.year" class="title-year">({{ releaseMeta.year }})</span>
          </h3>
        </div>

        <!-- C411 Technical Badges Row -->
        <div v-if="releaseMeta.badges.length > 0" class="c411-badges-row">
          <span
            v-for="b in releaseMeta.badges"
            :key="b.label"
            class="c411-badge"
            :style="{ backgroundColor: `${b.color}18`, color: b.color, borderColor: `${b.color}40` }"
          >
            {{ b.label }}
          </span>
        </div>

        <div class="torrent-raw-subtitle" :title="torrent.name">
          {{ torrent.name }}
        </div>
      </div>
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

      <!-- Visibility Toggle (Private / Public) -->
      <button
        type="button"
        class="btn-icon btn-visibility"
        :class="{ 'is-private': torrent.isPrivate }"
        :title="torrent.isPrivate ? 'Torrent privé (masqué aux autres). Cliquer pour rendre public.' : 'Torrent public. Cliquer pour masquer aux autres.'"
        @click="emit('toggle-visibility', torrent.infoHash, !torrent.isPrivate)"
      >
        {{ torrent.isPrivate ? '🔒' : '👁️' }}
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
        :title="isTorrentPaused ? 'Reprendre le téléchargement' : 'Mettre en pause'"
        @click="togglePause"
      >
        {{ isTorrentPaused ? '▶' : '⏸' }}
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
  align-items: flex-start;
  gap: 0.6rem;
  flex: 1;
  min-width: 250px;
}

.title-and-badges {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.category-tag {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid;
  white-space: nowrap;
}

.torrent-clean-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #f4f4f6;
  letter-spacing: -0.015em;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.title-year {
  color: #94a3b8;
  font-size: 0.95rem;
  font-weight: 500;
}

.c411-badges-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.c411-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
  border: 1px solid;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.torrent-raw-subtitle {
  font-size: 0.75rem;
  color: #64748b;
  word-break: break-all;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
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

.badge-author {
  background: rgba(255, 255, 255, 0.07);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  white-space: nowrap;
}

.badge-author.is-mine {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.35);
}

.badge-private {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.35);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  white-space: nowrap;
}

.btn-visibility.is-private {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}
</style>
