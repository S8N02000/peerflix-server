<script setup lang="ts">
import { ref } from 'vue';
import type { C411TorrentDetailsDTO } from '../../../shared/types.js';

defineProps<{
  details: C411TorrentDetailsDTO | null;
}>();

const brokenAvatars = ref<Set<string>>(new Set());

const handleAvatarError = (author: string) => {
  brokenAvatars.value.add(author);
};
</script>

<template>
  <div class="tab-pane-comments">
    <div v-if="details && details.comments && details.comments.length > 0" class="comments-list">
      <div
        v-for="(comment, cIdx) in details.comments"
        :key="cIdx"
        class="comment-card"
      >
        <div class="comment-author-box">
          <img
            v-if="comment.avatarUrl && !brokenAvatars.has(comment.author)"
            :src="comment.avatarUrl.startsWith('http') ? comment.avatarUrl : `https://c411.org${comment.avatarUrl}`"
            :alt="comment.author"
            class="comment-avatar"
            loading="lazy"
            @error="handleAvatarError(comment.author)"
          />
          <div v-else class="comment-avatar-fallback">
            {{ comment.author.charAt(0).toUpperCase() }}
          </div>
          <div class="comment-meta">
            <span class="comment-author-name">{{ comment.author }}</span>
            <span v-if="comment.date" class="comment-date">
              {{ new Date(comment.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
            </span>
          </div>
          <span v-if="comment.likeCount" class="comment-likes" title="Mentions J'aime">
            ❤️ {{ comment.likeCount }}
          </span>
        </div>

        <div class="comment-text-box">
          {{ comment.content }}
        </div>
      </div>
    </div>

    <div v-else class="empty-comments-box">
      <span class="empty-comments-icon">💬</span>
      <p class="empty-comments-title">Commentaires & Retours de test</p>
      <p class="empty-comments-subtitle">
        Aucun commentaire publié pour le moment pour ce torrent.
      </p>
      <a
        v-if="details?.c411PageUrl"
        :href="details.c411PageUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-c411-cta"
      >
        🔗 Consulter sur C411 ↗
      </a>
    </div>
  </div>
</template>

<style scoped>
.tab-pane-comments {
  width: 100%;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comment-card {
  background: #141e33;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.comment-author-box {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.comment-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.comment-avatar-fallback {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #1e293b;
  color: #38bdf8;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.comment-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.comment-author-name {
  color: #f1f5f9;
  font-weight: 700;
  font-size: 0.88rem;
}

.comment-date {
  color: #64748b;
  font-size: 0.72rem;
}

.comment-likes {
  margin-left: auto;
  font-size: 0.75rem;
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.1);
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 600;
}

.comment-text-box {
  color: #cbd5e1;
  font-size: 0.88rem;
  line-height: 1.55;
  white-space: pre-line;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border-left: 2px solid rgba(56, 189, 248, 0.4);
}

.empty-comments-box {
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

.empty-comments-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.5rem;
}

.empty-comments-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 0.5rem 0;
}

.empty-comments-subtitle {
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
