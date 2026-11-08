<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import type { C411SearchResultDTO, C411TorrentDetailsDTO } from '../../shared/types.js';
import { fetchC411Details } from '../services/api.js';
import { formatBytes } from '../composables/useTorrents.js';
import { parseReleaseMetadata } from '../utils/release-parser.js';
import C411PresentationTab from './c411/C411PresentationTab.vue';
import C411CommentsTab from './c411/C411CommentsTab.vue';

const props = defineProps<{
  item: C411SearchResultDTO | null;
  isOpen: boolean;
  isAdding?: boolean;
  isAdded?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add', id: string, isPrivate?: boolean): void;
}>();

const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const details = ref<C411TorrentDetailsDTO | null>(null);
const activeTab = ref<'presentation' | 'comments' | 'nfo'>('presentation');
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

        <button type="button" class="btn-modal-close" title="Fermer (Échap)" @click="emit('close')">
          ✕
        </button>
      </div>

      <!-- Navigation Tabs (slim, fixed under header) -->
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

      <!-- Scrollable Modal Body -->
      <div class="c411-modal-body">
        <!-- Optional Backdrop Banner Header (scrolls with content) -->
        <div v-if="details?.backdropUrl || item?.backdropUrl" class="modal-backdrop-banner">
          <img :src="details?.backdropUrl || item?.backdropUrl" alt="backdrop" class="backdrop-img" />
          <div class="backdrop-overlay"></div>
        </div>

        <!-- Quick Stats Banner (scrolls with content) -->
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

        <div class="modal-body-content">
          <!-- Loading / Error states -->
          <div v-if="isLoading" class="modal-loading-pane">
            <span class="spinner-icon">🔄</span> Chargement de la fiche complète depuis C411...
          </div>

          <div v-else-if="errorMessage && !details?.descriptionHtml" class="modal-error-pane">
            ⚠️ {{ errorMessage }}
          </div>

          <template v-else>
            <!-- TAB 1: PRESENTATION & DESCRIPTION -->
            <C411PresentationTab
              v-show="activeTab === 'presentation'"
              :details="details"
            />

            <!-- TAB 2: USER COMMENTS -->
            <C411CommentsTab
              v-show="activeTab === 'comments'"
              :details="details"
            />

            <!-- TAB 3: NFO -->
            <div v-if="details?.nfo" v-show="activeTab === 'nfo'" class="tab-pane-nfo">
              <pre class="nfo-pre-block font-mono">{{ details.nfo }}</pre>
            </div>
          </template>
        </div>
      </div>

      <!-- Bottom Sticky Footer (ONLY Lancer Public & Lancer Privé side-by-side) -->
      <div class="c411-modal-footer">
        <div class="modal-footer-actions">
          <button
            v-if="isAdding"
            type="button"
            class="btn-footer-add btn-modal-add loading"
            disabled
          >
            ⏳ Téléchargement en cours...
          </button>
          <button
            v-else-if="isAdded"
            type="button"
            class="btn-footer-add btn-modal-add added"
            disabled
          >
            ✓ Torrent ajouté à vos téléchargements
          </button>
          <template v-else>
            <button
              type="button"
              class="btn-footer-add btn-modal-add btn-public"
              title="Ajouter en mode Public (visible par tous)"
              @click="item && emit('add', item.id, false)"
            >
              🌐 Lancer (Public)
            </button>
            <button
              type="button"
              class="btn-footer-add btn-modal-add btn-private"
              title="Ajouter en mode Privé (visible uniquement par vous et l'administrateur)"
              @click="item && emit('add', item.id, true)"
            >
              🔒 Lancer (Privé)
            </button>
          </template>
        </div>
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
  height: 90vh;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.1);
  overflow: hidden;
  animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Header */
.c411-modal-header {
  padding: 1rem 1.5rem;
  background: #131d33;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  flex-shrink: 0;
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

.btn-modal-close {
  flex-shrink: 0;
  margin-left: auto;
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

/* Backdrop Banner */
.modal-backdrop-banner {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: #000;
}

.backdrop-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%;
  opacity: 0.7;
}

.backdrop-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%);
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
  flex-shrink: 0;
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
  padding: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.modal-body-content {
  padding: 1.25rem 1.5rem;
}

.modal-loading-pane,
.modal-error-pane {
  padding: 3rem 1.5rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.95rem;
}

.spinner-icon {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
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

/* Footer (Sticky bottom with Lancer Public and Lancer Privé side-by-side) */
.c411-modal-footer {
  padding: 0.75rem 1.25rem;
  background: #111a2e;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);
}

.modal-footer-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.btn-footer-add {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: white;
  border: none;
  font-size: 0.92rem;
  font-weight: 700;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  min-height: 44px;
  transition: all 0.15s;
}

.btn-footer-add.btn-public {
  background: #f97316;
}

.btn-footer-add.btn-public:hover:not(:disabled) {
  background: #ea580c;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);
  transform: translateY(-1px);
}

.btn-footer-add.btn-private {
  background: #6366f1;
}

.btn-footer-add.btn-private:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
  transform: translateY(-1px);
}

.btn-footer-add.added {
  background: #334155;
  color: #94a3b8;
  cursor: default;
}

.btn-footer-add.loading {
  background: #475569;
  color: #cbd5e1;
  cursor: wait;
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
  .c411-modal-window {
    height: 96vh;
    max-height: 96vh;
    border-radius: 10px;
  }
  .c411-modal-header {
    padding: 0.75rem 0.85rem;
    gap: 0.75rem;
  }
  .modal-release-title {
    font-size: 1.05rem;
  }
  .c411-modal-tabs {
    padding: 0 0.5rem;
  }
  .modal-tab-btn {
    padding: 0.6rem 0.5rem;
    font-size: 0.78rem;
  }
  .modal-backdrop-banner {
    height: 120px;
  }
  .c411-stats-strip {
    padding: 0.5rem 0.85rem;
    gap: 0.75rem;
    font-size: 0.74rem;
  }
  .modal-body-content {
    padding: 0.85rem;
  }
  .c411-modal-footer {
    padding: 0.6rem 0.75rem;
  }
  .modal-footer-actions {
    flex-direction: row;
    gap: 0.5rem;
    width: 100%;
  }
  .btn-footer-add {
    flex: 1;
    padding: 0.65rem 0.5rem;
    font-size: 0.85rem;
    min-height: 42px;
  }
}
</style>
