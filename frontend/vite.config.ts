import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const useDevPolling = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VITE_DEV_POLLING === '1'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Freelance Ledger',
        short_name: 'Ledger',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#0c0d11',
        theme_color: '#0c0d11',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/outpost\.goauthentik\.io/],
      },
    }),
  ],
  server: {
    watch: useDevPolling ? { usePolling: true, interval: 250 } : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:5145',
        changeOrigin: true,
      },
    },
  },
})
