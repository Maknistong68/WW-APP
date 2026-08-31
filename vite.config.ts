import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' + hash routing keeps the app deployable on any static host
// (Vercel, Netlify, GitHub Pages) without server configuration.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // jpeg/jpg must be included: buildWord fetches the bundled logo at
        // export time, so leaving it out of the precache breaks offline export.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'Worker Welfare Inspections',
        short_name: 'WW Inspect',
        description:
          'Offline-first worker welfare inspection & audit checklists with photo observations and Excel/Word export.',
        theme_color: '#146c43',
        background_color: '#f2f6f3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
