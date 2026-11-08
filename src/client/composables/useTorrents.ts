import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { io as ClientSocket, type Socket } from 'socket.io-client';
import type { TorrentDTO, SystemStatusDTO, TorrentCategory, FileCategory } from '../../shared/types.js';
import * as api from '../services/api.js';
import {
  getCurrentUser,
  saveCurrentUser,
  getIsAdmin,
  saveIsAdmin,
  getExternalBaseUrl,
  getSavedAuthCredentials
} from '../utils/auth-url.js';

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 o';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 Ko/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'hier';
  if (diffDays < 30) return `il y a ${diffDays}j`;
  return new Date(timestamp).toLocaleDateString('fr-FR');
}

export function isJunkFile(name: string, category: FileCategory): boolean {
  if (category === 'info') return false; // Always keep NFOs accessible
  const lower = name.toLowerCase();
  const junkExtensions = ['.url', '.txt', '.lnk', '.website'];
  const ext = lower.slice(lower.lastIndexOf('.'));
  if (junkExtensions.includes(ext)) return true;
  if (lower.includes('sample') && (category === 'video' || ext === '.mkv' || ext === '.mp4')) {
    return true;
  }
  return false;
}

const STORAGE_CAT_KEY = 'peerflix_selected_category';
const STORAGE_SORT_KEY = 'peerflix_sort_by';
const STORAGE_MY_TORRENTS_KEY = 'peerflix_only_my_torrents';

export function useTorrents() {
  const torrents = ref<TorrentDTO[]>([]);
  const systemStatus = ref<SystemStatusDTO | null>(null);
  const searchQuery = ref<string>('');

  // Persisted filters
  const initialCategory = typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_CAT_KEY) || 'all') : 'all';
  const selectedCategory = ref<string>(initialCategory);

  const initialSort = typeof localStorage !== 'undefined'
    ? ((localStorage.getItem(STORAGE_SORT_KEY) as any) || 'recent')
    : 'recent';
  const sortBy = ref<'recent' | 'name' | 'size' | 'progress'>(initialSort);

  const initialOnlyMy = typeof localStorage !== 'undefined'
    ? localStorage.getItem(STORAGE_MY_TORRENTS_KEY) === 'true'
    : false;
  const onlyMyTorrents = ref<boolean>(initialOnlyMy);

  // User session
  const currentUser = ref<string>(getCurrentUser());
  const isAdmin = ref<boolean>(getIsAdmin());

  // Watch and persist filters
  watch(selectedCategory, (newCat) => {
    try {
      localStorage.setItem(STORAGE_CAT_KEY, newCat);
    } catch {}
  });

  watch(sortBy, (newSort) => {
    try {
      localStorage.setItem(STORAGE_SORT_KEY, newSort);
    } catch {}
  });

  watch(onlyMyTorrents, (newVal) => {
    try {
      localStorage.setItem(STORAGE_MY_TORRENTS_KEY, newVal ? 'true' : 'false');
    } catch {}
  });

  const updateCurrentUser = (newUser: string) => {
    currentUser.value = newUser.trim() || 'Moi';
    saveCurrentUser(currentUser.value);
    loadTorrents();
  };

  const updateIsAdmin = (val: boolean, token?: string) => {
    isAdmin.value = val;
    saveIsAdmin(val, token);
    loadTorrents();
  };

  const hideJunkFiles = ref<boolean>(true);
  const isLoading = ref<boolean>(false);
  const errorMessage = ref<string | null>(null);

  let socket: Socket | null = null;

  const filteredTorrents = computed(() => {
    const userLower = currentUser.value.toLowerCase().trim();

    const list = torrents.value.filter((torrent) => {
      // Privacy check: if torrent is private, only visible to owner or admin
      if (torrent.isPrivate && !isAdmin.value) {
        if (!torrent.addedBy || torrent.addedBy.toLowerCase().trim() !== userLower) {
          return false;
        }
      }

      // "My torrents only" filter
      if (onlyMyTorrents.value) {
        if (!torrent.addedBy || torrent.addedBy.toLowerCase().trim() !== userLower) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory.value !== 'all') {
        if (selectedCategory.value === 'archive_other') {
          if (torrent.category !== 'archive' && torrent.category !== 'document' && torrent.category !== 'other') {
            return false;
          }
        } else if (torrent.category !== selectedCategory.value) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase().trim();
        const matchesName = torrent.name.toLowerCase().includes(query);
        const matchesFile = torrent.files.some((f) => f.name.toLowerCase().includes(query));
        const matchesAuthor = torrent.addedBy?.toLowerCase().includes(query);
        if (!matchesName && !matchesFile && !matchesAuthor) {
          return false;
        }
      }

      return true;
    });

    // Pinned torrents stay on top, then sorted by sortBy
    return list.slice().sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      switch (sortBy.value) {
        case 'size':
          return (b.length || 0) - (a.length || 0);
        case 'progress':
          return (b.downloadedPercentage || 0) - (a.downloadedPercentage || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'recent':
        default:
          return (b.addedAt || 0) - (a.addedAt || 0);
      }
    });
  });

  const categoryCounts = computed(() => {
    const counts = {
      all: torrents.value.length,
      video: 0,
      game_app: 0,
      audio: 0,
      archive_other: 0
    };

    torrents.value.forEach((t) => {
      if (t.category === 'video') counts.video++;
      else if (t.category === 'game_app') counts.game_app++;
      else if (t.category === 'audio') counts.audio++;
      else counts.archive_other++;
    });

    return counts;
  });

  const updateDocumentTitle = () => {
    if (typeof document === 'undefined') return;
    const totalSpeed = systemStatus.value?.totalDownSpeed || 0;
    if (totalSpeed > 1024) {
      document.title = `[⬇ ${formatSpeed(totalSpeed)}] Peerflix`;
    } else {
      document.title = 'Peerflix';
    }
  };

  const showNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/assets/logo.svg' });
      }
    }
  };

  let socketErrors = 0;
  let fallbackPollTimer: any = null;

  const startFallbackPolling = () => {
    if (fallbackPollTimer) return;
    fallbackPollTimer = setInterval(async () => {
      try {
        await loadTorrents();
        const status = await api.fetchSystemStatus();
        systemStatus.value = status;
      } catch {}
    }, 4000);
  };

  const initSocket = () => {
    if (typeof window === 'undefined') return;

    const creds = getSavedAuthCredentials();
    const extraHeaders: Record<string, string> = {};
    if (creds && creds.includes(':')) {
      try {
        extraHeaders['Authorization'] = 'Basic ' + btoa(creds);
      } catch {}
    }

    socket = ClientSocket({
      withCredentials: true,
      extraHeaders,
      auth: creds ? { token: creds } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 15000,
      timeout: 10000
    });

    socket.on('connect_error', () => {
      socketErrors++;
      // Si Safari / reverse proxy refuse la connexion (ex: 401 Unauthorized),
      // déconnecter immédiatement socket pour stopper net la popup en boucle sur iPhone !
      if (socketErrors >= 2) {
        try {
          socket?.disconnect();
        } catch {}
        startFallbackPolling();
      }
    });

    socket.on('connect', () => {
      socketErrors = 0;
      if (fallbackPollTimer) {
        clearInterval(fallbackPollTimer);
        fallbackPollTimer = null;
      }
    });

    socket.on('stats', (infoHash: string, stats: any) => {
      const torrent = torrents.value.find((t) => t.infoHash === infoHash);
      if (torrent && stats) {
        // Monotonic guard: ignore out-of-order packets with smaller seq or smaller downloaded bytes
        if (
          typeof stats.seq === 'number' &&
          typeof torrent.stats.seq === 'number' &&
          stats.seq < torrent.stats.seq
        ) {
          return;
        }

        if (
          typeof stats.downloaded === 'number' &&
          typeof torrent.stats.downloaded === 'number' &&
          stats.downloaded < torrent.stats.downloaded
        ) {
          return;
        }

        torrent.stats = stats;
        if (typeof stats.paused === 'boolean') {
          torrent.paused = stats.paused;
        }

        torrent.downloadedPercentage = Math.min(100, Math.round(stats.progress * 1000) / 10);
        if (stats.progress >= 0.9999) {
          if (!torrent.isFullyDownloaded) {
            torrent.isFullyDownloaded = true;
            showNotification('Téléchargement terminé', `${torrent.name} est 100% prêt sur le serveur.`);
          }
        }
      }
    });

    socket.on('verifying', (infoHash: string, stats: any) => {
      const torrent = torrents.value.find((t) => t.infoHash === infoHash);
      if (torrent) {
        torrent.stats = stats;
      }
    });

    socket.on('ready', (infoHash: string, fullDto: TorrentDTO) => {
      const index = torrents.value.findIndex((t) => t.infoHash === infoHash);
      if (index !== -1) {
        torrents.value[index] = fullDto;
      } else {
        torrents.value.push(fullDto);
      }
    });

    socket.on('systemStats', (status: SystemStatusDTO) => {
      systemStatus.value = {
        ...status,
        authenticatedOrigin: systemStatus.value?.authenticatedOrigin || status.authenticatedOrigin
      };
      updateDocumentTitle();
    });

    socket.on('pinned', (data: { infoHash: string; pinned: boolean }) => {
      const torrent = torrents.value.find((t) => t.infoHash === data.infoHash);
      if (torrent) {
        torrent.pinned = data.pinned;
      }
    });

    socket.on('finished', (infoHash: string) => {
      const torrent = torrents.value.find((t) => t.infoHash === infoHash);
      if (torrent) {
        torrent.isFullyDownloaded = true;
        torrent.downloadedPercentage = 100;
        showNotification('100% Prêt sur le serveur', `${torrent.name} est disponible à vitesse max.`);
      }
    });

    socket.on('destroyed', (infoHash: string) => {
      torrents.value = torrents.value.filter((t) => t.infoHash !== infoHash);
    });

    socket.on('clean', () => {
      loadTorrents();
    });

    socket.on('diskError', (data: { infoHash: string; message: string }) => {
      errorMessage.value = data.message;
    });
  };

  const loadTorrents = async () => {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const [torrentList, sysStatus] = await Promise.all([
        api.fetchTorrents(),
        api.fetchSystemStatus().catch(() => null)
      ]);
      torrents.value = torrentList;
      if (sysStatus) {
        systemStatus.value = {
          ...sysStatus,
          authenticatedOrigin: sysStatus.authenticatedOrigin || systemStatus.value?.authenticatedOrigin
        };
        if (systemStatus.value.authenticatedOrigin) {
          getExternalBaseUrl(systemStatus.value);
        }
      }
    } catch (err: any) {
      errorMessage.value = err.message || 'Impossible de contacter le serveur';
    } finally {
      isLoading.value = false;
    }
  };

  const addTorrentByLink = async (link: string, options?: { isPrivate?: boolean }) => {
    errorMessage.value = null;
    const res = await api.addTorrent(link, {
      isPrivate: options?.isPrivate,
      addedBy: currentUser.value
    });
    await loadTorrents();
    return res.infoHash;
  };

  const uploadFiles = async (files: FileList | File[], options?: { isPrivate?: boolean }) => {
    errorMessage.value = null;
    const res = await api.uploadTorrents(files, {
      isPrivate: options?.isPrivate,
      addedBy: currentUser.value
    });
    await loadTorrents();
    return res;
  };

  const toggleVisibility = async (infoHash: string, isPrivate: boolean) => {
    const res = await api.toggleTorrentVisibility(infoHash, isPrivate);
    const t = torrents.value.find((item) => item.infoHash === infoHash);
    if (t) {
      t.isPrivate = res.isPrivate;
    }
    return res.isPrivate;
  };

  const togglePin = async (infoHash: string) => {
    const res = await api.togglePin(infoHash);
    const t = torrents.value.find((item) => item.infoHash === infoHash);
    if (t) {
      t.pinned = res.pinned;
    }
    return res.pinned;
  };

  const deleteTorrent = async (infoHash: string) => {
    await api.deleteTorrent(infoHash);
    torrents.value = torrents.value.filter((t) => t.infoHash !== infoHash);
  };

  const pauseTorrent = (infoHash: string) => {
    socket?.emit('pause', infoHash);
  };

  const resumeTorrent = (infoHash: string) => {
    socket?.emit('resume', infoHash);
  };

  const selectFile = (infoHash: string, fileIndex: number) => {
    socket?.emit('select', infoHash, fileIndex);
    const t = torrents.value.find((item) => item.infoHash === infoHash);
    if (t && t.files[fileIndex]) {
      t.files[fileIndex].selected = true;
    }
  };

  const deselectFile = (infoHash: string, fileIndex: number) => {
    socket?.emit('deselect', infoHash, fileIndex);
    const t = torrents.value.find((item) => item.infoHash === infoHash);
    if (t && t.files[fileIndex]) {
      t.files[fileIndex].selected = false;
    }
  };

  const selectAllFiles = (infoHash: string) => {
    socket?.emit('select', infoHash);
    const t = torrents.value.find((item) => item.infoHash === infoHash);
    if (t && t.files) {
      t.files.forEach((f) => {
        f.selected = true;
      });
    }
  };

  const deselectAllFiles = (infoHash: string) => {
    socket?.emit('deselect', infoHash);
    const t = torrents.value.find((item) => item.infoHash === infoHash);
    if (t && t.files) {
      t.files.forEach((f) => {
        f.selected = false;
      });
    }
  };

  const cleanUnpinned = async () => {
    isLoading.value = true;
    try {
      await api.cleanUnpinned();
      await loadTorrents();
    } catch (err: any) {
      errorMessage.value = err.message || 'Échec du nettoyage';
    } finally {
      isLoading.value = false;
    }
  };

  return {
    torrents,
    systemStatus,
    searchQuery,
    selectedCategory,
    sortBy,
    onlyMyTorrents,
    currentUser,
    isAdmin,
    hideJunkFiles,
    isLoading,
    errorMessage,
    filteredTorrents,
    categoryCounts,
    loadTorrents,
    addTorrentByLink,
    uploadFiles,
    togglePin,
    toggleVisibility,
    updateCurrentUser,
    updateIsAdmin,
    deleteTorrent,
    pauseTorrent,
    resumeTorrent,
    selectFile,
    deselectFile,
    selectAllFiles,
    deselectAllFiles,
    cleanUnpinned,
    initSocket
  };
}
