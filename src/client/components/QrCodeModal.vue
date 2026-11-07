<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import QRCode from 'qrcode';
import type { TorrentFileDTO, TorrentDTO, SystemStatusDTO } from '../../shared/types.js';
import { getExternalBaseUrl } from '../utils/auth-url.js';

const props = defineProps<{
  file: TorrentFileDTO;
  torrent: TorrentDTO;
  systemStatus?: SystemStatusDTO | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const qrCanvasRef = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);

const fullStreamUrl = computed(() => {
  const baseUrl = getExternalBaseUrl(props.systemStatus);
  return `${baseUrl}${props.file.streamUrl}`;
});

onMounted(async () => {
  if (qrCanvasRef.value) {
    try {
      await QRCode.toCanvas(qrCanvasRef.value, fullStreamUrl.value, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.error('Failed to render QR Code', err);
    }
  }
});

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(fullStreamUrl.value);
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
    <div class="qr-modal-container">
      <div class="qr-header">
        <h3 class="qr-title">📱 Diffuser sur Mobile ou TV</h3>
        <button
          type="button"
          class="btn-close"
          title="Fermer"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="qr-content">
        <p class="qr-desc">
          Scannez ce QR Code avec votre smartphone, tablette ou application TV (ex: VLC, Kodi) connectée au même réseau local pour lancer le streaming directement.
        </p>

        <div class="qr-code-box">
          <canvas ref="qrCanvasRef" class="qr-canvas"></canvas>
        </div>

        <div class="url-copy-box">
          <input
            type="text"
            readonly
            :value="fullStreamUrl"
            class="url-input font-mono"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="btn-copy"
            :class="{ success: copied }"
            @click="copyUrl"
          >
            {{ copied ? '✓ Copié !' : 'Copier' }}
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

.qr-modal-container {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1rem;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
}

.qr-header {
  padding: 1rem 1.25rem;
  background: #0f172a;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.qr-title {
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

.qr-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-desc {
  margin: 0 0 1.25rem 0;
  font-size: 0.85rem;
  color: #94a3b8;
  text-align: center;
  line-height: 1.4;
}

.qr-code-box {
  background: #ffffff;
  padding: 0.75rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.qr-canvas {
  display: block;
}

.url-copy-box {
  width: 100%;
  display: flex;
  gap: 0.5rem;
}

.url-input {
  flex: 1;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0.375rem;
  color: #e2e8f0;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  outline: none;
}

.url-input:focus {
  border-color: #3b82f6;
}

.btn-copy {
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-copy:hover {
  background: #2563eb;
}

.btn-copy.success {
  background: #10b981;
}
</style>
