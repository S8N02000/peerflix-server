<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { SystemStatusDTO } from '../../shared/types.js';
import { getExternalBaseUrl, getCurrentUser, getSavedAuthCredentials } from '../utils/auth-url.js';

const props = defineProps<{
  isOpen: boolean;
  systemStatus?: SystemStatusDTO | null;
  currentUser?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeTab = ref<'android' | 'apple' | 'kodi' | 'plex'>('android');
const copied = ref(false);

const userName = computed(() => props.currentUser || getCurrentUser());

const m3uUrl = computed(() => {
  const baseUrl = getExternalBaseUrl(props.systemStatus);
  const u = userName.value;
  const creds = getSavedAuthCredentials();

  let url = `${baseUrl}/playlist.m3u`;
  const params: string[] = [];

  if (u && u !== 'Moi') {
    params.push(`user=${encodeURIComponent(u)}`);
  }

  // If baseUrl does not contain @, but we have credentials, add auth param for compatibility
  if (!baseUrl.includes('@') && creds) {
    params.push(`auth=${encodeURIComponent(creds)}`);
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  return url;
});

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(m3uUrl.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2500);
  } catch {}
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div v-if="isOpen" class="tv-modal-overlay" @click.self="emit('close')">
    <div class="tv-modal-window">
      <!-- Header -->
      <div class="tv-modal-header">
        <div class="header-left">
          <span class="tv-icon">📺</span>
          <div>
            <h2 class="tv-title">Guide Télévision & Lecteurs M3U (2026)</h2>
            <p class="tv-subtitle">
              Diffusez instantanément vos films et séries téléchargés sur tous vos téléviseurs et box TV
            </p>
          </div>
        </div>
        <button type="button" class="btn-close" title="Fermer" @click="emit('close')">✕</button>
      </div>

      <!-- URL Copy Bar -->
      <div class="tv-url-banner">
        <div class="url-info-row">
          <span class="url-label">🔗 Votre lien M3U IPTV (personnalisé pour {{ userName }}) :</span>
          <span class="url-badge">Groupé par Films / Séries</span>
        </div>
        <div class="url-field-box">
          <input type="text" readonly :value="m3uUrl" class="url-input font-mono" />
          <button type="button" class="btn-copy" @click="copyUrl">
            {{ copied ? '✓ Copié !' : '📋 Copier' }}
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tv-tabs">
        <button
          type="button"
          class="tv-tab-btn"
          :class="{ active: activeTab === 'android' }"
          @click="activeTab = 'android'"
        >
          🤖 Android TV & Google TV
        </button>
        <button
          type="button"
          class="tv-tab-btn"
          :class="{ active: activeTab === 'apple' }"
          @click="activeTab = 'apple'"
        >
          🍏 Apple TV (tvOS)
        </button>
        <button
          type="button"
          class="tv-tab-btn"
          :class="{ active: activeTab === 'kodi' }"
          @click="activeTab = 'kodi'"
        >
          📦 Kodi (IPTV Simple)
        </button>
        <button
          type="button"
          class="tv-tab-btn"
          :class="{ active: activeTab === 'plex' }"
          @click="activeTab = 'plex'"
        >
          🎬 Plex (Via Threadfin)
        </button>
      </div>

      <!-- Body / Guide Content -->
      <div class="tv-body">
        <!-- TAB 1: ANDROID TV / GOOGLE TV -->
        <div v-show="activeTab === 'android'" class="guide-pane">
          <div class="guide-hero">
            <div class="guide-tag">Recommandation n°1 en 2026</div>
            <h3>TiviMate IPTV Player (Le roi absolu sur Android TV)</h3>
            <p>
              TiviMate offre une interface digne des meilleures box TV du marché, avec zapping instantané, reprise de lecture et rangement automatique de vos films et séries par catégories.
            </p>
          </div>

          <ol class="steps-list">
            <li>
              <strong>1. Installer TiviMate</strong> depuis le Google Play Store sur votre TV ou Box (Shield TV, Chromecast avec Google TV, Xiaomi Box, etc.).
            </li>
            <li>
              <strong>2. Ajouter une Playlist</strong> : Rendez-vous dans <em>Paramètres → Playlists → Ajouter une playlist → Playlist M3U</em>.
            </li>
            <li>
              <strong>3. Coller le lien M3U ci-dessus</strong> (ou utilisez l'application <em>Android TV Remote</em> sur smartphone pour coller l'URL directement sans taper à la télécommande).
            </li>
            <li>
              <strong>4. Profitez !</strong> Vos fichiers sont automatiquement classés dans les dossiers <strong>Films</strong>, <strong>Séries TV</strong> et <strong>Musique</strong>.
            </li>
          </ol>

          <div class="guide-alt-box">
            <strong>Alternative gratuite :</strong> <em>IPTV Smarters Pro</em> ou <em>VLC pour Android TV</em> (dans VLC TV, allez dans <em>Flux Réseau</em> et collez l'URL).
          </div>
        </div>

        <!-- TAB 2: APPLE TV (tvOS) -->
        <div v-show="activeTab === 'apple'" class="guide-pane">
          <div class="guide-hero">
            <div class="guide-tag">Recommandation n°1 sur Apple TV</div>
            <h3>IPTVX (L'expérience Netflix sur tvOS)</h3>
            <p>
              IPTVX transforme votre playlist Peerflix en une véritable application de streaming moderne avec affiches haute définition, résumés et synchronisation iCloud.
            </p>
          </div>

          <ol class="steps-list">
            <li>
              <strong>1. Télécharger IPTVX</strong> depuis l'App Store de votre Apple TV.
            </li>
            <li>
              <strong>2. Ajouter une source</strong> : Choisissez <em>M3U Playlist</em>.
            </li>
            <li>
              <strong>3. Renseigner l'URL M3U</strong> ci-dessus via AirPlay ou la télécommande iPhone.
            </li>
            <li>
              <strong>4. Rendu cinématique</strong> : IPTVX indexe automatiquement vos vidéos par groupe (Films, Séries) avec décodage matériel fluide en 4K HDR.
            </li>
          </ol>

          <div class="guide-alt-box">
            <strong>Alternative 100% gratuite :</strong> <em>VLC pour Apple TV</em> (sélectionnez l'onglet <em>Flux réseau</em> pour lancer la lecture).
          </div>
        </div>

        <!-- TAB 3: KODI -->
        <div v-show="activeTab === 'kodi'" class="guide-pane">
          <div class="guide-hero">
            <div class="guide-tag">Compatible PC / TV / Linux / Android</div>
            <h3>Kodi avec PVR IPTV Simple Client</h3>
            <p>
              Pour les amateurs de media-center complet, l'extension native IPTV Simple Client prend en charge la playlist avec rafraîchissement automatique à chaque nouveau téléchargement.
            </p>
          </div>

          <ol class="steps-list">
            <li>
              <strong>1. Activer l'add-on</strong> : Allez dans <em>Extensions → Mes extensions → Clients PVR → IPTV Simple Client</em> et activez-le.
            </li>
            <li>
              <strong>2. Configurer la playlist</strong> : Dans <em>Configuration → Emplacement → URL distante (Internet)</em>, collez le lien M3U ci-dessus.
            </li>
            <li>
              <strong>3. Fréquence de mise à jour</strong> : Définissez le rafraîchissement sur <em>15 minutes</em> pour que les nouveaux torrents complétés apparaissent automatiquement.
            </li>
            <li>
              <strong>4. Redémarrez Kodi</strong> et accédez au menu <em>TV</em>.
            </li>
          </ol>
        </div>

        <!-- TAB 4: PLEX -->
        <div v-show="activeTab === 'plex'" class="guide-pane">
          <div class="guide-hero">
            <div class="guide-tag">Intégration Serveur Plex Live TV</div>
            <h3>Plex via Threadfin / XTeVe</h3>
            <p>
              Plex ne lit pas nativement les fichiers M3U externes comme des vidéos locales, mais prend en charge les flux M3U via son tuner Live TV / DVR virtuel.
            </p>
          </div>

          <ol class="steps-list">
            <li>
              <strong>1. Déployer Threadfin (ou XTeVe)</strong> en conteneur Docker sur votre serveur.
            </li>
            <li>
              <strong>2. Ajouter la Playlist M3U</strong> dans Threadfin avec le lien M3U ci-dessus.
            </li>
            <li>
              <strong>3. Dans Plex</strong> : Allez dans <em>Réglages → Live TV & DVR → Configurer un tuner Plex</em> et entrez l'adresse IP locale de Threadfin (ex: <code>http://192.168.1.50:34400</code>).
            </li>
            <li>
              <strong>4. Résultat</strong> : Vos films et séries Peerflix apparaissent sous forme de chaînes de streaming direct dans l'interface Plex de toute votre famille.
            </li>
          </ol>
        </div>
      </div>

      <!-- Footer -->
      <div class="tv-modal-footer">
        <div class="footer-tip">
          💡 <strong>Astuce :</strong> Chaque nouveau téléchargement ajouté sur Peerflix apparaît automatiquement dans votre liste TV sans avoir besoin de réimporter le lien !
        </div>
        <button type="button" class="btn-primary-close" @click="emit('close')">
          Compris, fermer le guide
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tv-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 6, 14, 0.88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.tv-modal-window {
  background: #0f131f;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  width: 100%;
  max-width: 820px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
}

.tv-modal-header {
  padding: 1.25rem 1.5rem;
  background: #141a2a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tv-icon {
  font-size: 2.2rem;
}

.tv-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
}

.tv-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

.btn-close {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 8px;
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
}

.tv-url-banner {
  background: #111726;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.url-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.url-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e2e8f0;
}

.url-badge {
  font-size: 0.72rem;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.url-field-box {
  display: flex;
  gap: 0.5rem;
}

.url-input {
  flex: 1;
  background: #090d16;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 0.55rem 0.85rem;
  color: #38bdf8;
  font-size: 0.85rem;
  outline: none;
}

.btn-copy {
  background: #0284c7;
  color: white;
  border: none;
  padding: 0 1.25rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-copy:hover {
  background: #0ea5e9;
}

.tv-tabs {
  display: flex;
  background: #0d121f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: auto;
  padding: 0 1rem;
}

.tv-tab-btn {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #94a3b8;
  padding: 0.85rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.tv-tab-btn:hover {
  color: #f1f5f9;
}

.tv-tab-btn.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
}

.tv-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.guide-pane {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.guide-hero {
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.guide-tag {
  display: inline-block;
  background: #0284c7;
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.guide-hero h3 {
  margin: 0 0 0.4rem;
  color: #f8fafc;
  font-size: 1.15rem;
}

.guide-hero p {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.88rem;
  line-height: 1.45;
}

.steps-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  color: #e2e8f0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.steps-list strong {
  color: #38bdf8;
}

.guide-alt-box {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: #94a3b8;
}

.auth-solution-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.auth-card {
  background: #141a2a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 1rem;
}

.auth-card h4 {
  margin: 0 0 0.5rem;
  color: #38bdf8;
  font-size: 0.95rem;
}

.auth-card p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
  line-height: 1.45;
}

.code-box {
  background: #090d16;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  color: #34d399;
  font-size: 0.8rem;
  overflow-x: auto;
  margin-top: 0.5rem;
}

.tv-modal-footer {
  padding: 1rem 1.5rem;
  background: #141a2a;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.footer-tip {
  font-size: 0.82rem;
  color: #94a3b8;
}

.btn-primary-close {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-primary-close:hover {
  background: #059669;
}

@media (max-width: 640px) {
  .auth-solution-grid {
    grid-template-columns: 1fr;
  }
  .tv-modal-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
