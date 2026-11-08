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
  (e: 'change-file', file: TorrentFileDTO): void;
}>();

const currentFile = ref<TorrentFileDTO>(props.file);

// Video files in torrent (sorted numerically for series E01, E02...)
const videoFiles = computed(() => {
  return props.torrent.files
    .filter((f) => f.category === 'video' && !f.name.toLowerCase().includes('sample'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
});

const isSeriesOrMultiVideo = computed(() => videoFiles.value.length > 1);

const currentVideoIndex = computed(() => {
  return videoFiles.value.findIndex((f) => f.index === currentFile.value.index);
});

const hasNextEpisode = computed(() => {
  return currentVideoIndex.value >= 0 && currentVideoIndex.value < videoFiles.value.length - 1;
});

const hasPrevEpisode = computed(() => {
  return currentVideoIndex.value > 0;
});

const cleanEpisodeName = (name: string): string => {
  const match = name.match(/S(\d+)E(\d+)/i) || name.match(/E(\d+)/i);
  if (match) {
    return match[0].toUpperCase();
  }
  return name.replace(/\.[a-z0-9]+$/i, '');
};

const selectEpisode = (newFile: TorrentFileDTO) => {
  currentFile.value = newFile;
  emit('change-file', newFile);
  selectedAudioTrack.value = 0;
  remuxStartOffset.value = 0;
  hasCodecError.value = false;
  probeData.value = null;
  savedResumeTime.value = null;
  showResumeBadge.value = false;

  try {
    const rawSaved = localStorage.getItem(`peerflix_pos_${props.torrent.infoHash}_${newFile.index}`);
    if (rawSaved) {
      const parsed = parseFloat(rawSaved);
      if (!isNaN(parsed) && parsed > 15) {
        savedResumeTime.value = parsed;
        showResumeBadge.value = true;
      }
    }
  } catch {}

  fetchProbeData();
};

const goToNextEpisode = () => {
  if (hasNextEpisode.value) {
    selectEpisode(videoFiles.value[currentVideoIndex.value + 1]);
  }
};

const goToPrevEpisode = () => {
  if (hasPrevEpisode.value) {
    selectEpisode(videoFiles.value[currentVideoIndex.value - 1]);
  }
};

const onEpisodeSelectChange = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const targetIndex = parseInt(select.value, 10);
  const targetFile = videoFiles.value.find((f) => f.index === targetIndex);
  if (targetFile) {
    selectEpisode(targetFile);
  }
};

const onVideoEnded = () => {
  if (hasNextEpisode.value) {
    goToNextEpisode();
  }
};

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

const browserInfo = computed(() => {
  if (typeof navigator === 'undefined') {
    return { isFirefox: false, isChrome: true, isSafari: false, isEdge: false, name: 'Navigateur' };
  }
  const ua = navigator.userAgent;
  const isFirefox = /firefox|fxios/i.test(ua);
  const isEdge = /edg/i.test(ua);
  const isChrome = /chrome|crios/i.test(ua) && !isEdge;
  const isSafari = /safari/i.test(ua) && !isChrome && !isEdge;
  let name = 'Navigateur';
  if (isFirefox) name = 'Firefox';
  else if (isEdge) name = 'Microsoft Edge';
  else if (isChrome) name = 'Google Chrome';
  else if (isSafari) name = 'Apple Safari';
  return { isFirefox, isChrome, isSafari, isEdge, name };
});

const isBrowserHevcCompatible = computed(() => {
  if (typeof document === 'undefined') return true;
  const testVideo = document.createElement('video');
  const canPlayHevc1 = testVideo.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"');
  const canPlayHevc2 = testVideo.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"');
  const canPlayHevc3 = testVideo.canPlayType('video/mp4; codecs="hev1"');
  const canPlayHevc4 = testVideo.canPlayType('video/mp4; codecs="hvc1"');
  const canPlayMkvHevc = testVideo.canPlayType('video/x-matroska; codecs="hevc"');
  const hasCanPlay = Boolean(canPlayHevc1 || canPlayHevc2 || canPlayHevc3 || canPlayHevc4 || canPlayMkvHevc);

  // On modern Linux (via FFmpeg/VA-API) and Windows/macOS, Firefox, Chrome, Edge, Safari
  // can decode HEVC smoothly via system hardware acceleration.
  return hasCanPlay || browserInfo.value.isSafari || browserInfo.value.isChrome || browserInfo.value.isEdge;
});

const hevcWarningNeeded = computed(() => {
  // Only show warning if the browser truly cannot decode HEVC or if an explicit playback error occurred
  return isHevc.value && (!isBrowserHevcCompatible.value || hasCodecError.value);
});

const isCastOrAirPlaySupported = ref<boolean>(false);
let castWatchId: number | null = null;

const checkCastAvailability = () => {
  const video = videoRef.value as any;
  if (!video) return;

  // 1. WebKit AirPlay detection (Safari / macOS / iOS)
  if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
    if (typeof window !== 'undefined' && (window as any).WebKitPlaybackTargetAvailabilityEvent) {
      video.addEventListener('webkitplaybacktargetavailabilitychanged', (event: any) => {
        isCastOrAirPlaySupported.value = event.availability === 'available';
      });
    } else {
      isCastOrAirPlaySupported.value = true;
    }
  }

  // 2. Remote Playback API (Chrome / Edge with Chromecast device on network)
  if (video.remote && typeof video.remote.watchAvailability === 'function') {
    video.remote
      .watchAvailability((available: boolean) => {
        isCastOrAirPlaySupported.value = available;
      })
      .then((id: number) => {
        castWatchId = id;
      })
      .catch(() => {
        isCastOrAirPlaySupported.value = false;
      });
  }
};

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
  return `/torrents/${props.torrent.infoHash}/files/${currentFile.value.index}/vlc.m3u`;
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
    return currentFile.value.streamUrl;
  }

  const audioTrack = probeData.value.audioStreams.find(
    (a) => a.audioTrackIndex === selectedAudioTrack.value
  );

  const needsRemux =
    selectedAudioTrack.value > 0 ||
    (audioTrack && !audioTrack.browserSupported) ||
    probeData.value.needsAudioRemux;

  if (needsRemux) {
    let url = `/torrents/${props.torrent.infoHash}/remux/${currentFile.value.index}?audioTrack=${selectedAudioTrack.value}`;
    if (remuxStartOffset.value > 0) {
      url += `&start=${remuxStartOffset.value}`;
    }
    return url;
  }

  return currentFile.value.streamUrl;
});

const onVideoError = () => {
  hasCodecError.value = true;
};

const fetchProbeData = async () => {
  isProbing.value = true;
  try {
    const res = await fetch(`/torrents/${props.torrent.infoHash}/probe/${currentFile.value.index}`, {
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

const triggerAirPlayOrCast = async () => {
  const video = videoRef.value as any;
  if (!video) return;
  try {
    if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
      video.webkitShowPlaybackTargetPicker();
    } else if (video.remote && typeof video.remote.prompt === 'function') {
      await video.remote.prompt();
    }
  } catch (err: any) {
    console.warn('Cast / AirPlay prompt cancelled or unsupported:', err?.message);
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  // If target is an input or textarea, don't intercept
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) {
    return;
  }

  if (event.key === 'Escape') {
    emit('close');
    return;
  }

  // Episode navigation hotkeys [ and ] or p and n
  if (event.key === '[' || event.key === 'p' || event.key === 'P') {
    goToPrevEpisode();
    return;
  }
  if (event.key === ']' || event.key === 'n' || event.key === 'N') {
    goToNextEpisode();
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

const storageKey = computed(() => `peerflix_pos_${props.torrent.infoHash}_${currentFile.value.index}`);

const getInitialSavedTime = (): number | null => {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`peerflix_pos_${props.torrent.infoHash}_${currentFile.value.index}`);
      if (raw) {
        const parsed = parseFloat(raw);
        if (!isNaN(parsed) && parsed > 15) return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return null;
};

const initialSaved = getInitialSavedTime();
const savedResumeTime = ref<number | null>(initialSaved);
const showResumeBadge = ref<boolean>(initialSaved !== null);
let lastSavedSecond = 0;

const onLoadedMetadata = () => {
  if (savedResumeTime.value && savedResumeTime.value > 15 && videoRef.value) {
    // If not in remux mode with offset already applied
    if (remuxStartOffset.value === 0) {
      videoRef.value.currentTime = savedResumeTime.value;
    }
    showResumeBadge.value = true;
  }
};

const onTimeUpdate = () => {
  const video = videoRef.value;
  if (!video) return;

  const currentExact = video.currentTime + remuxStartOffset.value;
  const currentSec = Math.floor(currentExact);

  // Throttled save every 5 seconds
  if (Math.abs(currentSec - lastSavedSecond) >= 5) {
    lastSavedSecond = currentSec;
    const duration = probeData.value?.durationSeconds || video.duration;

    // Clear progress if near the end (> 95% or within last 2 minutes)
    if (duration && duration > 30 && (currentExact / duration > 0.95 || duration - currentExact < 120)) {
      try {
        localStorage.removeItem(storageKey.value);
        showResumeBadge.value = false;
      } catch {
        // Ignore
      }
    } else if (currentSec > 15) {
      try {
        localStorage.setItem(storageKey.value, currentSec.toString());
      } catch {
        // Ignore
      }
    }
  }
};

const restartFromBeginning = () => {
  try {
    localStorage.removeItem(storageKey.value);
  } catch {
    // Ignore
  }
  savedResumeTime.value = null;
  showResumeBadge.value = false;
  remuxStartOffset.value = 0;
  if (videoRef.value) {
    videoRef.value.currentTime = 0;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  try {
    const rawSaved = localStorage.getItem(storageKey.value);
    if (rawSaved) {
      const parsed = parseFloat(rawSaved);
      if (!isNaN(parsed) && parsed > 15) {
        savedResumeTime.value = parsed;
        showResumeBadge.value = true;
      }
    }
  } catch {
    // Ignore
  }
  fetchProbeData();
  setTimeout(() => {
    checkCastAvailability();
  }, 300);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (videoRef.value && (videoRef.value as any).remote && castWatchId !== null) {
    try {
      (videoRef.value as any).remote.cancelWatchAvailability(castWatchId);
    } catch {}
  }
});
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-container">
      <!-- Modal Header -->
      <div class="modal-header">
        <!-- Top Row: Badge + Clean Non-wrapping Title + Close Button -->
        <div class="header-top-row">
          <div class="header-title-box">
            <span class="badge-media">
              {{ isSeriesOrMultiVideo ? `📺 Épisode ${currentVideoIndex + 1} / ${videoFiles.length}` : '🎬 Lecteur Vidéo' }}
            </span>
            <h2 class="media-title" :title="currentFile.name">{{ currentFile.name }}</h2>
          </div>

          <button
            type="button"
            class="btn-close"
            title="Fermer (Échap)"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <!-- Bottom Row: Media Prober Badges + Episode Navigator + Action Controls -->
        <div class="header-bottom-row">
          <!-- Left: Media Prober Badges -->
          <div class="header-badges-group">
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

          <!-- Center: Episode Navigator for TV Series / Complete Season Packs -->
          <div v-if="isSeriesOrMultiVideo" class="episode-navigator">
            <button
              type="button"
              class="btn-ep-nav"
              :disabled="!hasPrevEpisode"
              title="Épisode précédent (Touche [)"
              @click="goToPrevEpisode"
            >
              ⏮
            </button>
            <div class="ep-select-wrapper">
              <select
                :value="currentFile.index"
                class="select-episode"
                title="Choisir un épisode"
                @change="onEpisodeSelectChange"
              >
                <option
                  v-for="(vf, idx) in videoFiles"
                  :key="vf.index"
                  :value="vf.index"
                >
                  Ép. {{ idx + 1 }} : {{ cleanEpisodeName(vf.name) }}
                </option>
              </select>
            </div>
            <button
              type="button"
              class="btn-ep-nav"
              :disabled="!hasNextEpisode"
              title="Épisode suivant (Touche ])"
              @click="goToNextEpisode"
            >
              ⏭
            </button>
          </div>

          <!-- Right: Audio & Action Tools -->
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

            <!-- Cast / Airplay (Shown ONLY if browser or environment supports it and targets are available) -->
            <button
              v-if="isCastOrAirPlaySupported"
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
              :href="currentFile.downloadUrl"
              class="btn-action-icon"
              download
              title="Télécharger le fichier directement"
            >
              ⬇ Télécharger
            </a>
          </div>
        </div>
      </div>

      <!-- Resume Playback Banner -->
      <div v-if="showResumeBadge && savedResumeTime" class="resume-info-banner">
        <span class="resume-banner-icon">⏱</span>
        <div class="resume-banner-text">
          <span>Reprise de lecture à <strong>{{ formatDuration(savedResumeTime) }}</strong></span>
          <button type="button" class="btn-restart-video" @click="restartFromBeginning">
            ↺ Recommencer depuis le début
          </button>
        </div>
      </div>

      <!-- 4K HEVC / Info & Codec Compatibility Banner -->
      <div v-if="isHevc" class="hevc-info-banner" :class="{ 'hevc-warning': hevcWarningNeeded }">
        <span class="hevc-banner-icon">{{ hevcWarningNeeded ? '⚠️' : '🎬' }}</span>
        <div class="hevc-banner-text">
          <template v-if="hevcWarningNeeded">
            <strong>Format HEVC (H.265) sous {{ browserInfo.name }} :</strong> Ce navigateur ne prend généralement pas en charge le codec HEVC nativement. Pour une lecture directe sans faille, utilisez <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong> ou <strong>Safari</strong>. Ou cliquez sur <a :href="vlcM3uUrl" class="btn-banner-link vlc">🟠 VLC</a> pour lancer instantanément le film sans aucune contrainte de codec.
          </template>
          <template v-else>
            <strong>Lecture active ({{ browserInfo.name }}) :</strong> Codec HEVC compatible avec votre navigateur. En streaming web direct, le curseur avance au rythme du téléchargement. Pour <strong>sauter directement au milieu du film</strong>, utilisez <a :href="vlcM3uUrl" class="btn-banner-link vlc">🟠 VLC</a> (priorisation instantanée des morceaux par BitTorrent).
          </template>
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
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @ended="onVideoEnded"
          @error="onVideoError"
        >
          <!-- External .srt/.vtt track if available -->
          <track
            v-if="currentFile.subtitleUrl"
            kind="subtitles"
            label="Sous-titres externes"
            srclang="fr"
            default
            :src="currentFile.subtitleUrl"
          />

          <!-- Embedded text subtitles from MKV container via ffmpeg (excluding bitmap PGS subtitles) -->
          <template v-if="probeData && probeData.subtitleStreams">
            <track
              v-for="sub in probeData.subtitleStreams.filter((s) => s.isTextBased)"
              :key="sub.subTrackIndex"
              kind="subtitles"
              :label="`${sub.language ? sub.language.toUpperCase() : 'Sous-titre'} ${sub.title ? '(' + sub.title + ')' : ''}`"
              :srclang="sub.language || 'fr'"
              :src="`/torrents/${torrent.infoHash}/embedded-subtitles/${currentFile.index}/${sub.subTrackIndex}`"
            />
          </template>
          Votre navigateur ne prend pas en charge la lecture vidéo HTML5.
        </video>

        <!-- Codec / Incompatibility Warning Overlay -->
        <PlayerErrorOverlay
          v-if="hasCodecError"
          :vlc-direct-url="vlcM3uUrl"
          :download-url="currentFile.downloadUrl"
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
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.header-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
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
  flex-shrink: 0;
}

.media-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.header-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  width: 100%;
}

.header-badges-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.episode-navigator {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 0.2rem 0.45rem;
  border-radius: 8px;
}

.btn-ep-nav {
  background: none;
  border: none;
  color: #60a5fa;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  line-height: 1;
  transition: all 0.15s;
}

.btn-ep-nav:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.25);
  color: #ffffff;
}

.btn-ep-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.select-episode {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #f1f5f9;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  outline: none;
  cursor: pointer;
  max-width: 240px;
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

.hevc-info-banner.hevc-warning {
  background: rgba(239, 68, 68, 0.15);
  border-bottom: 1px solid rgba(239, 68, 68, 0.35);
  color: #fca5a5;
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

.resume-info-banner {
  background: rgba(16, 185, 129, 0.12);
  border-bottom: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.5rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: #a7f3d0;
}

.resume-banner-icon {
  font-size: 1.1rem;
}

.resume-banner-text {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
}

.btn-restart-video {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.25rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-restart-video:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.35);
}

.video-element {
  width: 100%;
  height: 100%;
  max-height: calc(90vh - 120px);
  outline: none;
}
</style>
