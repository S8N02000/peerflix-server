<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import type { C411SearchResultDTO, C411TorrentDetailsDTO } from '../../shared/types.js';
import { fetchC411Details } from '../services/api.js';
import { formatBytes } from '../composables/useTorrents.js';
import { parseReleaseMetadata } from '../utils/release-parser.js';

const props = defineProps<{
  item: C411SearchResultDTO | null;
  isOpen: boolean;
  isAdding?: boolean;
  isAdded?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add', id: string): void;
}>();

const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const details = ref<C411TorrentDetailsDTO | null>(null);
const activeTab = ref<'presentation' | 'comments' | 'nfo'>('presentation');
const brokenAvatars = ref<Set<string>>(new Set());
const copiedTitle = ref(false);

const loadDetails = async () => {
  if (!props.item?.id) return;
  isLoading.value = true;
  errorMessage.value = null;
  details.value = null;
  activeTab.value = 'presentation';

  try {
    const data = await fetchC411Details(props.item.id);
    details.value = data;
  } catch (err: any) {
    errorMessage.value = err.message || 'Impossible de récupérer la fiche C411.';
    // Fallback minimal details from item
    details.value = {
      id: props.item.id,
      title: props.item.title,
      categoryName: props.item.categoryName,
      size: props.item.size,
      pubDate: props.item.pubDate,
      seeders: props.item.seeders,
      leechers: props.item.leechers,
      isFreeleech: props.item.isFreeleech,
      posterUrl: props.item.posterUrl,
      descriptionHtml: props.item.description || '<p class="text-muted">Aucune description détaillée disponible.</p>',
      comments: []
    };
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.isOpen,
  (open) => {
    if (open && props.item) {
      loadDetails();
    }
  },
  { immediate: true }
);

watch(
  () => props.item?.id,
  (newId) => {
    if (props.isOpen && newId) {
      loadDetails();
    }
  }
);

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});

const copyTitle = () => {
  if (!props.item?.title) return;
  navigator.clipboard.writeText(props.item.title);
  copiedTitle.value = true;
  setTimeout(() => {
    copiedTitle.value = false;
  }, 2000);
};

const handleAvatarError = (author: string) => {
  brokenAvatars.value.add(author);
};

const getMeta = (title?: string) => {
  return parseReleaseMetadata(title || '');
};
</script>

<template>
  <div v-if="isOpen" class="c411-modal-overlay" @click.self="emit('close')">
    <div class="c411-modal-window">
      <!-- Top Modal Header -->
      <div class="c411-modal-header">
        <div class="header-main-info">
          <div class="header-badges-row">
            <span v-if="item?.categoryName" class="badge-cat">{{ item.categoryName }}</span>
            <span v-if="item?.isFreeleech" class="badge-freeleech">⚡ FREELEECH</span>
            <span v-if="getMeta(item?.title).resolution" class="badge-tech">
              {{ getMeta(item?.title).resolution }}
            </span>
            <span v-if="getMeta(item?.title).language" class="badge-tech badge-lang">
              {{ getMeta(item?.title).language }}
            </span>
            <span v-if="item?.size" class="badge-size font-mono">
              {{ formatBytes(item.size) }}
            </span>
          </div>

          <h2 class="modal-release-title" :title="item?.title">
            {{ getMeta(item?.title).cleanTitle || item?.title }}
          </h2>

          <div class="raw-title-row">
            <span class="raw-release-name font-mono" :title="item?.title">{{ item?.title }}</span>
            <button
              type="button"
              class="btn-copy-title"
              :title="copiedTitle ? 'Copié !' : 'Copier le nom de la release'"
              @click="copyTitle"
            >
              {{ copiedTitle ? '✓ Copié' : '📋' }}
            </button>
          </div>
        </div>

        <div class="header-action-col">
          <button
            type="button"
            class="btn-modal-add"
            :class="{ added: isAdded, loading: isAdding }"
            :disabled="isAdding || isAdded"
            @click="item && emit('add', item.id)"
          >
            <span v-if="isAdding">⏳ Ajout...</span>
            <span v-else-if="isAdded">✓ Ajouté</span>
            <span v-else>📥 Lancer sur Peerflix</span>
          </button>
          <button type="button" class="btn-modal-close" title="Fermer (Échap)" @click="emit('close')">
            ✕
          </button>
        </div>
      </div>

      <!-- Quick Stats Banner -->
      <div class="c411-stats-strip">
        <div class="stat-item">
          <span class="stat-label">Seeders :</span>
          <span class="stat-value seeders">↑ {{ item?.seeders ?? 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Leechers :</span>
          <span class="stat-value leechers">↓ {{ item?.leechers ?? 0 }}</span>
        </div>
        <div v-if="item?.completed !== undefined" class="stat-item">
          <span class="stat-label">Complétés :</span>
          <span class="stat-value completed">{{ item.completed }} fois</span>
        </div>
        <div v-if="item?.pubDate" class="stat-item">
          <span class="stat-label">Publié le :</span>
          <span class="stat-value">{{ new Date(item.pubDate).toLocaleDateString('fr-FR') }}</span>
        </div>
        <div v-if="details?.c411PageUrl" class="stat-item ml-auto">
          <a
            :href="details.c411PageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="c411-external-link"
          >
            🔗 Ouvrir sur C411 ↗
          </a>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="c411-modal-tabs">
        <button
          type="button"
          class="modal-tab-btn"
          :class="{ active: activeTab === 'presentation' }"
          @click="activeTab = 'presentation'"
        >
          📄 Description & Présentation
        </button>
        <button
          type="button"
          class="modal-tab-btn"
          :class="{ active: activeTab === 'comments' }"
          @click="activeTab = 'comments'"
        >
          💬 Commentaires
          <span class="tab-count-pill">{{ details?.comments?.length ?? 0 }}</span>
        </button>
        <button
          v-if="details?.nfo"
          type="button"
          class="modal-tab-btn"
          :class="{ active: activeTab === 'nfo' }"
          @click="activeTab = 'nfo'"
        >
          📋 NFO
        </button>
      </div>

      <!-- Loading / Error states -->
      <div v-if="isLoading" class="modal-loading-pane">
        <span class="spinner-icon">🔄</span> Chargement de la fiche complète depuis C411...
      </div>

      <div v-else-if="errorMessage && !details?.descriptionHtml" class="modal-error-pane">
        ⚠️ {{ errorMessage }}
      </div>

      <!-- Tab Content Area -->
      <div v-else class="c411-modal-body">
        <!-- TAB 1: PRESENTATION & DESCRIPTION (Faithful to C411) -->
        <div v-show="activeTab === 'presentation'" class="tab-pane-presentation">
          <div
            v-if="details?.descriptionHtml"
            class="c411-rich-description"
            v-html="details.descriptionHtml"
          ></div>
          <div v-else class="empty-description">
            <span class="empty-icon">ℹ️</span>
            <p>Aucune description détaillée n'a été fournie pour cette release.</p>
          </div>
        </div>

        <!-- TAB 2: USER COMMENTS -->
        <div v-show="activeTab === 'comments'" class="tab-pane-comments">
          <div v-if="details && details.comments && details.comments.length > 0" class="comments-list">
            <div
              v-for="(comment, cIdx) in details.comments"
              :key="cIdx"
              class="comment-card"
            >
              <div class="comment-author-box">
                <img
                  v-if="comment.avatarUrl && !brokenAvatars.has(comment.author)"
                  :src="comment.avatarUrl"
                  :alt="comment.author"
                  class="comment-avatar"
                  loading="lazy"
                  @error="handleAvatarError(comment.author)"
                />
                <div v-else class="comment-avatar-fallback">
                  {{ comment.author.charAt(0).toUpperCase() }}
                </div>
                <div class="comment-meta">
                  <span class="comment-author-name">{{ comment.author }}</span>
                  <span v-if="comment.date" class="comment-date">{{ comment.date }}</span>
                </div>
              </div>

              <div class="comment-text-box">
                {{ comment.content }}
              </div>
            </div>
          </div>

          <div v-else class="empty-comments-state">
            <span class="empty-comments-icon">💬</span>
            <p class="empty-comments-title">Aucun commentaire pour le moment</p>
            <p class="empty-comments-subtitle">
              Soyez le premier à tester cette release et à donner votre avis sur C411 !
            </p>
          </div>
        </div>

        <!-- TAB 3: NFO -->
        <div v-if="details?.nfo" v-show="activeTab === 'nfo'" class="tab-pane-nfo">
          <pre class="nfo-pre-block font-mono">{{ details.nfo }}</pre>
        </div>
      </div>

      <!-- Bottom Footer -->
      <div class="c411-modal-footer">
        <span class="footer-hint">
          Appuyez sur <kbd>Échap</kbd> ou cliquez à l'extérieur pour fermer
        </span>
        <button
          type="button"
          class="btn-footer-add"
          :class="{ added: isAdded, loading: isAdding }"
          :disabled="isAdding || isAdded"
          @click="item && emit('add', item.id)"
        >
          <span v-if="isAdding">⏳ Téléchargement en cours...</span>
          <span v-else-if="isAdded">✓ Torrent ajouté à vos téléchargements</span>
          <span v-else>📥 Lancer sur Peerflix (Streaming Direct)</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.c411-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 6, 14, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  animation: fadeIn 0.15s ease-out;
}

.c411-modal-window {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  width: 100%;
  max-width: 950px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.1);
  overflow: hidden;
  animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Header */
.c411-modal-header {
  padding: 1.25rem 1.5rem;
  background: #131d33;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
}

.header-main-info {
  flex: 1;
  min-width: 0;
}

.header-badges-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.badge-cat {
  background: #2563eb;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  text-transform: uppercase;
}

.badge-freeleech {
  background: #eab308;
  color: #000;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.03em;
}

.badge-tech {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #93c5fd;
  font-size: 0.72rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-lang {
  color: #34d399;
}

.badge-size {
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  font-size: 0.72rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.modal-release-title {
  margin: 0 0 0.35rem 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.35;
  word-break: break-word;
}

.raw-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.raw-release-name {
  font-size: 0.75rem;
  color: #10b981;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.btn-copy-title {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  transition: all 0.15s;
}

.btn-copy-title:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
}

.header-action-col {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.btn-modal-add {
  background: #059669;
  color: white;
  border: none;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 7px 14px;
  border-radius: 7px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(5, 150, 105, 0.3);
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-modal-add:hover:not(:disabled) {
  background: #10b981;
  transform: translateY(-1px);
}

.btn-modal-add.added {
  background: #334155;
  color: #94a3b8;
  cursor: default;
  box-shadow: none;
}

.btn-modal-close {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-modal-close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Stats strip */
.c411-stats-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.25rem;
  padding: 0.6rem 1.5rem;
  background: #0c1322;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.78rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.stat-label {
  color: #64748b;
}

.stat-value {
  color: #cbd5e1;
  font-weight: 600;
}

.stat-value.seeders {
  color: #10b981;
}

.stat-value.leechers {
  color: #f87171;
}

.stat-value.completed {
  color: #38bdf8;
}

.ml-auto {
  margin-left: auto;
}

.c411-external-link {
  color: #60a5fa;
  text-decoration: none;
  font-size: 0.75rem;
}

.c411-external-link:hover {
  text-decoration: underline;
}

/* Tabs */
.c411-modal-tabs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1.5rem;
  background: #111a2e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-tab-btn {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.75rem 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  transition: all 0.15s;
}

.modal-tab-btn:hover {
  color: #f8fafc;
}

.modal-tab-btn.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
}

.tab-count-pill {
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 0.7rem;
  padding: 1px 5px;
  border-radius: 999px;
}

/* Modal Body */
.c411-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.modal-loading-pane,
.modal-error-pane {
  padding: 3rem 1.5rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.95rem;
}

/* Rich Description styling faithful to C411 */
.c411-rich-description {
  color: #cbd5e1;
  font-size: 0.9rem;
  line-height: 1.6;
}

:deep(.c411-rich-description img) {
  max-width: 100% !important;
  height: auto !important;
  border-radius: 8px;
  margin: 10px auto;
  display: block;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
}

:deep(.c411-rich-description pre),
:deep(.c411-code) {
  background: #090d16;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.85rem;
  border-radius: 6px;
  color: #10b981;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  overflow-x: auto;
  margin: 10px 0;
}

:deep(.c411-rich-description blockquote),
:deep(.c411-quote) {
  border-left: 3px solid #38bdf8;
  background: rgba(56, 189, 248, 0.08);
  padding: 0.6rem 1rem;
  margin: 10px 0;
  border-radius: 0 6px 6px 0;
  color: #e2e8f0;
}

:deep(.c411-rich-description a) {
  color: #38bdf8;
  text-decoration: underline;
}

/* Comments Tab */
.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comment-card {
  background: #141e33;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.comment-author-box {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.comment-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.comment-avatar-fallback {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #1e293b;
  color: #38bdf8;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.comment-author-name {
  font-weight: 700;
  color: #10b981;
  font-size: 0.85rem;
}

.comment-date {
  color: #64748b;
  font-size: 0.72rem;
  margin-left: 0.5rem;
}

.comment-text-box {
  color: #cbd5e1;
  font-size: 0.85rem;
  line-height: 1.5;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-comments-state,
.empty-description {
  text-align: center;
  padding: 3rem 1.5rem;
  color: #64748b;
}

.empty-comments-icon,
.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.5rem;
}

.empty-comments-title {
  font-weight: 700;
  color: #cbd5e1;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.empty-comments-subtitle {
  font-size: 0.82rem;
}

/* NFO Tab */
.nfo-pre-block {
  background: #090d16;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1.25rem;
  border-radius: 8px;
  color: #10b981;
  font-size: 0.78rem;
  line-height: 1.35;
  overflow-x: auto;
  white-space: pre;
}

/* Footer */
.c411-modal-footer {
  padding: 0.85rem 1.5rem;
  background: #111a2e;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.footer-hint {
  font-size: 0.75rem;
  color: #64748b;
}

.footer-hint kbd {
  background: #1e293b;
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}

.btn-footer-add {
  background: #059669;
  color: white;
  border: none;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 8px 18px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-footer-add:hover:not(:disabled) {
  background: #10b981;
}

.btn-footer-add.added {
  background: #334155;
  color: #94a3b8;
  cursor: default;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(15px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 768px) {
  .c411-modal-header {
    flex-direction: column;
  }
  .header-action-col {
    width: 100%;
    justify-content: space-between;
  }
  .c411-modal-footer {
    flex-direction: column;
    align-items: stretch;
  }
  .btn-footer-add {
    width: 100%;
  }
}
</style>
