import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  root: './src/client',
  base: './',
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/torrents': {
        target: 'http://localhost:9000',
        changeOrigin: true
      },
      '/upload': {
        target: 'http://localhost:9000',
        changeOrigin: true
      },
      '/system': {
        target: 'http://localhost:9000',
        changeOrigin: true
      },
      '/playlist.m3u': {
        target: 'http://localhost:9000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:9000',
        ws: true
      }
    }
  }
});
