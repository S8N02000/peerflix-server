<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { TorrentFileDTO, TorrentDTO } from '../../shared/types.js';

const props = defineProps<{
  file: TorrentFileDTO;
  torrent: TorrentDTO;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const nfoContent = ref<string>('');
import { getSavedAuthCredentials } from '../utils/auth-url.js';

const isLoading = ref<boolean>(true);
const errorMessage = ref<string | null>(null);
const copied = ref<boolean>(false);

onMounted(async () => {
  try {
    const creds = getSavedAuthCredentials();
    const headers: Record<string, string> = {};
    if (creds && creds.includes(':')) {
      try {
        headers['Authorization'] = 'Basic ' + btoa(creds);
      } catch {}
    }
    const res = await fetch(`/torrents/${props.torrent.infoHash}/preview/${props.file.index}`, {
      credentials: 'include',
      headers
    });
    if (!res.ok) {
      throw new Error(`Erreur serveur (${res.status})`);
    }
    const data = await res.json();
    nfoContent.value = data.content;
  } catch (err: any) {
    errorMessage.value = err.message || 'Impossible de charger le fichier NFO';
  } finally {
    isLoading.value = false;
  }
});

const copyContent = async () => {
  if (!nfoContent.value) return;
  try {
    await navigator.clipboard.writeText(nfoContent.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Clipboard copy failed', err);
  }
};
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="nfo-modal-container">
      <div class="nfo-header">
        <div class="header-title-box">
          <span class="badge-nfo">ℹ Visualiseur NFO (DOS CP437)</span>
          <h3 class="nfo-filename" :title="file.name">{{ file.name }}</h3>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="btn-copy"
            :class="{ success: copied }"
            :disabled="isLoading || !!errorMessage"
            @click="copyContent"
          >
            {{ copied ? '✓ Copié !' : '📋 Copier l\'ASCII Art' }}
          </button>
          <button
            type="button"
            class="btn-close"
            title="Fermer"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="nfo-body">
        <div v-if="isLoading" class="loading-state">
          ⏳ Décodage du fichier DOS CP437 en cours...
        </div>

        <div v-else-if="errorMessage" class="error-state">
          ⚠️ {{ errorMessage }}
        </div>

        <pre v-else class="nfo-ascii-box">{{ nfoContent }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 1.5rem;
}

.nfo-modal-container {
  background: #0b0f19;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 1rem;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
}

.nfo-header {
  padding: 1rem 1.25rem;
  background: #111827;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 1rem;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  overflow: hidden;
}

.badge-nfo {
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
  border: 1px solid rgba(6, 182, 212, 0.35);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  white-space: nowrap;
}

.nfo-filename {
  margin: 0;
  font-size: 0.95rem;
  color: #f3f4f6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn-copy {
  background: #374151;
  color: #e5e7eb;
  padding: 0.4rem 0.8rem;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-copy:hover:not(:disabled) {
  background: #4b5563;
  color: #ffffff;
}

.btn-copy.success {
  background: #10b981;
  color: white;
  border-color: #059669;
}

.btn-close {
  background: transparent;
  color: #9ca3af;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: color 0.15s;
}

.btn-close:hover {
  color: #ef4444;
}

.nfo-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
  background: #030712;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem 1rem;
  font-size: 0.95rem;
}

.loading-state {
  color: #9ca3af;
}

.error-state {
  color: #f87171;
}

.nfo-ascii-box {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85rem;
  line-height: 1.15;
  color: #e2e8f0;
  white-space: pre;
  overflow-x: auto;
  user-select: text;
}
</style>
