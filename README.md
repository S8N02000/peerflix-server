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
  [![Tests](https://img.shields.io/badge/Tests-169%2F169%20Passing-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
  [![eBook Reader](https://img.shields.io/badge/eBook%20Reader-EPUB%20%7C%20PDF%20%7C%20CBR%20%7C%20CBZ-blueviolet)](https://github.com/S8N02000/peerflix-server)
  [![FFmpeg](https://img.shields.io/badge/FFmpeg-Audio%20Remux%20Zero--GPU-007808?logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
</div>

---

## ⚖️ Avertissement Légal & Cadre Juridique (France)

> [!IMPORTANT]
> **Ce logiciel est un outil technique d'infrastructure et de transfert réseau fourni à des fins exclusives d'interopérabilité, d'expérimentation et de distribution de contenus libres de droits.**

* **Respect de la Propriété Intellectuelle (Code de la propriété intellectuelle)** :
  En France, le téléchargement, la reproduction, la représentation ou la mise à disposition d'œuvres protégées par le droit d'auteur (films, séries, musique, logiciels, jeux vidéo, livres numériques) sans l'autorisation préalable et expresse des titulaires de droits constitue un délit de contrefaçon sanctionné par les articles **L.335-2 et suivants du Code de la propriété intellectuelle** (peines pouvant aller jusqu'à 3 ans d'emprisonnement et 300 000 euros d'amende).
* **Cadre Réglementaire & ARCOM** :
  L'utilisation des protocoles d'échange pair-à-pair (Peer-to-Peer / BitTorrent) est régie en France par le Code de la propriété intellectuelle et surveillée par l'Autorité de régulation de la communication audiovisuelle et numérique (**ARCOM**, ex-HADOPI). L'utilisateur s'engage à respecter scrupuleusement la législation en vigueur relative aux droits d'auteur et droits voisins.
* **Neutralité Technique du Logiciel** :
  À l'instar d'un navigateur web ou d'un client de transfert de fichiers (HTTP/FTP), Peerflix Server est un protocole logiciel technologiquement neutre. Il est conçu pour la diffusion de distributions Linux (Ubuntu, Debian, Fedora), d'archives publiques, d'œuvres sous licences ouvertes (Creative Commons, domaine public) ou de médias personnels dont vous détenez légitimement les droits de copie et de diffusion.
* **Exclusion de Responsabilité** :
  L'auteur, les développeurs et les contributeurs de ce projet déclinent expressément toute responsabilité quant à l'usage illégal, frauduleux ou non conforme qui pourrait être fait de ce logiciel par des tiers. L'utilisateur final assume l'entière et exclusive responsabilité civile et pénale de ses actes et des données qu'il choisit de transférer, de relayer ou de visionner.

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

### 🔍 5. Intégration Tracker C411 (Recherche Native, Métadonnées TMDB & 1-Clic)
* **Architecture 100 % Sécurisée** : La clé API (`C411_API_KEY`) réside exclusivement sur le backend serveur et n'est jamais exposée au navigateur.
* **Navigation par onglets sans rechargement (0 ms)** : Bascule instantanée entre *Mes Téléchargements* et *Recherche C411*.
* **Métadonnées Riches TMDB & Fiche Détaillée** :
  - Récupération automatique du backdrop HD 1280p, poster, synopsis/overview, notes spectateurs, genres, réalisateurs et casting complet.
  - Onglet dédié aux **Commentaires des membres C411** avec avatars, dates relatives et compteurs de likes.
  - Visualiseur de fichier NFO brut intégré.
* **Catégorisation fine & Pilules d'accès rapide** :
  - Séparation stricte de l'animation : **`🎌 Animation (film)`** et **`🎌 Animation (Série anime)`**.
  - Catégories dédiées avec pastilles de couleur : Films, Séries TV, Musique, Ebooks, Jeux PC/Consoles, Logiciels, etc.
* **Filtres multi-critères & Préréglages** :
  - Année, Résolution (4K / 2160p, 1080p, 720p...), Source (BluRay, WEB-DL, Remux...), Codec (AV1, HEVC, x264), Format audio (Lossless, FLAC, AC3...), HDR (DV, HDR10+), Langues audio et **Langues des sous-titres**.
  - Sélection des saisons jusqu'à la **saison 100**.
  - Sauvegarde de filtres personnalisés en 1 clic dans le stockage local.
* **Widget profil utilisateur** : Affiche votre avatar, ratio, volume upload/download, solde de points Zen et statut Freeleech.
* **Ajout instantané & Pied de page Sticky** :
  - Lancez en un clic en mode `🌐 Lancer (Public)` ou `🔒 Lancer (Privé)`.
  - Boutons de lancement fixés (sticky) en bas d'écran sans monopoliser la hauteur de lecture sur mobile.

### 📚 6. Lecteur Universel d'eBooks & Bandes Dessinées (EPUB, PDF, CBR, CBZ)
* **Lecteur Web Zéro-Plugin Universel** : Lisez vos livres, magazines, mangas et comics directement dans votre navigateur sur PC, Mac, smartphone ou iPad (Safari compatible).
* **Prise en charge multi-formats** :
  - **EPUB** : Pagination instantanée via flux mémoire `ArrayBuffer`, navigation par chapitres, thèmes de lecture (Sombre, Sépia, Clair), taille de police ajustable (12px à 36px) et polices typographiques soignées (Serif, Sans-serif).
  - **PDF** : Moteur de rendu haute définition vectoriel avec zoom continu et défilement fluide.
  - **CBR & CBZ** : Décompression client ultra-rapide (archives ZIP/RAR), visionneuse d'images haute résolution avec modes d'ajustement (Largeur de page, Hauteur, Plein écran).
* **Sommaire Interactif Opaque (TOC)** : Tiroir coulissant avec table des matières, progression de lecture et fermeture tactile au clic extérieur.
* **Détection automatique sur les cartes** : Bouton `📖 Lire l'eBook` affiché directement sur les torrents contenant des livres ou bandes dessinées.

### 📱 7. Multi-Écrans, TV Box & Playlist IPTV M3U (2026)
* **Playlist IPTV globale `/playlist.m3u` avec VOD** :
  - Balise normalisée `#EXT-X-PLAYLIST-TYPE:VOD` pour une intégration native comme catalogue à la demande.
  - **Regroupement intelligent par Séries & Saisons** (`group-title="Nom Série - S01"`), évitant de mélanger des centaines d'épisodes en vrac.
  - Métadonnées complètes injectées : `tvg-name`, `series`, `season`, `episode`.
  - Possibilité de filtrer par catégorie (`?category=films`, `?category=series`, `?category=music`) ou de forcer le regroupement classique (`?grouping=category`).
* **Guide TV interactif intégré** :
  - Onglet dédié **VLC** (PC, Mac, iPhone/iPad, Android TV).
  - Onglet dédié **Android TV / Google TV** (TiviMate, IPTV Smarters).
  - Onglet dédié **Apple TV (tvOS)** (IPTVX, VLC).
  - Onglets Plex (**Threadfin** / **xTeVe**) et Kodi (**PVR IPTV Simple Client**).
* **Génération de flux VLC (.m3u) & QR Code mobile** : Lecture immédiate sur smartphone, tablette ou lecteur multimédia local.
* **Compatibilité 4K HEVC & Navigateurs modernes** : Détection matérielle directe sans avertissement intempestif.
* **Gestion automatique du Cast** : Détection de disponibilité du récepteur Chromecast / AirPlay avec masquage automatique du bouton si non supporté.
* **Support Traefik & HTTP Basic Auth** : Compatibilité totale avec Traefik sans blocage 401 grâce à `PUBLIC_AUTH_CREDENTIALS` et repli automatique en polling HTTP.

### 👥 8. Système Multi-Utilisateurs Transparent & Confidentialité
* **Attribution automatique de pseudo** : Détection de l'appareil (`iPhone-Renard`, `PC-Win-Loup`, `Mac-Faucon`, etc.) ou tirage aléatoire d'un nom mémorable (`RenardMalin`, `PandaZen`) mémorisé localement sans aucun compte à créer. Bouton 🎲 de re-tirage en 1 clic.
* **Filtre « Mes ajouts »** : Bouton d'accès rapide pour n'afficher que ses propres téléchargements.
* **Torrents Privés (🔒)** : Possibilité de marquer un torrent comme privé pour le masquer complètement aux yeux des autres utilisateurs.
* **Anonymisation de l'auteur** : Les utilisateurs standards voient uniquement un badge temporel neutre (`🕒 Récent`) ou `👤 Moi`, tandis que l'administrateur peut identifier précisément chaque auteur.
* **Mode Administrateur sécurisé (`ADMIN_PASSWORD`)** : Verrouillé par mot de passe en variable d'environnement pour inspecter l'ensemble des torrents et forcer le nettoyage du serveur.

### 🛡️ 9. Surveillance Disque & Nettoyage Automatique
* **Moniteur d'espace disque en temps réel** : Analyse régulière de l'espace libre (`MIN_FREE_DISK_MB`) pour empêcher la saturation du disque système.
* **Réservation prédictive de quota (Anti-overcommit)** : Calcul instantané en mémoire de l'espace alloué sans sollicitation I/O superflue du disque.
* **Quota disque configurable** : Définissez un quota maximum en Go (`MAX_DISK_QUOTA_GB`).
* **Purge automatique programmable** : Ordonnanceur hebdomadaire configurable pour supprimer les torrents expirés non épinglés.
* **Purge manuelle en 1 clic** : Bouton dans l'interface avec confirmation et rapport d'espace libéré.
* **Épinglage de torrents (Pin)** : Protège vos films et séries favoris contre toute suppression automatique.

### 📱 10. Ergonomie Mobile & Affichage Haute Densité
* **Arborescence des fichiers adaptative** : Sur smartphone, chaque fichier s'organise sur deux lignes nettes (Ligne 1 : case + icône + nom complet sans écrasement ; Ligne 2 : taille + badge de complétion + boutons d'action), évitant toute troncature ou coupure par le bord d'écran.
* **Cartes C411 anti-débordement** : Nom de release et badges techniques encapsulés avec retour à la ligne et ellipses automatiques.
* **Libellés adaptatifs intelligents** :
  - **Vidéos** : `▶ Lancer sur Peerflix (Streaming)`
  - **Livres numériques / BD** : `📖 Lire l'eBook`
  - **Jeux / Applications / ISO** : `📥 Télécharger sur le serveur`
  - **Audio / Musique** : `🎵 Ajouter & Écouter`

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

      # Mot de passe administrateur pour déverrouiller la gestion globale (optionnel)
      # - ADMIN_PASSWORD=votre_mot_de_passe_secret

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
| `ADMIN_PASSWORD` | Mot de passe de protection du Mode Administrateur | *admin / peerflix* | `mon_secret_admin` |
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
* `GET /torrents/:infoHash/files/:fileParam` : Streaming direct du fichier (support complet des en-têtes `Range: bytes=X-Y`, vidéo, audio, eBook ePub/PDF/CBR/CBZ).
* `GET /torrents/:infoHash/probe/:fileParam` : Analyse multimédia via `ffprobe` (codecs vidéo/audio, pistes audio, sous-titres).
* `GET /torrents/:infoHash/remux/:fileParam?audioTrack=0` : Flux Fragmented MP4 (`fmp4`) avec audio transcodé en AAC à la volée.
* `GET /torrents/:infoHash/subtitles/:fileParam` : Extraction et conversion du sous-titre en format WebVTT (`.vtt`).
* `GET /torrents/:infoHash/files/:fileParam/vlc.m3u` : Playlist M3U prête à l'emploi pour VLC / MPV.
* `GET /torrents/:infoHash/preview/:fileParam` : Prévisualisation textuelle sécurisée (fichiers NFO, TXT).
* `GET /torrents/:infoHash/hash/:fileParam` : Calcul d'intégrité SHA-256 à la demande sur les fichiers complétés à 100%.
* `GET /torrents/:infoHash/archive` : Téléchargement de l'ensemble du torrent sous forme d'archive `.zip`.
* `POST /torrents/:infoHash/start` & `/stop` : Sélectionne ou désélectionne tous les fichiers du torrent.
* `POST /torrents/:infoHash/start/:index` & `/stop/:index` : Sélectionne ou désélectionne un fichier spécifique.

### 📺 Playlists IPTV & VOD
* `GET /playlist.m3u` : Playlist globale IPTV au format VOD (`#EXT-X-PLAYLIST-TYPE:VOD`), avec regroupement par série/saison (`grouping=series` par défaut ou `grouping=category`), filtrage de catégorie (`category=films|series|music`) et filtrage par utilisateur (`user=...&onlyUser=true`).

### 🔍 Intégration C411
* `GET /c411/status` : Vérifie si l'API C411 est configurée et joignable.
* `GET /c411/profile` : Récupère le profil utilisateur (avatar, ratio, Zen, Freeleech).
* `GET /c411/search?q=...&category=...` : Recherche multi-critères avancée (résolution, source, codec, HDR, audio, langues, sous-titres, saison, année, freeleech).
* `GET /c411/details/:id` : Récupération de la fiche complète avec enrichissement TMDB (backdrop, synopsis, casting, note) et commentaires des membres.
* `POST /c411/download` : Téléchargement direct du `.torrent` et injection instantanée dans Peerflix (`{"id": "...", "private": false}`).

### 💻 Système & Maintenance
* `GET /system/status` : Statut du système, espace disque hôte libre, taille du cache et santé globale.
* `POST /system/clean` : Déclenche manuellement la purge de tous les torrents non épinglés.
* `POST /system/admin-auth` : Authentification pour le déverrouillage du mode administrateur.

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
