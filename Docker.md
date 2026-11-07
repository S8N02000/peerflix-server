# Déploiement Docker

Guide de déploiement de Peerflix Server sous Docker et Docker Compose.

---

## 1. Avec Docker Compose (Méthode Recommandée)

Utilisez le fichier [`docker-compose.yml`](docker-compose.yml) fourni à la racine du projet :

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
      - PORT=9000
      - PEERFLIX_CONFIG_PATH=/data/config
      - PEERFLIX_DOWNLOAD_PATH=/data/downloads
      - MIN_FREE_DISK_MB=2048
      - AUTO_CLEAN_ENABLED=true
      - AUTO_CLEAN_DAY=1
      - AUTO_CLEAN_HOUR=9
      - AUTO_CLEAN_MINUTE=0
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

Lancer le conteneur en arrière-plan :
```sh
docker compose up -d
```

---

## 2. Avec Docker CLI direct

```sh
# Créer les répertoires de données persistantes
mkdir -p data/config data/downloads

# Lancer le conteneur
docker run -d \
  --name peerflix-server \
  --restart unless-stopped \
  -p 9000:9000 \
  -e PORT=9000 \
  -e PEERFLIX_CONFIG_PATH=/data/config \
  -e PEERFLIX_DOWNLOAD_PATH=/data/downloads \
  -e MIN_FREE_DISK_MB=2048 \
  -e TZ=Europe/Paris \
  -v $(pwd)/data/config:/data/config \
  -v $(pwd)/data/downloads:/data/downloads \
  peerflix-server:latest
```

---

## 3. Sécurité de l'image Docker

- **Image multi-stage** : Construite sur `node:22-bookworm-slim` avec suppression des dépendances de dev (`npm prune --production`).
- **Utilisateur non-root** : S'exécute avec le compte `peerflix:1001`.
- **Gestionnaire d'init `tini`** : Assure la bonne propagation des signaux UNIX (SIGTERM, SIGINT) pour éviter les processus zombies.
- **Healthcheck intégré** : Surveille régulièrement l'état de l'API sur `/system/status`.
