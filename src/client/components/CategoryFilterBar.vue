<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  selectedCategory: string;
  searchQuery: string;
  hideJunkFiles: boolean;
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
  (e: 'update:hideJunkFiles', val: boolean): void;
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

    <!-- Search & Junk Toggle Controls -->
    <div class="controls-right">
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

      <label class="toggle-junk" title="Masque les liens .url, textes superflus et extraits vidéo sample">
        <input
          type="checkbox"
          :checked="hideJunkFiles"
          @change="emit('update:hideJunkFiles', ($event.target as HTMLInputElement).checked)"
        />
        <span>Masquer fichiers inutiles</span>
      </label>
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
  background: #1e293b;
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.45rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: #334155;
  color: #f1f5f9;
}

.tab-btn.active {
  background: #10b981;
  color: #ffffff;
  border-color: #10b981;
}

.badge {
  background: rgba(0, 0, 0, 0.25);
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  font-size: 0.75rem;
}

.controls-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
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
  padding: 0.4rem 0.5rem;
  width: 170px;
}

.search-input::placeholder {
  color: #64748b;
}

.toggle-junk {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}

.toggle-junk input {
  accent-color: #10b981;
  cursor: pointer;
}
</style>
