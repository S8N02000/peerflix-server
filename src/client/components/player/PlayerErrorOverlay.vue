<script setup lang="ts">
defineProps<{
  vlcDirectUrl: string;
  downloadUrl: string;
  showDirectOption?: boolean;
}>();

defineEmits<{
  (e: 'switch-direct'): void;
}>();
</script>

<template>
  <div class="codec-error-overlay">
    <div class="codec-error-card">
      <span class="codec-icon">⚠️</span>
      <h3 class="codec-title">Format vidéo non lisible dans ce navigateur</h3>
      <p class="codec-desc">
        Ce fichier utilise un conteneur ou un codec audio/vidéo (ex: AC3, DTS, HEVC, MKV) non pris en charge nativement par votre navigateur web.
      </p>
      <div class="codec-actions">
        <a :href="vlcDirectUrl" class="btn-codec-action vlc">
          🟠 Lancer directement dans VLC
        </a>
        <button
          v-if="showDirectOption"
          type="button"
          class="btn-codec-action direct"
          @click="$emit('switch-direct')"
        >
          🎞 Essayer le Flux direct
        </button>
        <a :href="downloadUrl" class="btn-codec-action download" download>
          ⬇ Télécharger le fichier
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.codec-error-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  z-index: 10;
}

.codec-error-card {
  max-width: 500px;
  background: #1e293b;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 0.75rem;
  padding: 1.5rem;
  text-align: center;
}

.codec-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  display: block;
}

.codec-title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #f87171;
}

.codec-desc {
  margin: 0 0 1.25rem;
  font-size: 0.85rem;
  line-height: 1.4;
  color: #94a3b8;
}

.codec-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-codec-action {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
}

.btn-codec-action.vlc {
  background: #f97316;
  color: white;
}
.btn-codec-action.vlc:hover {
  background: #ea580c;
}

.btn-codec-action.direct {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.4);
  cursor: pointer;
}
.btn-codec-action.direct:hover {
  background: rgba(16, 185, 129, 0.35);
}

.btn-codec-action.download {
  background: #3b82f6;
  color: white;
}
.btn-codec-action.download:hover {
  background: #2563eb;
}
</style>
