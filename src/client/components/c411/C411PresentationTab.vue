<script setup lang="ts">
import { computed } from 'vue';
import type { C411TorrentDetailsDTO } from '../../../shared/types.js';

const props = defineProps<{
  details: C411TorrentDetailsDTO | null;
}>();

const hasRealDescription = computed(() => {
  if (!props.details?.descriptionHtml) return false;
  const raw = props.details.descriptionHtml;
  if (raw.includes('Aucune description disponible') || raw.includes('Aucune description détaillée')) {
    return false;
  }
  const clean = raw.replace(/<[^>]+>/g, '').trim();
  return clean.length > 25;
});
</script>

<template>
  <div class="tab-pane-presentation">
    <!-- TMDB / Media Overview Box if available -->
    <div v-if="details?.overview" class="c411-overview-card">
      <div class="overview-header">
        <span v-if="details.rating" class="overview-rating font-mono">
          ⭐ {{ details.rating.toFixed(1) }} / 10
        </span>
        <div v-if="details.genres && details.genres.length > 0" class="overview-genres">
          <span v-for="genre in details.genres" :key="genre" class="genre-pill">
            {{ genre }}
          </span>
        </div>
      </div>
      <p class="overview-text">{{ details.overview }}</p>
      <div v-if="details.directors && details.directors.length > 0" class="overview-credits">
        <strong>Réalisation :</strong> {{ details.directors.join(', ') }}
      </div>
      <div v-if="details.cast && details.cast.length > 0" class="overview-credits">
        <strong>Distribution :</strong>
        {{ details.cast.map(c => c.name + (c.character ? ` (${c.character})` : '')).join(', ') }}
      </div>
    </div>

    <!-- Rich Description faithful to C411 -->
    <div
      v-if="hasRealDescription"
      class="c411-rich-description"
      v-html="details?.descriptionHtml"
    ></div>
    <div v-else class="empty-description-box">
      <div class="empty-c411-badge">Tracker C411</div>
      <h3 class="empty-c411-title">Présentation & Fiche complète</h3>
      <p class="empty-c411-desc">
        Consultez les informations complètes, captures d'écran et détails techniques sur C411 :
      </p>
      <a
        v-if="details?.c411PageUrl"
        :href="details.c411PageUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-c411-cta"
      >
        🔗 Ouvrir la présentation & les images sur C411 ↗
      </a>
    </div>
  </div>
</template>

<style scoped>
.tab-pane-presentation {
  width: 100%;
}

.c411-overview-card {
  background: #141e33;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.overview-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.overview-rating {
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.3);
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.85rem;
}

.overview-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.genre-pill {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  font-size: 0.75rem;
  padding: 2px 7px;
  border-radius: 4px;
}

.overview-text {
  font-size: 0.92rem;
  line-height: 1.6;
  color: #cbd5e1;
  margin-bottom: 0.75rem;
}

.overview-credits {
  font-size: 0.82rem;
  color: #94a3b8;
  margin-top: 0.35rem;
}

.overview-credits strong {
  color: #e2e8f0;
}

/* Rich Description styling faithful to C411 */
.c411-rich-description {
  color: #cbd5e1;
  font-size: 0.9rem;
  line-height: 1.6;
}

:deep(.c411-rich-description img) {
  max-width: 100% !important;
  height: auto !important;
  border-radius: 8px;
  margin: 10px auto;
  display: block;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
}

:deep(.c411-rich-description pre),
:deep(.c411-code) {
  background: #090d16;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.85rem;
  border-radius: 6px;
  color: #10b981;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  overflow-x: auto;
  margin: 10px 0;
}

:deep(.c411-rich-description blockquote),
:deep(.c411-quote) {
  border-left: 3px solid #38bdf8;
  background: rgba(56, 189, 248, 0.08);
  padding: 0.6rem 1rem;
  margin: 10px 0;
  border-radius: 0 6px 6px 0;
  color: #e2e8f0;
}

:deep(.c411-rich-description a) {
  color: #38bdf8;
  text-decoration: underline;
}

.empty-description-box {
  background: #141e33;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 2.5rem 1.5rem;
  text-align: center;
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-c411-badge {
  display: inline-block;
  background: #2563eb;
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 9999px;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}

.empty-c411-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 0.5rem 0;
}

.empty-c411-desc {
  font-size: 0.88rem;
  color: #94a3b8;
  max-width: 500px;
  line-height: 1.5;
  margin: 0 0 1.25rem 0;
}

.btn-c411-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #0284c7, #0369a1);
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 9px 18px;
  border-radius: 8px;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
  transition: all 0.2s ease;
}

.btn-c411-cta:hover {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.45);
}
</style>
