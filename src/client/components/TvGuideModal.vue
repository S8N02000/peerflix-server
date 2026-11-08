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

const activeTab = ref<'kodi' | 'vlc' | 'android' | 'apple' | 'plex'>('kodi');
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
          :class="{ active: activeTab === 'kodi' }"
          @click="activeTab = 'kodi'"
        >
          🏆 Kodi (Recommandé #1)
        </button>
        <button
          type="button"
          class="tv-tab-btn"
          :class="{ active: activeTab === 'vlc' }"
          @click="activeTab = 'vlc'"
        >
          🟠 VLC (PC / Mac / Mobile / TV)
        </button>
        <button
          type="button"
          class="tv-tab-btn"
          :class="{ active: activeTab === 'android' }"
          @click="activeTab = 'android'"
        >
          🤖 Android TV (TiviMate)
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
          :class="{ active: activeTab === 'plex' }"
          @click="activeTab = 'plex'"
        >
          🎬 Plex (Via Threadfin)
        </button>
      </div>

      <!-- Body / Guide Content -->
      <div class="tv-body">
        <!-- TAB 1: KODI (RECOMMANDATION N°1) -->
        <div v-show="activeTab === 'kodi'" class="guide-pane">
          <div class="guide-hero">
            <div class="guide-tag">Recommandation N°1 • Media-Center Ultime</div>
            <h3>Kodi avec PVR IPTV Simple Client (Guide complet de A à Z)</h3>
            <p>
              Kodi est le lecteur multimédia de référence le plus puissant et le plus stable. Grâce à l'extension officielle <strong>PVR IPTV Simple Client</strong> configurée avec <strong>actualisation répétée toutes les minutes</strong>, tout nouveau film ou épisode ajouté sur Peerflix apparaît sur votre TV en 60 secondes en arrière-plan sans redémarrer !
            </p>
          </div>

          <ol class="steps-list">
            <li>
              <strong>1. Télécharger & Installer Kodi</strong>
              <div class="step-desc">
                Kodi est 100% gratuit et sans publicité. Installez-le sur votre appareil :
                <br />• <strong>Android TV / Google TV / Shield TV</strong> : Depuis le <em>Google Play Store</em>.
                <br />• <strong>Amazon Fire TV Stick</strong> : Via l'application <em>Downloader</em> ou sideload de l'APK officiel kodi.tv.
                <br />• <strong>PC / Linux / Mac</strong> : Téléchargeable sur <em>kodi.tv</em> (ou <code>sudo apt install kodi</code> sur Ubuntu/Pop!_OS/Debian).
              </div>
            </li>

            <li>
              <strong>2. Installer l'extension « PVR IPTV Simple Client »</strong>
              <div class="step-desc">
                Depuis l'écran d'accueil de Kodi :
                <br />• Cliquez sur la roue crantée <strong>Paramètres</strong> ⚙️ (en haut à gauche), puis sur <strong>Extensions (Add-ons)</strong>.
                <br />• Cliquez sur <strong>Installer d'un dépôt (Install from repository)</strong> → <strong>Kodi Add-on repository</strong>.
                <br />• Ouvrez la catégorie <strong>Clients PVR (PVR clients)</strong>.
                <br />• Cliquez sur <strong>PVR IPTV Simple Client</strong> puis sur le bouton <strong>Installer (Install)</strong> en bas à droite (validez l'installation des dépendances).
                <br /><em>(Sur certaines versions, l'extension est préinstallée dans « Mes extensions → Clients PVR » : vérifiez simplement qu'elle est bien activée).</em>
              </div>
            </li>

            <li>
              <strong>3. Configurer l'URL de la Playlist Peerflix</strong>
              <div class="step-desc">
                • Sur <strong>PVR IPTV Simple Client</strong>, faites un clic droit (souris) ou un <strong>appui long</strong> (télécommande TV) pour ouvrir le menu contextuel, puis cliquez sur <strong>Configurer (Configure)</strong>.
                <br />• Dans l'onglet <strong>Général (General)</strong> :
                <br />&nbsp;&nbsp;- <em>Emplacement (Location)</em> : Choisissez <strong>URL distante (Internet)</strong>.
                <br />&nbsp;&nbsp;- <em>URL de la liste de lecture M3U</em> : Collez votre lien M3U ci-dessus (copié en 1 clic grâce au bouton Copier).
              </div>
            </li>

            <li>
              <strong>4. ⚡ Crucial : Activer l'actualisation automatique toutes les 1 minute</strong>
              <div class="step-desc">
                Toujours dans l'onglet <strong>Général (General)</strong> de la configuration de l'add-on :
                <br />• Définissez <strong>Mode d'actualisation automatique (Auto refresh mode)</strong> sur <strong>Actualisation répétée (Repeated refresh)</strong>.
                <br />• Définissez <strong>Intervalle d'actualisation (Refresh interval)</strong> sur <strong>1</strong> (minute).
                <br />👉 <em>Kodi interrogera ainsi le serveur Peerflix toutes les 60 secondes en tâche de fond : chaque torrent ou épisode complété est synchronisé instantanément !</em>
              </div>
            </li>

            <li>
              <strong>5. Valider et Découvrir vos Médias</strong>
              <div class="step-desc">
                • Cliquez sur le bouton <strong>OK</strong> pour enregistrer la configuration et activez l'extension si Kodi vous le demande.
                <br />• Revenez sur l'écran d'accueil de Kodi et cliquez sur la tuile <strong>TV</strong> (ou Direct / Vidéos).
                <br />• Tous vos films et séries s'affichent ordonnés par groupes hiérarchiques (<code>Films</code>, <code>Série - Nom - S01</code>, <code>Musique</code>...) avec reprise de lecture, choix des pistes audio et sous-titres français intégrés.
              </div>
            </li>
          </ol>

          <div class="guide-alt-box">
            💡 <strong>Astuce mise à jour immédiate :</strong> Pour forcer le rechargement immédiat sans attendre la prochaine minute : <em>Paramètres ⚙️ → PVR et Direct → Général → Vider les données (Clear data)</em>.
          </div>
        </div>

        <!-- TAB 2: VLC & LECTEURS RÉSEAU -->
        <div v-show="activeTab === 'vlc'" class="guide-pane">
          <div class="guide-hero">
            <div class="guide-tag">Simple, Universel & Gratuit</div>
            <h3>VLC Media Player (PC, Mac, Linux, Android, iOS, TV)</h3>
            <p>
              VLC est le lecteur le plus tout-terrain. Il décode nativement tous les formats vidéo et audio (MKV, AV1, HEVC 10-bit, DTS, TrueHD) avec sous-titres automatiques et zéro configuration compliquée.
            </p>
          </div>

          <ol class="steps-list">
            <li>
              <strong>1. Sur Ordinateur (Windows, Mac, Linux)</strong>
              <div class="step-desc">
                • Ouvrez VLC, puis appuyez sur <strong>Ctrl+N</strong> (ou Cmd+N sur Mac) / menu <em>Média → Ouvrir un flux réseau</em>.
                <br />• Collez l'URL de votre playlist M3U ci-dessus et cliquez sur <strong>Lire</strong>.
                <br />• Appuyez sur <strong>Ctrl+L</strong> (ou Cmd+L) pour afficher la liste de lecture : tous vos dossiers Films et Séries sont rangés hiérarchiquement.
              </div>
            </li>

            <li>
              <strong>2. Sur Smartphone ou Tablette (Android / iPhone / iPad)</strong>
              <div class="step-desc">
                • Installez l'application officielle <strong>VLC</strong> (Google Play Store ou App Store).
                <br />• Rendez-vous dans l'onglet <strong>Plus</strong> (ou Réseau) → <strong>Nouveau flux réseau</strong>.
                <br />• Collez le lien M3U et lancez : vos médias se synchronisent immédiatement.
              </div>
            </li>

            <li>
              <strong>3. Sur Smart TV ou Box Android TV</strong>
              <div class="step-desc">
                • Téléchargez <strong>VLC pour Android TV</strong> depuis le Play Store de votre télévision.
                <br />• Ouvrez l'application, descendez sur <strong>Flux réseau</strong> et collez le lien M3U.
              </div>
            </li>
          </ol>

          <div class="guide-alt-box">
            ⚡ <strong>Sous-titres & Pistes Audio :</strong> VLC sélectionne automatiquement les pistes audio en français et les pistes de sous-titres intégrées à vos vidéos Peerflix.
          </div>
        </div>

        <!-- TAB 3: ANDROID TV / GOOGLE TV -->
        <div v-show="activeTab === 'android'" class="guide-pane">
          <div class="guide-hero">
            <div class="guide-tag">Alternative IPTV Box TV</div>
            <h3>TiviMate & Applications IPTV (Android TV / Fire TV)</h3>
            <p>
              Si vous préférez une interface de style décodeur TV traditionnel, TiviMate et IPTV Smarters prennent en charge la playlist M3U avec affichage des jaquettes.
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
              <strong>3. Coller le lien M3U ci-dessus</strong> (utilisez l'application <em>Android TV Remote</em> sur smartphone pour coller l'URL directement sans taper à la télécommande).
            </li>
            <li>
              <strong>4. Actualisation</strong> : Configurez la mise à jour automatique de la playlist au démarrage de l'application dans les réglages de TiviMate.
            </li>
          </ol>

          <div class="guide-alt-box">
            <strong>Alternative gratuite :</strong> <em>IPTV Smarters Pro</em> ou <em>VLC pour Android TV</em>.
          </div>
        </div>

        <!-- TAB 4: APPLE TV (tvOS) -->
        <div v-show="activeTab === 'apple'" class="guide-pane">
          <div class="guide-hero">
            <div class="guide-tag">Recommandation n°1 sur Apple TV</div>
            <h3>IPTVX & VLC (tvOS)</h3>
            <p>
              IPTVX transforme votre playlist Peerflix en une véritable application de streaming moderne avec affiches haute définition, résumés et synchronisation iCloud.
            </p>
          </div>

          <ol class="steps-list">
            <li>
              <strong>1. Télécharger IPTVX (ou VLC)</strong> depuis l'App Store de votre Apple TV.
            </li>
            <li>
              <strong>2. Ajouter une source</strong> : Choisissez <em>M3U Playlist</em>.
            </li>
            <li>
              <strong>3. Renseigner l'URL M3U</strong> ci-dessus via AirPlay ou la télécommande iPhone.
            </li>
            <li>
              <strong>4. Rendu cinématique</strong> : Vos films et séries sont automatiquement indexés par groupes avec décodage matériel fluide en 4K HDR.
            </li>
          </ol>

          <div class="guide-alt-box">
            <strong>Alternative 100% gratuite :</strong> <em>VLC pour Apple TV</em> (sélectionnez l'onglet <em>Flux réseau</em> pour lancer la lecture).
          </div>
        </div>

        <!-- TAB 5: PLEX -->
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

.step-desc {
  margin: 0.25rem 0 0;
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.5;
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
  .tv-modal-overlay {
    padding: 0.5rem;
  }
  .tv-modal-window {
    max-height: 96vh;
    border-radius: 12px;
  }
  .tv-modal-header {
    padding: 0.75rem 1rem;
  }
  .tv-title {
    font-size: 1.05rem;
  }
  .tv-subtitle {
    font-size: 0.75rem;
    line-height: 1.3;
  }
  .tv-url-banner {
    padding: 0.75rem 1rem;
  }
  .url-info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }
  .url-field-box {
    flex-direction: column;
    gap: 0.5rem;
  }
  .url-input {
    width: 100%;
    min-width: 0;
    font-size: 0.75rem;
    padding: 0.5rem;
  }
  .btn-copy {
    width: 100%;
    padding: 0.6rem;
    justify-content: center;
  }
  .tv-tabs {
    padding: 0 0.5rem;
  }
  .tv-tab-btn {
    padding: 0.65rem 0.75rem;
    font-size: 0.78rem;
  }
  .tv-body {
    padding: 1rem;
  }
  .auth-solution-grid {
    grid-template-columns: 1fr;
  }
  .tv-modal-footer {
    padding: 0.75rem 1rem;
    flex-direction: column;
    align-items: stretch;
  }
  .btn-primary-close {
    width: 100%;
    text-align: center;
  }
}
</style>
