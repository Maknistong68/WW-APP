import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { requestPersistentStorage } from './db'
import './lib/installPrompt'
import '@fontsource-variable/figtree'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/charts.css'
import './styles/inspection.css'
import './styles/motion.css'
import { initTheme } from './lib/theme'

registerSW({ immediate: true })

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
