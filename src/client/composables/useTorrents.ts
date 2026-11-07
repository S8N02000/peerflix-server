import { ref, computed, onMounted, onUnmounted } from 'vue';
import { io as ClientSocket, type Socket } from 'socket.io-client';
import type { TorrentDTO, SystemStatusDTO, TorrentCategory, FileCategory } from '../../shared/types.js';
import * as api from '../services/api.js';

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

export function useTorrents() {
  const torrents = ref<TorrentDTO[]>([]);
  const systemStatus = ref<SystemStatusDTO | null>(null);
  const searchQuery = ref<string>('');
  const selectedCategory = ref<string>('all');
  const hideJunkFiles = ref<boolean>(true);
  const isLoading = ref<boolean>(false);
  const errorMessage = ref<string | null>(null);

  let socket: Socket | null = null;

  const filteredTorrents = computed(() => {
    return torrents.value.filter((torrent) => {
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
        if (!matchesName && !matchesFile) {
          return false;
        }
      }

      return true;
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

  const initSocket = () => {
    if (typeof window === 'undefined') return;

    socket = ClientSocket({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socket.on('stats', (infoHash: string, stats: any) => {
      const torrent = torrents.value.find((t) => t.infoHash === infoHash);
      if (torrent) {
        torrent.stats = stats;
        torrent.downloadedPercentage = Math.round(stats.progress * 100);
        if (stats.progress >= 0.9999) {
          if (!torrent.isFullyDownloaded) {
            torrent.isFullyDownloaded = true;
            showNotification('Téléchargement terminé', `${torrent.name} est 100% prêt sur le serveur.`);
          }
        }
      }
    });

    socket.on('download', (infoHash: string, data: any) => {
      const torrent = torrents.value.find((t) => t.infoHash === infoHash);
      if (torrent && data) {
        if (typeof data.progress === 'number') {
          torrent.stats.progress = data.progress;
          torrent.downloadedPercentage = Math.round(data.progress * 100);
        }
        if (typeof data.downloaded === 'number') {
          torrent.stats.downloaded = data.downloaded;
        }
        if (data.speed) {
          torrent.stats.speed = data.speed;
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
      systemStatus.value = status;
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
        systemStatus.value = sysStatus;
      }
    } catch (err: any) {
      errorMessage.value = err.message || 'Impossible de contacter le serveur';
    } finally {
      isLoading.value = false;
    }
  };

  const addTorrentByLink = async (link: string) => {
    errorMessage.value = null;
    const res = await api.addTorrent(link);
    await loadTorrents();
    return res.infoHash;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    errorMessage.value = null;
    const res = await api.uploadTorrents(files);
    await loadTorrents();
    return res;
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

  return {
    torrents,
    systemStatus,
    searchQuery,
    selectedCategory,
    hideJunkFiles,
    isLoading,
    errorMessage,
    filteredTorrents,
    categoryCounts,
    loadTorrents,
    addTorrentByLink,
    uploadFiles,
    togglePin,
    deleteTorrent,
    pauseTorrent,
    resumeTorrent,
    selectFile,
    deselectFile,
    initSocket
  };
}
