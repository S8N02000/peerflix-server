# Peerflix Server (Next-Gen)

<div align="center">
  <img src="src/client/assets/logo.svg" alt="Peerflix Server Logo" height="180">
  <br>
  <h3>Serveur de Streaming Torrent Haute Performance, Web UI Moderne & Intégration Tracker Native</h3>

  [![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Vue.js](https://img.shields.io/badge/Vue.js-3.x%20Composition%20API-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
  [![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Docker](https://img.shields.io/badge/Docker-Multi--stage%20Slim-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
  [![Tests](https://img.shields.io/badge/Tests-135%2F135%20Passing-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
  [![FFmpeg](https://img.shields.io/badge/FFmpeg-Audio%20Remux%20Zero--GPU-007808?logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
</div>

---

## 🌟 Présentation

**Peerflix Server Next-Gen** est une refonte moderne et ultra-légère du streaming torrent web. Conçu pour fonctionner sur n'importe quelle machine (d'un Raspberry Pi ou d'un serveur domestique âgé de 15 ans sans carte graphique jusqu'à une seedbox dédiée 4K), il permet de **regarder des films et séries instantanément sans attendre la fin du téléchargement**, directement dans le navigateur ou sur votre lecteur externe préféré (VLC, MPV, smartphone, TV).

Cette nouvelle génération introduit une interface réactive par onglets en Vue 3, la gestion native des saisons TV complètes (avec enchaînement automatique des épisodes), le transcodage audio à la volée sans GPU, et l'intégration transparente du tracker privé **C411** pour rechercher et lancer des releases en 1 clic.

---

## ✨ Fonctionnalités Majeures

### ⚡ 1. Moteur de Streaming & Priorisation Bitfield
* **Streaming séquentiel HTTP 206 Range** : Démarre la lecture en quelques secondes dès que les premières pièces sont téléchargées.
* **Reprise immédiate post-reboot (*Zero 409 Conflict*)** : Si Docker redémarre pendant que `torrent-stream` vérifie les fichiers sur le disque, Peerflix bascule automatiquement sur les données locales disponibles pour garantir une lecture instantanée.
* **Scrubbing ultra-réactif** : Lors d'un saut dans la timeline (dans le lecteur ou via VLC), les pièces correspondant à la nouvelle position sont immédiatement requêtées avec une priorité maximale auprès des pairs.
* **Persistance continue** : Sauvegarde périodique et atomique de l'état des téléchargements (`store.json`) évitant toute corruption en cas de coupure inattendue.

### 🎧 2. Transcodage Audio Léger "Zero-GPU" (FFmpeg Audio Remux)
* **Compatibilité navigateur universelle** : Détecte via `ffprobe` les pistes audio non prises en charge par les navigateurs (DTS, DTS-HD MA, TrueHD, AC3 5.1, E-AC3/Dolby Digital Plus).
* **Copie vidéo directe (`-c:v copy`)** : La vidéo n'est **jamais ré-encodée**, le flux est encapsulé en Fragmented MP4 (`fmp4`) avec audio converti en AAC à la volée. Consommation CPU minimale (< 5%), idéal pour les serveurs sans GPU.
* **Multi-pistes audio à la volée** : Changez de piste audio en cours de lecture sans recharger la page.
* **Bascule Direct / Remux** : Basculez d'un clic entre le flux brut d'origine et le flux remuxé.

### 📺 3. Prise en Charge Complète des Séries TV & Saisons Complètes
* **Détection automatique de série** : Les torrents multi-épisodes sont identifiés et triés dans l'ordre naturel numérique (E01, E02, ... E12).
* **Bouton intelligent sur la carte** : Affiche directement `▶ Regarder (E01)` (ou reprend le dernier épisode en cours grâce à la mémorisation locale).
* **Menu déroulant d'accès rapide** : Lancez n'importe quel épisode en un clic sans déplier l'arborescence.
* **Lecteur optimisé pour le Binge-Watching** :
  - Boutons Épisode Précédent `⏮` et Suivant `⏭`.
  - Liste déroulante des épisodes avec compteur de progression (ex: `Épisode 1/13`).
  - **Enchaînement automatique** : La vidéo suivante démarre automatiquement à la fin de l'épisode en cours.
  - **Raccourcis clavier** : `[` / `p` (précédent), `]` / `n` (suivant), Espace (lecture/pause), `f` (plein écran), `m` (muet).

### 💬 4. Sous-Titres Automatiques & Protection Mémoire
* **Conversion SRT vers WebVTT à la volée** : Injection transparente des sous-titres dans le lecteur HTML5.
* **Sécurité Anti-OOM** : Protection contre les fuites mémoire avec rejet strict des fichiers sous-titres supérieurs à 10 Mo.

### 🔍 5. Intégration Tracker C411 (Recherche Native & 1-Clic)
* **Architecture 100 % Sécurisée** : La clé API (`C411_API_KEY`) réside exclusivement sur le backend serveur et n'est jamais exposée au navigateur.
* **Navigation par onglets sans rechargement (0 ms)** : Bascule instantanée entre *Mes Téléchargements* et *Recherche C411*.
* **Moteur d'analyse de releases** : Extraction automatique du titre propre, saison, épisode, résolution (4K, 1080p, 720p), langues (MULTI, VFF, VOSTFR), sources (WEB-DL, BluRay), HDR (DV, HDR10+), codecs (AV1, HEVC, x264) et teams.
* **Filtres multi-critères & Préréglages** :
  - Catégorie, Résolution, Langue, Sous-titres, Saison, Source, HDR, Codec, Freeleech.
  - Sauvegarde de filtres personnalisés en 1 clic.
* **Widget profil utilisateur** : Affiche votre avatar, ratio, volume upload/download, solde de points Zen et statut Freeleech.
* **Ajout instantané** : Lance le téléchargement et le streaming sans avoir à manipuler de fichier `.torrent` local.

### 📱 6. Multi-Écrans, VLC & Reverse Proxy
* **Génération de flux VLC (.m3u)** : Ouvrez le flux directement dans VLC, MPV ou IINA.
* **QR Code mobile instantané** : Scannez le QR code depuis votre smartphone ou tablette pour reprendre la lecture sur votre réseau local.
* **Compatibilité Picture-in-Picture (PiP) et Google Cast**.
* **Support HTTP Basic Auth** : Injection automatique des identifiants (`PUBLIC_AUTH_CREDENTIALS`) dans les URL M3U et QR codes lors d'un déploiement derrière Traefik, Nginx, Caddy ou NPM.

### 🛡️ 7. Surveillance Disque & Nettoyage Automatique
* **Moniteur d'espace disque en temps réel** : Analyse régulière de l'espace libre (`MIN_FREE_DISK_MB`) pour empêcher la saturation du disque système.
* **Quota disque configurable** : Définissez un quota maximum en Go (`MAX_DISK_QUOTA_GB`).
* **Purge automatique programmable** : Ordonnanceur hebdomadaire configurable pour supprimer les torrents expirés non épinglés.
* **Purge manuelle en 1 clic** : Bouton dans l'interface avec confirmation et rapport d'espace libéré.
* **Épinglage de torrents (Pin)** : Protège vos films et séries favoris contre toute suppression automatique.

---

## 🚀 Démarrage Rapide avec Docker Compose (Recommandé)

### 1. Structure des dossiers
Créez un dossier pour Peerflix Server :
```sh
mkdir -p peerflix-server/data/config peerflix-server/data/downloads
cd peerflix-server
```

### 2. Fichier `docker-compose.yml`
Téléchargez ou créez le fichier [`docker-compose.yml`](docker-compose.yml) :

```yaml
services:
  peerflix-server:
    image: peerflix-server:latest
    build:
      context: .
      dockerfile: Dockerfile
    container_name: peerflix-server
    restart: unless-stopped
    ports:
      - "9000:9000"
    environment:
      # Port interne du serveur (défaut: 9000)
      - PORT=9000

      # Chemins des données persistantes
      - PEERFLIX_CONFIG_PATH=/data/config
      - PEERFLIX_DOWNLOAD_PATH=/data/downloads

      # Seuil d'espace libre minimal en Mo avant blocage de sécurité (défaut: 2048 Mo = 2 Go)
      - MIN_FREE_DISK_MB=2048

      # Quota maximum alloué en Go aux téléchargements (optionnel)
      # - MAX_DISK_QUOTA_GB=200

      # Nettoyage automatique hebdomadaire des torrents non épinglés (défaut: actif le lundi à 09h00)
      - AUTO_CLEAN_ENABLED=true
      - AUTO_CLEAN_DAY=1
      - AUTO_CLEAN_HOUR=9
      - AUTO_CLEAN_MINUTE=0

      # Identifiants Basic Auth de secours pour flux VLC / QR codes (optionnel si reverse proxy actif)
      # - PUBLIC_AUTH_CREDENTIALS=admin:monmotdepasse

      # Intégration C411 (Recherche native & streaming 1-clic)
      # - C411_API_KEY=votre_cle_api_c411
      # - C411_BASE_URL=https://c411.org

      # Sécurité CORS & Fuseau horaire
      # - CORS_ORIGIN=https://peerflix.mon-domaine.com
      - TZ=Europe/Paris
      - NODE_ENV=production

    volumes:
      - ./data/config:/data/config
      - ./data/downloads:/data/downloads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/system/status"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

### 3. Lancement
```sh
docker compose up -d
```
Ouvrez ensuite votre navigateur sur **[http://localhost:9000](http://localhost:9000)**.

---

## ⚙️ Variables d'Environnement

| Variable | Description | Défaut | Exemple |
| :--- | :--- | :--- | :--- |
| `PORT` | Port d'écoute HTTP du serveur | `9000` | `9000` |
| `PEERFLIX_CONFIG_PATH` | Dossier des métadonnées (store, état, stats) | `/data/config` | `/data/config` |
| `PEERFLIX_DOWNLOAD_PATH` | Dossier de stockage des fichiers téléchargés | `/data/downloads` | `/data/downloads` |
| `MIN_FREE_DISK_MB` | Seuil d'espace disque hôte libre minimal en Mo avant blocage | `2048` | `4096` |
| `MAX_DISK_QUOTA_GB` | Quota maximum en Go pour l'ensemble des téléchargements | *Désactivé* | `250` |
| `AUTO_CLEAN_ENABLED` | Active/désactive la purge auto hebdomadaire | `true` | `true` ou `false` |
| `AUTO_CLEAN_DAY` | Jour de purge auto : `0` (Dim) à `6` (Sam) | `1` *(Lundi)* | `0` |
| `AUTO_CLEAN_HOUR` | Heure de la purge auto : `0` à `23` | `9` *(09h00)* | `4` |
| `AUTO_CLEAN_MINUTE` | Minute de la purge auto : `0` à `59` | `0` | `30` |
| `PUBLIC_AUTH_CREDENTIALS` | Identifiants Basic Auth injectés dans les liens M3U / QR code | *Non défini* | `admin:supersecret` |
| `C411_API_KEY` | Clé API C411 pour recherche et streaming en un clic | *Non défini* | `votre_passkey_c411` |
| `C411_BASE_URL` | URL de l'instance C411 | `https://c411.org` | `https://c411.org` |
| `CORS_ORIGIN` | Domaine autorisé pour les requêtes cross-origin et WebSocket | *Restreint* | `https://stream.domaine.fr` |
| `TZ` | Fuseau horaire du conteneur | `UTC` | `Europe/Paris` |
| `NODE_ENV` | Environnement d'exécution Node.js | `production` | `production` |

---

## 📡 Documentation de l'API REST & WebSocket

### 📥 Gestion des Torrents
* `GET /torrents` : Liste de tous les torrents avec progression, vitesse, fichiers et état de freeze.
* `POST /torrents` : Ajout d'un torrent via magnet link ou URL HTTP (`{"link": "magnet:?xt=..."}`).
* `POST /upload` : Upload direct d'un fichier `.torrent` (`multipart/form-data`).
* `GET /torrents/:infoHash` : Détail complet d'un torrent spécifique.
* `DELETE /torrents/:infoHash` : Suppression du torrent et libération de ses ressources.
* `POST /torrents/:infoHash/pause` : Suspension des connexions aux pairs (freeze).
* `POST /torrents/:infoHash/resume` : Reprise active des échanges avec le swarm.
* `POST /torrents/:infoHash/pin` : Bascule de l'épinglage (protection contre la purge automatique).

### 🎬 Streaming & Fichiers
* `GET /torrents/:infoHash/files/:fileParam` : Streaming direct du fichier (support complet des en-têtes `Range: bytes=X-Y`).
* `GET /torrents/:infoHash/probe/:fileParam` : Analyse multimédia via `ffprobe` (codecs vidéo/audio, pistes audio, sous-titres).
* `GET /torrents/:infoHash/remux/:fileParam?audioTrack=0` : Flux Fragmented MP4 (`fmp4`) avec audio transcodé en AAC à la volée.
* `GET /torrents/:infoHash/subtitles/:fileParam` : Extraction et conversion du sous-titre en format WebVTT (`.vtt`).
* `GET /torrents/:infoHash/files/:fileParam/vlc.m3u` : Playlist M3U prête à l'emploi pour VLC / MPV.
* `GET /torrents/:infoHash/archive` : Téléchargement de l'ensemble du torrent sous forme d'archive `.zip`.
* `POST /torrents/:infoHash/start` & `/stop` : Sélectionne ou désélectionne tous les fichiers du torrent.
* `POST /torrents/:infoHash/start/:index` & `/stop/:index` : Sélectionne ou désélectionne un fichier spécifique.

### 🔍 Intégration C411
* `GET /api/c411/status` : Vérifie si l'API C411 est configurée et joignable.
* `GET /api/c411/profile` : Récupère le profil utilisateur (avatar, ratio, Zen, Freeleech).
* `GET /api/c411/search?q=...&cat=...` : Recherche de releases via Torznab proxyfié côté serveur.
* `POST /api/c411/download` : Téléchargement direct du `.torrent` et injection instantanée dans Peerflix (`{"id": "..."}`).

### 💻 Système & Maintenance
* `GET /system/status` : Statut du système, espace disque hôte libre, taille du cache et santé globale.
* `POST /system/clean` : Déclenche manuellement la purge de tous les torrents non épinglés.

---

## 🛠️ Développement Local

### Prérequis
* Node.js >= 20.x (Node.js 22 LTS recommandé)
* FFmpeg & FFprobe installés sur votre machine hôte

### Installation & Lancement
```sh
# 1. Cloner le dépôt
git clone https://github.com/votre-compte/peerflix-server.git
cd peerflix-server

# 2. Installer les dépendances
npm install

# 3. Lancer en mode développement (Serveur Express + Vite HMR)
npm run dev

# 4. Lancer la suite de tests unitaires et d'intégration
npm test

# 5. Vérifier les types TypeScript
npm run typecheck

# 6. Compiler pour la production
npm run build
```

---

## 🔒 Sécurité & Bonnes Pratiques
* **Non-Root Docker** : L'image officielle s'exécute sous un utilisateur non-privilégié dédié (`peerflix:1001`).
* **Reverse Proxy** : En cas d'exposition sur Internet, placez Peerflix Server derrière un reverse proxy HTTPS (Caddy, Traefik, Nginx Proxy Manager) avec authentification HTTP Basic Auth ou OAuth2/Authelia.
* **Sécurité de la clé API** : La clé C411 n'est jamais transmise aux navigateurs clients et reste cantonnée aux variables d'environnement du conteneur.

---

## 📄 Licence

Ce projet est sous licence **MIT**. Inspiré des travaux originaux de [Mafintosh](https://github.com/mafintosh) et [Asapach](https://github.com/asapach).
