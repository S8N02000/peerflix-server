# Guide de Développement

Guide pour exécuter, modifier et tester le code source de Peerflix Server.

---

## Prérequis

- **Node.js** >= 20.x (Node.js 22 LTS recommandé)
- **npm** >= 10.x
- **FFmpeg** et **FFprobe** installés sur votre système (requis pour l'analyse multimédia et le transcodage audio AAC).

---

## Installation

```sh
# Cloner le dépôt
git clone https://github.com/votre-compte/peerflix-server.git
cd peerflix-server

# Installer l'ensemble des dépendances
npm install
```

---

## Commandes Disponibles

### 1. Développement (Live Reload & Vite HMR)
```sh
npm run dev
```
Démarre simultanément le serveur backend Express (avec rechargement automatique) et le serveur Vite pour le frontend Vue 3 avec Hot Module Replacement.
L'application est accessible sur `http://localhost:5173` ou `http://localhost:9000`.

### 2. Tests Automatisés
```sh
# Lancer la suite de tests complète (34 fichiers, 135 tests)
npm test

# Lancer les tests en mode watch
npm run test:watch
```

### 3. Vérification des Types TypeScript
```sh
npm run typecheck
```
Exécute `tsc` pour le backend et `vue-tsc` pour le frontend Vue 3 afin de garantir une absence totale d'erreurs de typage.

### 4. Compilation Production
```sh
npm run build
```
Compile le client dans `dist/client/` via Vite et le serveur dans `dist/server/` via `tsc`.

### 5. Démarrage de la Version Compilée
```sh
npm start
```
Lance le serveur de production compilé sur le port configuré (par défaut: `9000`).
