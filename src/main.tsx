import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { requestPersistentStorage } from './db'
import './lib/installPrompt'
import './styles.css'

registerSW({ immediate: true })

// Back from an email link (password reset / confirmation): open Settings so
// the code in the URL is exchanged there and a new password can be set.
if (new URLSearchParams(window.location.search).has('code') && !window.location.hash.startsWith('#/settings')) {
  window.location.hash = '#/settings'
}
void requestPersistentStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
