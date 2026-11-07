<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { TorrentFileDTO, TorrentDTO } from '../../shared/types.js';
import PlayerErrorOverlay from './player/PlayerErrorOverlay.vue';
import PlayerHotkeys from './player/PlayerHotkeys.vue';

const props = defineProps<{
  file: TorrentFileDTO;
  torrent: TorrentDTO;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-qr'): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const hasCodecError = ref<boolean>(false);

const vlcDirectUrl = computed(() => {
  if (typeof window !== 'undefined' && window.location) {
    return `vlc://${window.location.origin}${props.file.streamUrl}`;
  }
  return `vlc://${props.file.streamUrl}`;
});

const onVideoError = () => {
  hasCodecError.value = true;
};

const triggerPictureInPicture = async () => {
  const video = videoRef.value;
  if (!video) return;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (typeof video.requestPictureInPicture === 'function') {
      await video.requestPictureInPicture();
    }
  } catch (err) {
    console.error('Picture-in-Picture error:', err);
  }
};

const triggerAirPlayOrCast = () => {
  const video = videoRef.value as any;
  if (!video) return;
  try {
    if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
      video.webkitShowPlaybackTargetPicker();
    } else if (video.remote && typeof video.remote.prompt === 'function') {
      video.remote.prompt();
    }
  } catch (err) {
    console.error('Cast / AirPlay prompt error:', err);
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  // If target is an input or textarea, don't intercept
  if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) {
    return;
  }

  if (event.key === 'Escape') {
    emit('close');
    return;
  }

  const video = videoRef.value;
  if (!video) return;

  if (event.code === 'Space') {
    event.preventDefault();
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    video.currentTime = Math.max(0, video.currentTime - 10);
  } else if (event.key === 'm' || event.key === 'M') {
    event.preventDefault();
    video.muted = !video.muted;
  } else if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    if (!document.fullscreenElement) {
      video.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-container">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-info">
          <span class="badge-media">🎬 Lecteur Vidéo</span>
          <h2 class="media-title" :title="file.name">{{ file.name }}</h2>
        </div>
        <div class="header-actions">
          <!-- VLC direct link -->
          <a
            :href="vlcDirectUrl"
            class="btn-action-icon btn-vlc"
            title="Ouvrir le flux directement dans l'application VLC"
          >
            🟠 VLC
          </a>

          <!-- Picture in picture -->
          <button
            type="button"
            class="btn-action-icon"
            title="Mode Picture-in-Picture (fenêtre flottante)"
            @click="triggerPictureInPicture"
          >
            🖼 PiP
          </button>

          <!-- Cast / Airplay -->
          <button
            type="button"
            class="btn-action-icon"
            title="Diffuser via AirPlay ou Chromecast"
            @click="triggerAirPlayOrCast"
          >
            📺 Cast
          </button>

          <!-- QR Code Modal -->
          <button
            type="button"
            class="btn-qr"
            title="Afficher le QR Code pour lire sur TV / Mobile"
            @click="emit('open-qr')"
          >
            📱 QR Code
          </button>

          <!-- Download -->
          <a
            :href="file.downloadUrl"
            class="btn-action-icon"
            download
            title="Télécharger le fichier directement"
          >
            ⬇ Télécharger
          </a>

          <!-- Close -->
          <button
            type="button"
            class="btn-close"
            title="Fermer (Échap)"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Video Player Area -->
      <div class="player-wrapper">
        <video
          ref="videoRef"
          class="video-element"
          controls
          autoplay
          playsinline
          x-webkit-airplay="allow"
          :src="file.streamUrl"
          @error="onVideoError"
        >
          <track
            v-if="file.subtitleUrl"
            kind="subtitles"
            label="Sous-titres"
            srclang="fr"
            default
            :src="file.subtitleUrl"
          />
          Votre navigateur ne prend pas en charge la lecture vidéo HTML5.
        </video>

        <!-- Codec / Incompatibility Warning Overlay -->
        <PlayerErrorOverlay
          v-if="hasCodecError"
          :vlc-direct-url="vlcDirectUrl"
          :download-url="file.downloadUrl"
        />
      </div>

      <!-- Modal Footer with Hotkeys Guide -->
      <PlayerHotkeys />
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
  z-index: 1000;
  padding: 1.5rem;
}

.modal-container {
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1rem;
  width: 100%;
  max-width: 1000px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
}

.modal-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 200px;
}

.badge-media {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  white-space: nowrap;
}

.media-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #f8fafc;
  word-break: break-all;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-action-icon {
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: all 0.15s;
}

.btn-action-icon:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.btn-vlc {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
  border-color: rgba(249, 115, 22, 0.35);
}
.btn-vlc:hover {
  background: rgba(249, 115, 22, 0.25);
}

.btn-qr {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 0.375rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all 0.15s;
}

.btn-qr:hover {
  background: rgba(59, 130, 246, 0.25);
}

.btn-close {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.15s;
}

.btn-close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
}

.player-wrapper {
  position: relative;
  background: #000000;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: calc(90vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.video-element {
  width: 100%;
  height: 100%;
  max-height: calc(90vh - 120px);
  outline: none;
}
</style>
