<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { TorrentFileDTO, TorrentDTO, MediaProbeDTO, SystemStatusDTO } from '../../shared/types.js';
import PlayerErrorOverlay from './player/PlayerErrorOverlay.vue';
import PlayerHotkeys from './player/PlayerHotkeys.vue';

const props = defineProps<{
  file: TorrentFileDTO;
  torrent: TorrentDTO;
  systemStatus?: SystemStatusDTO | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-qr'): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const hasCodecError = ref<boolean>(false);
const probeData = ref<MediaProbeDTO | null>(null);
const selectedAudioTrack = ref<number>(0);
const isProbing = ref<boolean>(true);
const forceDirectStream = ref<boolean>(false);
const remuxStartOffset = ref<number>(0);

const isDirectMode = computed(() => forceDirectStream.value);

const isHevc = computed(() => {
  const vCodec = probeData.value?.videoStreams[0]?.codec?.toLowerCase();
  return vCodec === 'hevc' || vCodec === 'h265';
});

const toggleStreamMode = () => {
  forceDirectStream.value = !forceDirectStream.value;
  hasCodecError.value = false;
};

const setStreamMode = (mode: 'direct' | 'remux') => {
  forceDirectStream.value = mode === 'direct';
  hasCodecError.value = false;
};

const onAudioTrackSelect = () => {
  // Capture current playback position to resume seamlessly at the same second
  if (videoRef.value && videoRef.value.currentTime > 2) {
    remuxStartOffset.value = Math.floor(videoRef.value.currentTime);
  }
  forceDirectStream.value = false;
  hasCodecError.value = false;
};

const vlcM3uUrl = computed(() => {
  return `/torrents/${props.torrent.infoHash}/files/${props.file.index}/vlc.m3u`;
});

const formatDuration = (seconds?: number): string => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

// Video stream source: direct stream or remux if non-native audio / secondary track chosen
const effectiveVideoSrc = computed(() => {
  if (forceDirectStream.value || !probeData.value) {
    return props.file.streamUrl;
  }

  const audioTrack = probeData.value.audioStreams.find(
    (a) => a.audioTrackIndex === selectedAudioTrack.value
  );

  const needsRemux =
    selectedAudioTrack.value > 0 ||
    (audioTrack && !audioTrack.browserSupported) ||
    probeData.value.needsAudioRemux;

  if (needsRemux) {
    let url = `/torrents/${props.torrent.infoHash}/remux/${props.file.index}?audioTrack=${selectedAudioTrack.value}`;
    if (remuxStartOffset.value > 0) {
      url += `&start=${remuxStartOffset.value}`;
    }
    return url;
  }

  return props.file.streamUrl;
});

const onVideoError = () => {
  hasCodecError.value = true;
};

const fetchProbeData = async () => {
  isProbing.value = true;
  try {
    const res = await fetch(`/torrents/${props.torrent.infoHash}/probe/${props.file.index}`, {
      credentials: 'include'
    });
    if (res.ok) {
      probeData.value = await res.json();
    }
  } catch (err) {
    // Non-blocking, fallback to native playback
  } finally {
    isProbing.value = false;
  }
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
  fetchProbeData();
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

          <!-- Media Prober Badges -->
          <div v-if="probeData" class="probe-badges">
            <span v-if="probeData.videoStreams[0]" class="probe-badge video">
              🎬 {{ probeData.videoStreams[0].codec.toUpperCase() }}
              {{ probeData.videoStreams[0].height ? (probeData.videoStreams[0].height >= 2000 ? '4K' : probeData.videoStreams[0].height + 'p') : '' }} ✓
            </span>

            <span v-if="probeData.durationSeconds" class="probe-badge duration">
              ⏱ Durée : {{ formatDuration(probeData.durationSeconds) }}
            </span>

            <span v-if="probeData.needsAudioRemux" class="probe-badge remux">
              🔊 Audio : Conversion AAC auto ✓
            </span>
          </div>
        </div>

        <div class="header-actions">
          <!-- Audio Track Selector if multiple or remuxed -->
          <div v-if="probeData && probeData.audioStreams.length > 0" class="audio-track-selector">
            <label for="audio-track-select" class="selector-label">🔊 Piste audio :</label>
            <select
              id="audio-track-select"
              v-model="selectedAudioTrack"
              class="select-audio"
              @change="onAudioTrackSelect"
            >
              <option
                v-for="track in probeData.audioStreams"
                :key="track.audioTrackIndex"
                :value="track.audioTrackIndex"
              >
                Piste {{ track.audioTrackIndex + 1 }} : {{ track.language ? track.language.toUpperCase() : 'Langue inconnue' }}
                {{ track.title ? `(${track.title})` : '' }} - {{ track.codec.toUpperCase() }}
                {{ !track.browserSupported ? '→ AAC' : '' }}
              </option>
            </select>
          </div>

          <!-- Stream Mode Toggle (Remux AAC vs Flux direct) -->
          <button
            v-if="probeData && probeData.needsAudioRemux"
            type="button"
            class="btn-action-icon btn-mode-toggle"
            :class="{ 'is-direct': isDirectMode }"
            :title="isDirectMode ? 'Passer en conversion AAC auto' : 'Passer en flux direct original sans conversion'"
            @click="toggleStreamMode"
          >
            {{ isDirectMode ? '🎞 Flux direct' : '⚡ Remux AAC' }}
          </button>

          <!-- VLC M3U download link (universal for PC/Mac/Linux) -->
          <a
            :href="vlcM3uUrl"
            class="btn-action-icon btn-vlc"
            title="Télécharger la playlist M3U pour lancer instantanément dans VLC (sans erreur de protocole)"
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

      <!-- 4K HEVC / Info Banner -->
      <div v-if="isHevc" class="hevc-info-banner">
        <span class="hevc-banner-icon">🎬</span>
        <div class="hevc-banner-text">
          <strong>Lecture active (Firefox & Chrome) :</strong> En streaming web direct, le curseur avance au rythme du téléchargement. Pour <strong>sauter directement au milieu ou à n'importe quelle minute du film</strong>, utilisez <a :href="vlcM3uUrl" class="btn-banner-link vlc">🟠 VLC</a> (priorisation instantanée des morceaux par le moteur BitTorrent).
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
          crossorigin="use-credentials"
          x-webkit-airplay="allow"
          :src="effectiveVideoSrc"
          @error="onVideoError"
        >
          <!-- External .srt/.vtt track if available -->
          <track
            v-if="file.subtitleUrl"
            kind="subtitles"
            label="Sous-titres externes"
            srclang="fr"
            default
            :src="file.subtitleUrl"
          />

          <!-- Embedded text subtitles from MKV container via ffmpeg (excluding bitmap PGS subtitles) -->
          <template v-if="probeData && probeData.subtitleStreams">
            <track
              v-for="sub in probeData.subtitleStreams.filter((s) => s.isTextBased)"
              :key="sub.subTrackIndex"
              kind="subtitles"
              :label="`${sub.language ? sub.language.toUpperCase() : 'Sous-titre'} ${sub.title ? '(' + sub.title + ')' : ''}`"
              :srclang="sub.language || 'fr'"
              :src="`/torrents/${torrent.infoHash}/embedded-subtitles/${file.index}/${sub.subTrackIndex}`"
            />
          </template>
          Votre navigateur ne prend pas en charge la lecture vidéo HTML5.
        </video>

        <!-- Codec / Incompatibility Warning Overlay -->
        <PlayerErrorOverlay
          v-if="hasCodecError"
          :vlc-direct-url="vlcM3uUrl"
          :download-url="file.downloadUrl"
          :show-direct-option="!isDirectMode"
          @switch-direct="setStreamMode('direct')"
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

.probe-badges {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.probe-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 0.35rem;
  white-space: nowrap;
}

.probe-badge.video {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.probe-badge.duration {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.probe-badge.remux {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.audio-track-selector {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.selector-label {
  font-size: 0.75rem;
  color: #94a3b8;
  white-space: nowrap;
}

.select-audio {
  background: #14151f;
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.375rem;
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}

.select-audio:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
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

.btn-mode-toggle {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.35);
  font-weight: 500;
}
.btn-mode-toggle:hover {
  background: rgba(245, 158, 11, 0.25);
}
.btn-mode-toggle.is-direct {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.35);
}
.btn-mode-toggle.is-direct:hover {
  background: rgba(16, 185, 129, 0.25);
}

.hevc-info-banner {
  background: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.25);
  padding: 0.5rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: #fcd34d;
}

.hevc-banner-icon {
  font-size: 1rem;
}

.hevc-banner-text {
  flex: 1;
  line-height: 1.4;
}

.btn-banner-link {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 0.25rem;
  padding: 0.15rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  margin: 0 0.2rem;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: all 0.15s;
}

.btn-banner-link:hover {
  background: rgba(255, 255, 255, 0.25);
}

.btn-banner-link.vlc {
  background: #f97316;
  border-color: #ea580c;
  color: white;
}
.btn-banner-link.vlc:hover {
  background: #ea580c;
}

.video-element {
  width: 100%;
  height: 100%;
  max-height: calc(90vh - 120px);
  outline: none;
}
</style>
