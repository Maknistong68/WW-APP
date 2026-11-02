import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' + hash routing keeps the app deployable on any static host
// (Vercel, Netlify, GitHub Pages) without server configuration.
// Which build is running (shown in Settings › Sync log): the commit on Vercel, else the build time.
const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(BUILD) },
  // Phones the team uses: iOS 15+ Safari, Chrome / Edge / Samsung Internet on Android, desktop Edge and Chrome.
  build: { target: ['es2020', 'safari15', 'chrome100', 'edge100', 'firefox100'] },
  base: './',
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits for a safe moment (src/lib/appUpdate.ts)
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      workbox: {
        // jpeg/jpg must be included: buildWord fetches the bundled logo at
        // export time, so leaving it out of the precache breaks offline export.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        // The same id the app had (start_url resolved), so installed copies update instead of duplicating.
        id: '/',
        name: 'WW Co-pilot',
        short_name: 'WW Co-pilot',
        description: 'Worker Welfare tickets, KPIs, camps and audits. Works offline.',
        lang: 'en',
        theme_color: '#F3F4F6',
        background_color: '#F3F4F6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
