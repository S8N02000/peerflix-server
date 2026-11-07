# Peerflix Server REST API

Documentation complète des endpoints HTTP de l'API REST de Peerflix Server.

---

## 1. Torrents

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/torrents` | Retourne la liste de tous les torrents avec progression, vitesse, fichiers et état de freeze |
| `GET` | `/torrents/:infoHash` | Retourne les détails complets d'un torrent spécifique |
| `POST` | `/torrents` | Ajoute un nouveau torrent (`{"link": "magnet:?xt=..."}` ou URL HTTP) |
| `POST` | `/upload` | Ajoute un torrent via upload de fichier `.torrent` (`multipart/form-data`) |
| `DELETE` | `/torrents/:infoHash` | Supprime le torrent et libère ses ressources mémoire |
| `POST` | `/torrents/:infoHash/pause` | Met en pause les échanges réseau avec les pairs |
| `POST` | `/torrents/:infoHash/resume` | Reprend les connexions et téléchargements actifs |
| `POST` | `/torrents/:infoHash/pin` | Épingle ou désépingle un torrent pour le protéger du nettoyage automatique |
| `GET` | `/torrents/:infoHash/stats` | Retourne les métriques détaillées (vitesse, pairs connectés, swarm) |
| `GET` | `/torrents/:infoHash/archive` | Télécharge l'ensemble des fichiers du torrent sous forme d'archive ZIP |

---

## 2. Streaming & Multimédia

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/torrents/:infoHash/files/:fileParam` | Stream direct du fichier (supporte les en-têtes HTTP `Range: bytes=X-Y`) |
| `GET` | `/torrents/:infoHash/probe/:fileParam` | Analyse multimédia par `ffprobe` (détection codecs, canaux audio, pistes) |
| `GET` | `/torrents/:infoHash/remux/:fileParam` | Flux Fragmented MP4 transcodé en AAC à la volée (paramètre optionnel `?audioTrack=0`) |
| `GET` | `/torrents/:infoHash/subtitles/:fileParam` | Extrait et convertit le sous-titre `.srt` en WebVTT (`.vtt`) |
| `GET` | `/torrents/:infoHash/files/:fileParam/vlc.m3u` | Génère une playlist M3U pour lecture directe dans VLC / MPV / IINA |
| `POST` | `/torrents/:infoHash/start` | Sélectionne tous les fichiers du torrent pour téléchargement |
| `POST` | `/torrents/:infoHash/stop` | Désélectionne tous les fichiers du torrent |
| `POST` | `/torrents/:infoHash/start/:index` | Sélectionne un fichier spécifique par son index |
| `POST` | `/torrents/:infoHash/stop/:index` | Désélectionne un fichier spécifique par son index |

---

## 3. Intégration Tracker C411

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/c411/status` | Vérifie si l'API C411 est configurée et joignable |
| `GET` | `/api/c411/profile` | Récupère le profil utilisateur (avatar, ratio, balance Zen, Freeleech) |
| `GET` | `/api/c411/search` | Recherche de releases (paramètres `q`, `cat`, `offset`, `limit`) |
| `POST` | `/api/c411/download` | Télécharge le `.torrent` et le charge directement dans Peerflix (`{"id": "..."}`) |

---

## 4. Système & Maintenance

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/system/status` | Espace disque libre restant, taille du cache, état du moniteur et santé globale |
| `POST` | `/system/clean` | Lance manuellement la purge de tous les torrents non épinglés |
