import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { db, logEvent, requestPersistentStorage } from './db'
import { showToast } from './components/Toast'
import { startAppUpdates } from './lib/appUpdate'
import { describeSaveError, isNoise } from './lib/saveError'
import { reloadApp } from './lib/useSave'
import { setActor } from './lib/actor'
import './lib/installPrompt'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/charts.css'
import './styles/dash.css'
import './styles/inspection.css'
import './styles/motion.css'
import { initTheme } from './lib/theme'

// A new version installs in the background and takes over when no form is open.
void startAppUpdates((apply) =>
  showToast({ text: 'Update ready', actionLabel: 'Reload', onAction: apply, duration: 10000 }),
)

// Nothing fails silently: any error no code caught is logged (Settings ›
// Sync log) and shown once in a while, so "it does nothing" names its cause.
let lastShown = 0
function reportUnexpected(reason: unknown) {
  if (isNoise(reason)) return
  const d = describeSaveError(reason)
  logEvent(null, 'Unexpected error', d.detail)
  if (Date.now() - lastShown < 5000) return
  lastShown = Date.now()
  const known = !d.text.startsWith('Could not save:')
  showToast({
    text: known ? d.text : 'Something went wrong. Details in Settings › Sync log.',
    tone: 'bad',
    duration: 8000,
    ...(d.reload ? { actionLabel: 'Reload', onAction: reloadApp } : {}),
  })
}
window.addEventListener('unhandledrejection', (e) => reportUnexpected(e.reason))
window.addEventListener('error', (e) => reportUnexpected(e.error ?? e.message))
// Storage notices from db.ts (an update in another tab, a blocked upgrade).
window.addEventListener('ww-notice', (e) => {
  const { text, reload } = (e as CustomEvent<{ text: string; reload: boolean }>).detail
  showToast({ text, tone: 'bad', duration: 10000, ...(reload ? { actionLabel: 'Reload', onAction: reloadApp } : {}) })
})
// Dev only: lets browser checks reach the database (e.g. to force a failure).
if (import.meta.env.DEV) Object.assign(window, { __ww: { db, setActor } })
db.open().catch((err) => logEvent(null, 'Database open failed', describeSaveError(err).detail))

// Back from an email link (password reset / confirmation): open Settings so
// the code in the URL is exchanged there and a new password can be set.
if (new URLSearchParams(window.location.search).has('code') && !window.location.hash.startsWith('#/settings')) {
  window.location.hash = '#/settings'
}
// An expired / used email link comes back as #error=…: explain it in Settings.
if (window.location.hash.startsWith('#error=')) {
  const p = new URLSearchParams(window.location.hash.slice(1))
  sessionStorage.setItem(
    'ww.authLinkError',
    p.get('error_code') === 'otp_expired'
      ? 'That email link has expired or was already used. Ask for a new one.'
      : (p.get('error_description') ?? 'The email link did not work. Ask for a new one.'),
  )
  window.location.hash = '#/settings'
}
void requestPersistentStorage()
initTheme()

// iOS only shows :active press styles when the page listens for touches.
document.addEventListener('touchstart', () => {}, { passive: true })
// Low-end phones: solid bars instead of blurred glass (cheaper to draw).
{
  const nav = navigator as Navigator & { deviceMemory?: number }
  if ((nav.deviceMemory ?? 8) <= 3 || (navigator.hardwareConcurrency ?? 8) <= 4) document.documentElement.setAttribute('data-lite', '')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
