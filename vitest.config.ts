import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue() as any],
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/client/**', 'jsdom']
    ],
    globals: true
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@server': path.resolve(__dirname, 'src/server'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  }
});
