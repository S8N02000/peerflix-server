<script setup lang="ts">
import type { C411SearchResultDTO } from '../../../shared/types.js';
import { formatBytes } from '../../composables/useTorrents.js';
import { parseReleaseMetadata } from '../../utils/release-parser.js';

const props = defineProps<{
  item: C411SearchResultDTO;
  addingId: string | null;
  addedIds: Set<string>;
  brokenImages: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'open-details', item: C411SearchResultDTO): void;
  (e: 'add', item: C411SearchResultDTO, isPrivate: boolean): void;
  (e: 'img-error', id: string): void;
}>();

const getMeta = (item: C411SearchResultDTO) => {
  return parseReleaseMetadata(item.title);
};

const getCategoryIcon = (item: C411SearchResultDTO): string => {
  const cat = (item.categoryName || '').toLowerCase();
  if (cat.includes('film')) return '🎬';
  if (cat.includes('série') || cat.includes('serie')) return '📺';
  if (cat.includes('anime')) return '🎌';
  if (cat.includes('livre') || cat.includes('ebook') || cat.includes('bd')) return '📚';
  if (cat.includes('musique') || cat.includes('audio')) return '🎵';
  if (cat.includes('jeu') || cat.includes('game')) return '🎮';
  if (cat.includes('app') || cat.includes('logiciel')) return '💻';
  if (cat.includes('3d')) return '🖨️';
  return '📁';
};

const getCategoryShortLabel = (item: C411SearchResultDTO): string => {
  if (item.categoryName) {
    return item.categoryName.replace(/[^a-zA-Z0-9À-ÿ]/g, ' ').trim().slice(0, 10);
  }
  return 'C411';
};

const formatPubDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor((now.getTime() - d.getTime()) / (1000 * 60)));
    return `il y a ${diffMinutes} min`;
  }
  if (diffHours < 24) return `il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};
</script>

<template>
  <div class="c411-result-row">
    <!-- Top / Left Section with Poster and Center Details -->
    <div class="result-main-info">
      <!-- Poster / Cover Image -->
      <div
        class="result-poster-box clickable"
        title="Voir la fiche détaillée C411 (description & commentaires)"
        @click="emit('open-details', item)"
      >
        <img
          v-if="item.posterUrl && !brokenImages.has(item.id)"
          :src="item.posterUrl"
          :alt="item.title"
          class="poster-img"
          loading="lazy"
          @error="emit('img-error', item.id)"
        />
        <div v-else class="poster-placeholder">
          <span class="placeholder-icon">{{ getCategoryIcon(item) }}</span>
          <span class="placeholder-label">{{ getCategoryShortLabel(item) }}</span>
        </div>
      </div>

      <!-- Center Metadata Information -->
      <div class="result-center">
        <!-- Row 1: Category badge + Clean Title + Season/Episode + Year + Freeleech -->
        <div class="row-title">
          <span v-if="item.categoryName" class="badge-cat">{{ item.categoryName }}</span>
          <span
            class="item-clean-title clickable"
            title="Voir la fiche détaillée C411 (description & commentaires)"
            @click="emit('open-details', item)"
          >
            {{ getMeta(item).cleanTitle }}
          </span>
          <span v-if="getMeta(item).seasonEpisodeLabel" class="badge-season-episode">
            {{ getMeta(item).seasonEpisodeLabel }}
          </span>
          <span v-if="getMeta(item).year || item.year" class="badge-year">
            {{ getMeta(item).year || item.year }}
          </span>
          <span v-if="item.isFreeleech" class="badge-freeleech">⚡ FREELEECH</span>
        </div>

        <!-- Row 2: Raw Release Name in Monospace Green (#10b981) -->
        <div
          class="row-raw-release clickable"
          :title="item.title + ' (Cliquer pour voir la fiche)'"
          @click="emit('open-details', item)"
        >
          {{ item.title }}
        </div>

        <!-- Row 3: Technical Badges parsed accurately with flex-wrap -->
        <div class="row-tech-badges">
          <span
            v-for="(badge, bIdx) in getMeta(item).badges"
            :key="bIdx"
            class="tech-badge"
            :style="{ borderColor: badge.color, color: badge.color }"
          >
            {{ badge.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- Right Side: Stats, Peers & Action Buttons -->
    <div class="result-right">
      <!-- Size & Age -->
      <div class="meta-size-age">
        <span class="item-size font-mono">{{ formatBytes(item.size) }}</span>
        <span class="item-age">{{ formatPubDate(item.pubDate) }}</span>
      </div>

      <!-- Peers & Completed -->
      <div class="meta-peers">
        <div class="peers-counts">
          <span class="seeders" title="Seeders">↑ {{ item.seeders }}</span>
          <span class="leechers" title="Leechers">↓ {{ item.leechers }}</span>
          <span v-if="item.completed !== undefined" class="completed" title="Téléchargements réussis">
            {{ item.completed }} compl.
          </span>
        </div>
        <!-- Mini Ratio Bar -->
        <div class="peers-ratio-bar">
          <div
            class="ratio-seed"
            :style="{
              width: `${(item.seeders / (item.seeders + item.leechers || 1)) * 100}%`
            }"
          ></div>
        </div>
      </div>

      <!-- Download Action Buttons -->
      <div class="action-btn-box">
        <button
          type="button"
          class="btn-view-details"
          title="Voir la description, les images et les commentaires sur C411"
          @click="emit('open-details', item)"
        >
          📄 Fiche
        </button>
        <template v-if="addingId === item.id">
          <button
            type="button"
            class="btn-add-torrent loading"
            disabled
          >
            ⏳ Ajout...
          </button>
        </template>
        <template v-else-if="item.alreadyAdded || addedIds.has(item.id)">
          <button
            type="button"
            class="btn-add-torrent added"
            disabled
          >
            ✓ Actif
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="btn-add-torrent btn-public"
            title="Ajouter en mode Public (visible par tous les utilisateurs)"
            @click="emit('add', item, false)"
          >
            🌐 Public
          </button>
          <button
            type="button"
            class="btn-add-torrent btn-private"
            title="Ajouter en mode Privé (visible uniquement par vous et l'administrateur)"
            @click="emit('add', item, true)"
          >
            🔒 Privé
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.c411-result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.c411-result-row:hover {
  border-color: rgba(56, 189, 248, 0.3);
  transform: translateY(-1px);
  background: #171b2b;
}

.result-main-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

/* Poster Area */
.result-poster-box {
  width: 75px;
  height: 105px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  background: #0d0f18;
}

.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  color: #94a3b8;
  padding: 0.25rem;
  text-align: center;
  user-select: none;
}

.placeholder-icon {
  font-size: 1.6rem;
  margin-bottom: 0.25rem;
}

.placeholder-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* Center Content */
.result-center {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.row-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  width: 100%;
  max-width: 100%;
}

.badge-cat {
  background: #1e293b;
  color: #38bdf8;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  white-space: nowrap;
}

.item-clean-title {
  font-size: 1rem;
  font-weight: 700;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.badge-season-episode {
  background: #3b82f6;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

.badge-year {
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  white-space: nowrap;
}

.badge-freeleech {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  white-space: nowrap;
}

.row-raw-release {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  color: #10b981;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(16, 185, 129, 0.05);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.row-tech-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  width: 100%;
  max-width: 100%;
}

.tech-badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.1rem 0.35rem;
  border: 1px solid;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
  text-transform: uppercase;
  white-space: nowrap;
}

/* Right Content */
.result-right {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
}

.meta-size-age {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  min-width: 75px;
}

.item-size {
  font-size: 0.9rem;
  font-weight: 700;
  color: #ffffff;
}

.item-age {
  font-size: 0.72rem;
  color: #94a3b8;
}

.meta-peers {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 90px;
}

.peers-counts {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.seeders {
  color: #10b981;
}

.leechers {
  color: #ef4444;
}

.completed {
  color: #94a3b8;
  font-size: 0.7rem;
}

.peers-ratio-bar {
  width: 100%;
  height: 4px;
  background: rgba(239, 68, 68, 0.4);
  border-radius: 2px;
  overflow: hidden;
}

.ratio-seed {
  height: 100%;
  background: #10b981;
}

.action-btn-box {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.btn-view-details {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-view-details:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
  color: #ffffff;
}

.btn-add-torrent {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-add-torrent.btn-public {
  background: #f97316;
  color: #ffffff;
}

.btn-add-torrent.btn-public:hover:not(:disabled) {
  background: #ea580c;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.35);
}

.btn-add-torrent.btn-private {
  background: #6366f1;
  color: #ffffff;
}

.btn-add-torrent.btn-private:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
}

.btn-add-torrent.added {
  background: #334155;
  color: #94a3b8;
  cursor: default;
}

.btn-add-torrent.loading {
  background: #475569;
  color: #cbd5e1;
  cursor: wait;
}

.clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}

.clickable:hover {
  opacity: 0.85;
}

.item-clean-title.clickable:hover {
  color: #38bdf8;
  text-decoration: underline;
}

.row-raw-release.clickable:hover {
  color: #34d399;
}

/* Mobile & Tablet Responsiveness */
@media (max-width: 768px) {
  .c411-result-row {
    flex-direction: column;
    align-items: stretch;
    padding: 0.65rem 0.75rem;
    gap: 0.65rem;
  }

  .result-main-info {
    width: 100%;
    align-items: flex-start;
    gap: 0.65rem;
  }

  .result-poster-box {
    width: 55px;
    height: 77px;
  }

  .item-clean-title {
    font-size: 0.92rem;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-clamp: 2;
  }

  .row-raw-release {
    font-size: 0.7rem;
  }

  .result-right {
    width: 100%;
    justify-content: space-between;
    margin-top: 0.2rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    gap: 0.5rem;
  }

  .meta-size-age {
    align-items: flex-start;
    min-width: 0;
  }

  .action-btn-box {
    gap: 0.35rem;
  }

  .btn-view-details,
  .btn-add-torrent {
    font-size: 0.74rem;
    padding: 0.4rem 0.6rem;
  }
}
</style>
