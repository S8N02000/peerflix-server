# Multi-stage Dockerfile for Peerflix Server
# Stage 1: Build TypeScript frontend & backend
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies needed for native modules / build
COPY package*.json ./
RUN npm ci

# Copy source code and build configs
COPY tsconfig*.json vite.config.ts ./
COPY src src

# Build both client and server
RUN npm run build
RUN npm prune --production

# Stage 2: Production runtime image
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=9000
ENV PEERFLIX_CONFIG_PATH=/data/config
ENV PEERFLIX_DOWNLOAD_PATH=/data/downloads

# Install curl, ca-certificates, and tini for proper signal forwarding and zombie reaper
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root user and group
RUN groupadd -g 1001 peerflix && \
    useradd -u 1001 -g peerflix -m -s /bin/bash peerflix

# Prepare storage directories with proper ownership
RUN mkdir -p /data/config /data/downloads /app && \
    chown -R peerflix:peerflix /data /app

WORKDIR /app

# Copy production node_modules, compiled dist files, and package.json
COPY --chown=peerflix:peerflix package*.json ./
COPY --from=builder --chown=peerflix:peerflix /app/node_modules ./node_modules
COPY --from=builder --chown=peerflix:peerflix /app/dist ./dist

USER peerflix

# Volumes for persistent torrents metadata and downloads
VOLUME ["/data/config", "/data/downloads"]

# Expose Web UI / API port
EXPOSE 9000

# Healthcheck to verify the web service is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:9000/system/status || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "node", "dist/server/server/bin.js"]
