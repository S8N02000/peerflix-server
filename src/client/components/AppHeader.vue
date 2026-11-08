<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SystemStatusDTO, C411ProfileDTO } from '../../shared/types.js';
import { formatBytes } from '../composables/useTorrents.js';
import { getExternalBaseUrl, getSavedAuthCredentials } from '../utils/auth-url.js';

const props = defineProps<{
  systemStatus: SystemStatusDTO | null;
  c411Profile?: C411ProfileDTO | null;
  currentUser?: string;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'clean-unpinned'): void;
  (e: 'open-c411'): void;
  (e: 'update:currentUser', val: string): void;
  (e: 'update:isAdmin', val: boolean, token?: string): void;
  (e: 'open-tv-guide'): void;
}>();

import { generateMemorablePseudo, saveCurrentUser, saveIsAdmin, saveAdminToken, saveAuthCredentials } from '../utils/auth-url.js';
import { verifyAdminPassword } from '../services/api.js';

const copied = ref(false);
const showUserModal = ref(false);
const newUserName = ref(props.currentUser || 'Moi');
const newIsAdmin = ref(Boolean(props.isAdmin));
const adminPasswordInput = ref('');
const adminError = ref('');
const isVerifyingAdmin = ref(false);
const httpAuthInput = ref(getSavedAuthCredentials());

const openUserModal = () => {
  newUserName.value = props.currentUser || 'Moi';
  newIsAdmin.value = Boolean(props.isAdmin);
  adminPasswordInput.value = '';
  adminError.value = '';
  httpAuthInput.value = getSavedAuthCredentials();
  showUserModal.value = true;
};

const handleRerollPseudo = () => {
  newUserName.value = generateMemorablePseudo();
};

const saveUserSettings = async () => {
  adminError.value = '';

  // If enabling admin mode and wasn't already verified
  if (newIsAdmin.value && (!props.isAdmin || adminPasswordInput.value.trim())) {
    isVerifyingAdmin.value = true;
    try {
      const res = await verifyAdminPassword(adminPasswordInput.value.trim());
      saveIsAdmin(true, res.token);
      emit('update:isAdmin', true, res.token);
    } catch (err: any) {
      adminError.value = err.message || 'Mot de passe administrateur incorrect';
      isVerifyingAdmin.value = false;
      return;
    } finally {
      isVerifyingAdmin.value = false;
    }
  } else if (!newIsAdmin.value) {
    saveIsAdmin(false);
    emit('update:isAdmin', false);
  }

  const cleanUser = newUserName.value.trim() || generateMemorablePseudo();
  saveCurrentUser(cleanUser);
  emit('update:currentUser', cleanUser);
  saveAuthCredentials(httpAuthInput.value.trim());
  showUserModal.value = false;
};

const handleCleanClick = () => {
  if (typeof window !== 'undefined') {
    if (window.confirm('Supprimer tous les torrents non épinglés 📌 pour libérer de l\'espace disque ?')) {
      emit('clean-unpinned');
    }
  }
};

const diskClass = computed(() => {
  const disk = props.systemStatus?.disk;
  if (!disk) return 'disk-normal';
  const percent = typeof disk.quotaPercent === 'number' ? disk.quotaPercent : disk.usedPercent ?? 0;
  if (percent >= 90) return 'disk-danger';
  if (percent >= 75) return 'disk-warning';
  return 'disk-normal';
});

const displayPercent = computed(() => {
  const disk = props.systemStatus?.disk;
  if (!disk) return 0;
  return typeof disk.quotaPercent === 'number' ? disk.quotaPercent : disk.usedPercent ?? 0;
});

const storageTooltip = computed(() => {
  const disk = props.systemStatus?.disk;
  if (!disk) return '';
  if (typeof disk.maxQuotaBytes === 'number' && disk.maxQuotaBytes > 0) {
    const allocated = formatBytes(disk.peerflixUsedBytes ?? 0);
    const downloaded = disk.peerflixDownloadedBytes !== undefined ? formatBytes(disk.peerflixDownloadedBytes) : null;
    const quota = formatBytes(disk.maxQuotaBytes);
    const freeHost = formatBytes(disk.freeBytes);
    return downloaded
      ? `Quota Peerflix : ${allocated} alloués / ${quota} (${downloaded} téléchargés sur disque) • ${freeHost} libres sur le serveur`
      : `Quota Peerflix : ${allocated} alloués / ${quota} • ${freeHost} libres sur le serveur`;
  }
  return `Espace total serveur : ${formatBytes(disk.usedBytes)} utilisés sur ${formatBytes(disk.totalBytes)} (${formatBytes(disk.freeBytes)} libres)`;
});

const formattedStorage = computed(() => {
  const disk = props.systemStatus?.disk;
  if (!disk) return 'Stockage : Inconnu';

  // If a quota is set for Peerflix, display Peerflix storage clearly
  if (typeof disk.maxQuotaBytes === 'number' && disk.maxQuotaBytes > 0) {
    const peerflixUsed = formatBytes(disk.peerflixUsedBytes ?? 0);
    const quota = formatBytes(disk.maxQuotaBytes);
    const freeHost = formatBytes(disk.freeBytes);
    const percent = disk.quotaPercent ?? 0;
    return `Peerflix : ${peerflixUsed} / ${quota} (${freeHost} libres) ${percent}%`;
  }

  const used = formatBytes(disk.usedBytes);
  const total = formatBytes(disk.totalBytes);
  const free = formatBytes(disk.freeBytes);
  return `Stockage : ${used} / ${total} (${free} libres) ${disk.usedPercent}%`;
});

const playlistDownloadUrl = computed(() => {
  const baseUrl = getExternalBaseUrl(props.systemStatus);
  const u = props.currentUser || 'Moi';
  const creds = getSavedAuthCredentials();
  let url = `${baseUrl}/playlist.m3u`;
  const params: string[] = [];
  if (u && u !== 'Moi') params.push(`user=${encodeURIComponent(u)}`);
  if (!baseUrl.includes('@') && creds) {
    params.push(`auth=${encodeURIComponent(creds)}`);
  }
  if (params.length > 0) url += `?${params.join('&')}`;
  return url;
});

const copyPlaylistUrl = async () => {
  if (typeof window === 'undefined') return;
  const baseUrl = getExternalBaseUrl(props.systemStatus);
  const u = props.currentUser || 'Moi';
  const creds = getSavedAuthCredentials();
  let fullUrl = `${baseUrl}/playlist.m3u`;
  const params: string[] = [];
  if (u && u !== 'Moi') params.push(`user=${encodeURIComponent(u)}`);
  if (!baseUrl.includes('@') && creds) {
    params.push(`auth=${encodeURIComponent(creds)}`);
  }
  if (params.length > 0) fullUrl += `?${params.join('&')}`;

  try {
    await navigator.clipboard.writeText(fullUrl);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    window.prompt('URL de la playlist TV :', fullUrl);
  }
};
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo-box">
        <img src="../assets/logo.svg" alt="Peerflix Logo" class="app-logo" />
      </div>
      <div class="title-box">
        <h1 class="app-title">Peerflix</h1>
      </div>
    </div>

    <div class="header-right">
      <!-- C411 User Profile Widget -->
      <div
        v-if="c411Profile?.enabled"
        class="c411-header-widget interactive"
        title="C411 Connecté - Cliquez pour ouvrir l'onglet Recherche"
        @click="emit('open-c411')"
      >
        <span class="c411-logo-badge">C411</span>
        <span v-if="c411Profile.uploadedBytes !== undefined" class="c411-stat upload">
          ↑ {{ formatBytes(c411Profile.uploadedBytes) }}
        </span>
        <span v-if="c411Profile.zenBalance !== undefined" class="c411-stat zen">
          {{ c411Profile.zenBalance }} Z
        </span>
        <span v-if="c411Profile.freeleechActive" class="c411-freeleech-badge">
          ⚡ Freeleech
        </span>
      </div>

      <!-- Disk Gauge -->
      <div
        v-if="systemStatus?.disk"
        class="disk-gauge-container"
        :class="diskClass"
        :title="storageTooltip"
      >
        <div class="disk-info">
          <span class="disk-text">{{ formattedStorage }}</span>
          <span class="disk-percent font-mono">{{ displayPercent }}%</span>
        </div>
        <div class="disk-progress-bar">
          <div
            class="disk-progress-fill"
            :style="{ width: `${displayPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- Manual / Auto Clean Trigger -->
      <button
        type="button"
        class="clean-badge btn-clean-manual"
        title="Cliquer pour supprimer immédiatement tous les torrents non épinglés (les 📌 sont protégés)"
        @click="handleCleanClick"
      >
        <span class="clean-icon">🧹</span>
        <span class="clean-text">Nettoyage auto : Lun. 09h00</span>
      </button>

      <!-- User Profile & Admin Switcher -->
      <button
        type="button"
        class="btn-user-profile"
        :class="{ 'is-admin': isAdmin }"
        title="Changer de pseudo, mode admin ou identifiants HTTP"
        @click="openUserModal"
      >
        <span class="user-pill-icon">{{ isAdmin ? '👑' : '👤' }}</span>
        <span class="user-pill-name">{{ currentUser || 'Moi' }}</span>
        <span v-if="isAdmin" class="user-pill-admin-tag">Admin</span>
      </button>

      <!-- TV Guide Button -->
      <button
        type="button"
        class="btn-tv-guide"
        title="Ouvrir le guide TV 2026 (Android TV, Apple TV, Kodi, Plex)"
        @click="emit('open-tv-guide')"
      >
        📺 Tuto TV
      </button>

      <!-- Playlist TV Button -->
      <div class="playlist-dropdown">
        <a :href="playlistDownloadUrl" download="peerflix.m3u" class="btn-playlist" title="Télécharger la playlist M3U pour Kodi/VLC">
          📺 Playlist TV (.m3u)
        </a>
        <button
          type="button"
          class="btn-copy-playlist"
          @click="copyPlaylistUrl"
          title="Copier le lien direct vers la playlist globale M3U"
        >
          {{ copied ? '✓ Copié !' : '📋 Copier lien' }}
        </button>
      </div>
    </div>

    <!-- User Profile & Settings Modal -->
    <div v-if="showUserModal" class="user-modal-overlay" @click.self="showUserModal = false">
      <div class="user-modal-card">
        <div class="user-modal-header">
          <h3>👤 Profil Utilisateur & Accès</h3>
          <button type="button" class="btn-close-modal" @click="showUserModal = false">✕</button>
        </div>
        <div class="user-modal-body">
          <div class="form-group">
            <label for="username-input">Votre Pseudo :</label>
            <div class="pseudo-input-wrapper">
              <input
                id="username-input"
                v-model="newUserName"
                type="text"
                class="form-input"
                placeholder="Votre pseudo..."
                maxlength="25"
              />
              <button
                type="button"
                class="btn-reroll"
                title="Générer un autre pseudo aléatoire sympa"
                @click="handleRerollPseudo"
              >
                🎲 Nouveau
              </button>
            </div>
            <span class="form-hint">
              Attribué automatiquement pour votre appareil. Modifiable librement ! Vos torrents privés restent masqués pour les autres.
            </span>
          </div>

          <div class="form-group admin-section">
            <label class="checkbox-label">
              <input
                v-model="newIsAdmin"
                type="checkbox"
                class="form-checkbox"
              />
              <span>👑 Mode Administrateur (Tout voir & tout gérer)</span>
            </label>
            <span class="form-hint">
              Permet de voir tous les torrents (y compris les torrents privés des autres) et forcer le nettoyage du disque.
            </span>

            <div v-if="newIsAdmin && !isAdmin" class="admin-password-box">
              <label for="admin-pass-input">Mot de passe Administrateur :</label>
              <input
                id="admin-pass-input"
                v-model="adminPasswordInput"
                type="password"
                class="form-input"
                placeholder="Mot de passe (ADMIN_PASSWORD)..."
                autocomplete="current-password"
                @keyup.enter="saveUserSettings"
              />
              <span v-if="adminError" class="admin-error-msg">⚠️ {{ adminError }}</span>
            </div>
          </div>

          <div class="form-group http-auth-box">
            <label for="http-auth-input">🔐 Identifiants HTTP (Reverse Proxy / Basic Auth Mobile) :</label>
            <input
              id="http-auth-input"
              v-model="httpAuthInput"
              type="text"
              class="form-input"
              placeholder="ex: login:motdepasse"
              autocomplete="off"
            />
            <span class="form-hint">
              Enregistre vos identifiants dans votre navigateur (iPhone/Android). Résout définitivement la popup de mot de passe qui s'affiche en boucle sur mobile !
            </span>
          </div>
        </div>
        <div class="user-modal-footer">
          <button type="button" class="btn-cancel" @click="showUserModal = false">Annuler</button>
          <button type="button" class="btn-save" :disabled="isVerifyingAdmin" @click="saveUserSettings">
            {{ isVerifyingAdmin ? 'Vérification...' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.5rem;
  background-color: #0c0c12;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: #f3f4f6;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-box {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-logo {
  width: 100%;
  height: 100%;
}

.app-title {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  background: linear-gradient(135deg, #f59e0b, #10b981);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.disk-gauge-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 260px;
  background: #1e293b;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.disk-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.disk-progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  overflow: hidden;
}

.disk-progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

/* Disk status classes */
.disk-normal .disk-progress-fill {
  background-color: #10b981;
}

.disk-warning .disk-progress-fill {
  background-color: #f59e0b;
}

.disk-danger {
  border-color: rgba(239, 68, 68, 0.5);
}
.disk-danger .disk-progress-fill {
  background-color: #ef4444;
}
.disk-danger .disk-percent {
  color: #ef4444;
  font-weight: 700;
}

.clean-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  background: rgba(59, 130, 246, 0.12);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.25);
  padding: 0.35rem 0.65rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clean-badge:hover {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.4);
}

.playlist-dropdown {
  display: flex;
  align-items: center;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  overflow: hidden;
}

.btn-playlist {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #e5e7eb;
  text-decoration: none;
  background: transparent;
  transition: background 0.15s;
}

.btn-playlist:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn-copy-playlist {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy-playlist:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f3f4f6;
}

.c411-header-widget {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 0.375rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  transition: all 0.15s ease;
}

.c411-header-widget.interactive {
  cursor: pointer;
}

.c411-header-widget.interactive:hover {
  background: rgba(16, 185, 129, 0.16);
  border-color: #10b981;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
  transform: translateY(-1px);
}

.c411-logo-badge {
  background: #10b981;
  color: #0b0f19;
  font-weight: 800;
  border-radius: 0.2rem;
  padding: 0.05rem 0.3rem;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}

.c411-stat.upload {
  color: #34d399;
  font-weight: 600;
}

.c411-stat.zen {
  color: #fbbf24;
  font-weight: 600;
}

.c411-freeleech-badge {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 0.2rem;
  padding: 0.05rem 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
}

.btn-user-profile {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 0.3rem 0.75rem;
  color: #f1f5f9;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-user-profile:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
}

.btn-user-profile.is-admin {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.35);
  color: #fbbf24;
}

.user-pill-admin-tag {
  background: #f59e0b;
  color: #000;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 8px;
  text-transform: uppercase;
  margin-left: 0.2rem;
}

.btn-tv-guide {
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-tv-guide:hover {
  background: rgba(56, 189, 248, 0.22);
  border-color: #38bdf8;
}

/* User Profile Modal Styles */
.user-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.user-modal-card {
  background: #111522;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
}

.user-modal-header {
  padding: 1rem 1.25rem;
  background: #151b2c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #f8fafc;
}

.btn-close-modal {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px;
}

.user-modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #cbd5e1;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.form-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #f59e0b;
  cursor: pointer;
}

.form-input {
  background: #090c14;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  padding: 0.5rem 0.75rem;
  color: #f1f5f9;
  font-size: 0.88rem;
  outline: none;
}

.form-input:focus {
  border-color: #38bdf8;
}

.form-hint {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.4;
}

.user-modal-footer {
  padding: 0.85rem 1.25rem;
  background: #151b2c;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
}

.btn-save {
  background: #0284c7;
  color: white;
  border: none;
  padding: 0.45rem 1.2rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-save:hover {
  background: #0ea5e9;
}

.pseudo-input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-reroll {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #f8fafc;
  padding: 0.45rem 0.75rem;
  border-radius: 7px;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-reroll:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: #38bdf8;
}

.admin-password-box {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.admin-password-box label {
  font-size: 0.8rem;
  color: #fca5a5;
  font-weight: 600;
}

.admin-error-msg {
  font-size: 0.78rem;
  color: #ef4444;
  font-weight: 600;
}

@media (max-width: 768px) {
  .app-header {
    padding: 0.5rem 0.75rem;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  .header-left {
    width: 100%;
    justify-content: flex-start;
  }
  .header-right {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
  }
  .c411-header-widget {
    grid-column: span 2;
    justify-content: center;
    width: 100%;
  }
  .disk-gauge-container {
    grid-column: span 2;
    min-width: 0;
    width: 100%;
    padding: 0.35rem 0.6rem;
  }
  .clean-badge {
    font-size: 0.75rem;
    padding: 0.4rem 0.5rem;
    justify-content: center;
    text-align: center;
  }
  .btn-user-profile {
    font-size: 0.75rem;
    padding: 0.4rem 0.5rem;
    justify-content: center;
  }
  .btn-tv-guide {
    font-size: 0.75rem;
    padding: 0.4rem 0.5rem;
    justify-content: center;
  }
  .btn-group-m3u {
    grid-column: span 2;
    display: flex;
    width: 100%;
  }
  .btn-m3u-global {
    flex: 1;
    justify-content: center;
    text-align: center;
  }
  .btn-m3u-copy {
    flex-shrink: 0;
  }
  .user-modal-card {
    max-width: 95vw;
    width: 100%;
  }
}
</style>
