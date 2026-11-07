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

const hashValue = ref<string>('');
const isComputing = ref<boolean>(true);
const errorMessage = ref<string | null>(null);
const copied = ref<boolean>(false);

onMounted(async () => {
  try {
    const res = await fetch(`/torrents/${props.torrent.infoHash}/hash/${props.file.index}`);
    if (!res.ok) {
      throw new Error(`Erreur serveur (${res.status})`);
    }
    const data = await res.json();
    hashValue.value = data.sha256;
  } catch (err: any) {
    errorMessage.value = err.message || 'Impossible de calculer l\'empreinte SHA-256';
  } finally {
    isComputing.value = false;
  }
});

const copyHash = async () => {
  if (!hashValue.value) return;
  try {
    await navigator.clipboard.writeText(hashValue.value);
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
    <div class="hash-modal-container">
      <div class="hash-header">
        <h3 class="hash-title">🛡️ Intégrité du fichier (SHA-256)</h3>
        <button
          type="button"
          class="btn-close"
          title="Fermer"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="hash-content">
        <div class="file-summary">
          <span class="file-name" :title="file.name">{{ file.name }}</span>
        </div>

        <p class="hash-description">
          L'empreinte cryptographique SHA-256 garantit que le fichier téléchargé est rigoureusement identique à l'original et n'a subi aucune altération.
        </p>

        <div v-if="isComputing" class="computing-box">
          <div class="spinner"></div>
          <span>Calcul du hachage SHA-256 en flux continu...</span>
        </div>

        <div v-else-if="errorMessage" class="error-box">
          ⚠️ {{ errorMessage }}
        </div>

        <div v-else class="hash-result-box">
          <div class="hash-display font-mono">
            {{ hashValue }}
          </div>
          <button
            type="button"
            class="btn-copy"
            :class="{ success: copied }"
            @click="copyHash"
          >
            {{ copied ? '✓ Empreinte copiée !' : 'Copier l\'empreinte SHA-256' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 1.5rem;
}

.hash-modal-container {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1rem;
  width: 100%;
  max-width: 580px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

.hash-header {
  padding: 1rem 1.25rem;
  background: #0f172a;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.hash-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #f1f5f9;
}

.btn-close {
  background: transparent;
  color: #94a3b8;
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

.hash-content {
  padding: 1.5rem;
}

.file-summary {
  background: #0f172a;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.file-name {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 0.9rem;
  word-break: break-all;
}

.hash-description {
  margin: 0 0 1.25rem 0;
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.4;
}

.computing-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-box {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  padding: 1rem;
  border-radius: 0.5rem;
  text-align: center;
}

.hash-result-box {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hash-display {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  color: #10b981;
  font-size: 0.85rem;
  word-break: break-all;
  user-select: all;
  text-align: center;
}

.btn-copy {
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.6rem 1.2rem;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  align-self: center;
}

.btn-copy:hover {
  background: #2563eb;
}

.btn-copy.success {
  background: #10b981;
}
</style>
