<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  selectedCategory: string;
  searchQuery: string;
  hideJunkFiles?: boolean;
  sortBy?: 'recent' | 'name' | 'size' | 'progress';
  counts: {
    all: number;
    video: number;
    game_app: number;
    audio: number;
    archive_other: number;
  };
}>();

const emit = defineEmits<{
  (e: 'update:selectedCategory', category: string): void;
  (e: 'update:searchQuery', query: string): void;
  (e: 'update:sortBy', val: 'recent' | 'name' | 'size' | 'progress'): void;
}>();

const searchInput = ref<HTMLInputElement | null>(null);

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === '/' && document.activeElement !== searchInput.value) {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    searchInput.value?.focus();
  }
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown);
  }
});
</script>

<template>
  <div class="filter-bar-container">
    <!-- Category Tabs -->
    <div class="category-tabs" role="tablist">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: selectedCategory === 'all' }"
        @click="emit('update:selectedCategory', 'all')"
      >
        Tous <span class="badge">{{ counts.all }}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{ active: selectedCategory === 'video' }"
        @click="emit('update:selectedCategory', 'video')"
      >
        🎬 Films & Séries <span class="badge">{{ counts.video }}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{ active: selectedCategory === 'game_app' }"
        @click="emit('update:selectedCategory', 'game_app')"
      >
        🎮 Jeux & Logiciels <span class="badge">{{ counts.game_app }}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{ active: selectedCategory === 'audio' }"
        @click="emit('update:selectedCategory', 'audio')"
      >
        🎵 Musique <span class="badge">{{ counts.audio }}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{ active: selectedCategory === 'archive_other' }"
        @click="emit('update:selectedCategory', 'archive_other')"
      >
        📦 Archives & Autres <span class="badge">{{ counts.archive_other }}</span>
      </button>
    </div>

    <!-- Search, Sort & Junk Toggle Controls -->
    <div class="controls-right">
      <!-- Sort Select -->
      <div class="sort-box" title="Trier les torrents">
        <span class="sort-icon">↕</span>
        <select
          id="sort-select"
          class="sort-select"
          :value="sortBy || 'recent'"
          @change="emit('update:sortBy', ($event.target as HTMLSelectElement).value as any)"
        >
          <option value="recent">Plus récents</option>
          <option value="name">Nom (A-Z)</option>
          <option value="size">Taille</option>
          <option value="progress">Progression</option>
        </select>
      </div>

      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          ref="searchInput"
          type="search"
          class="search-input"
          placeholder="Rechercher (raccourci '/')"
          :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  max-width: 1100px;
  margin: 0.5rem auto 1rem;
  padding: 0 1rem;
  flex-wrap: wrap;
}

.category-tabs {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: #14151f;
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.45rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: #1e1f2d;
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.15);
}

.tab-btn.active {
  background: linear-gradient(135deg, #f59e0b, #ea580c);
  color: #ffffff;
  font-weight: 600;
  border-color: #f59e0b;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);
}

.badge {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.controls-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sort-box {
  display: flex;
  align-items: center;
  background: #14151f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  padding: 0 0.5rem;
  gap: 0.25rem;
}

.sort-icon {
  font-size: 0.8rem;
  color: #94a3b8;
}

.sort-select {
  background: transparent;
  color: #e2e8f0;
  border: none;
  outline: none;
  font-size: 0.8125rem;
  padding: 0.45rem 0.25rem;
  cursor: pointer;
}

.sort-select option {
  background: #14151f;
  color: #f1f5f9;
}

.search-box {
  display: flex;
  align-items: center;
  background: #14151f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  padding: 0 0.6rem;
}

.search-icon {
  font-size: 0.75rem;
  opacity: 0.6;
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: #f3f4f6;
  font-size: 0.8125rem;
  padding: 0.45rem 0.5rem;
  width: 180px;
}

.search-input::placeholder {
  color: #64748b;
}
</style>
