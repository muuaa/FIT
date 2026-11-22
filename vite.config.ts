import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// VITE_EMBEDDED=1 builds one self-contained file (no service worker, no code splitting)
// for previews such as a claude.ai artifact. See scripts/build-embedded.mjs.
const embedded = Boolean(process.env.VITE_EMBEDDED);

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH=/FIT/.
  base: process.env.BASE_PATH ?? '/',
  build: embedded
    ? { outDir: 'dist-embedded', assetsInlineLimit: 100_000_000, rolldownOptions: { output: { codeSplitting: false } } }
    : { chunkSizeWarningLimit: 1200 },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  plugins: [
    react(),
    tailwindcss(),
    !embedded &&
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'push-sw.js'],
      manifest: {
        id: 'replete',
        name: 'Replete',
        short_name: 'Replete',
        description: 'Lifting, food, water, supplements, bodyweight and cardio in one app.',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'],
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
