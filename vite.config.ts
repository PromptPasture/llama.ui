import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';
import loadVersion from 'vite-plugin-package-version';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    // Resolves Svelte's browser build when mounting components under vitest.
    svelteTesting(),
    loadVersion(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: 'llama.ui',
        name: 'llama.ui - Minimal AI chat interface',
        short_name: 'llama.ui',
        description:
          'A minimal Interface for AI Companion that runs entirely in your browser.',
        display: 'standalone',
        // The light palette's --color-bg. A manifest carries one colour, so
        // the splash screen cannot follow the theme the way the page does.
        theme_color: '#ffffff',
        background_color: '#ffffff',
        start_url: 'https://llama-ui.js.org',
        scope: 'https://llama-ui.js.org',
        orientation: 'any',
        lang: 'en',
        icons: [
          {
            purpose: 'maskable',
            sizes: '512x512',
            src: 'assets/manifest-icon-512.maskable.png',
            type: 'image/png',
          },
          {
            purpose: 'any',
            sizes: '512x512',
            src: 'assets/manifest-icon-512.maskable.png',
            type: 'image/png',
          },
          {
            purpose: 'any',
            sizes: '192x192',
            src: 'assets/manifest-icon-192.maskable.png',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            sizes: '192x192',
            src: 'assets/manifest-icon-192.maskable.png',
            type: 'image/png',
          },
        ],
        screenshots: [
          {
            src: 'screenshots/desktop.png',
            sizes: '1366x1024',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: 'screenshots/mobile.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
          },
        ],
        shortcuts: [
          {
            name: 'New Chat',
            url: '/',
            description: 'Start a new chat.',
          },
        ],
        categories: ['ai', 'llm', 'webui', 'llm-ui', 'llm-webui'],
        launch_handler: {
          client_mode: ['navigate-existing', 'auto'],
        },
      },
      workbox: {
        // woff is deliberately excluded: KaTeX ships woff2, woff and ttf, but
        // any browser able to run this app supports woff2, so precaching the
        // legacy copies costs every first visit ~296 KB that is never read.
        // The files remain in the build, so a browser that wants them can
        // still fetch them over the network.
        globPatterns: ['**/*.{js,mjs,css,html,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === 'document' ||
              request.destination === 'script' ||
              request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/v1': 'http://localhost:8080',
      '/props': 'http://localhost:8080',
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  test: {
    // jsdom rather than node: the markdown pipeline sanitises through
    // DOMPurify, and component tests mount into a real DOM.
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    // Inside src/ so svelte-check picks up the matcher type augmentation too.
    setupFiles: ['./src/vitest-setup.ts'],
  },
});
