import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'generateSW',
      manifest: {
        name: 'Donario',
        short_name: 'Donario',
        description: 'Inventario de donaciones — funciona sin conexión',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'es',
        theme_color: '#0D9488',
        background_color: '#FFFFFF',
        prefer_related_applications: false,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        categories: ['productivity', 'utilities'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webp,ico}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /\.[a-z0-9]{2,5}$/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'donario-pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && /\.(?:woff2?|ttf|eot)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'donario-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && /\.(?:png|jpe?g|svg|webp|gif)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'donario-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
