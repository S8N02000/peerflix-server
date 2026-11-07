<script setup lang="ts">
import type { TorrentDTO } from '../../../shared/types.js';
import { formatBytes, formatSpeed, formatDuration } from '../../composables/useTorrents.js';

defineProps<{
  torrent: TorrentDTO;
}>();
</script>

<template>
  <div class="progress-section">
    <div class="progress-bar-bg">
      <div
        class="progress-bar-fill"
        :class="{ complete: torrent.isFullyDownloaded }"
        :style="{ width: `${torrent.downloadedPercentage}%` }"
      ></div>
    </div>

    <div class="stats-row">
      <div class="stats-left">
        <span class="stat-percent font-mono">{{ torrent.downloadedPercentage }}%</span>
        <span class="stat-bytes">
          {{ formatBytes(torrent.stats.downloaded) }} / {{ formatBytes(torrent.length) }}
        </span>
      </div>

      <div class="stats-right">
        <span v-if="!torrent.isFullyDownloaded && torrent.stats.speed.down > 0" class="stat-speed font-mono">
          ⬇ {{ formatSpeed(torrent.stats.speed.down) }}
        </span>
        <span v-if="!torrent.isFullyDownloaded && torrent.stats.eta > 0" class="stat-eta">
          ⏱ {{ formatDuration(torrent.stats.eta) }}
        </span>
        <span class="stat-peers font-mono">
          👥 {{ torrent.stats.peers.unchoked }}/{{ torrent.stats.peers.total }} pairs
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-section {
  margin-bottom: 1rem;
}

.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: #0f172a;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width 0.3s ease;
}

.progress-bar-fill.complete {
  background: #10b981;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  color: #94a3b8;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.stat-percent {
  font-weight: 700;
  color: #f1f5f9;
  margin-right: 0.5rem;
}

.stats-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-speed {
  color: #34d399;
  font-weight: 600;
}
</style>
