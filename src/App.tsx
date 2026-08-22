import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import InfoFormPage from './pages/InfoFormPage'
import ChecklistPage from './pages/ChecklistPage'
import KpisPage from './pages/KpisPage'
import SettingsPage from './pages/SettingsPage'
import ToastHost, { showToast } from './components/Toast'
import { backgroundSync } from './lib/sync'

export default function App() {
  // Auto-sync when the app opens or connectivity returns (no-op until
  // cloud sync is configured in Settings).
  useEffect(() => {
    const announce = (r: { pushed: number; pulled: number; photosUp: number; photosDown: number }) => {
      const moved = r.pushed + r.pulled + r.photosUp + r.photosDown
      if (moved > 0) showToast({ text: `Cloud sync: ${moved} item${moved === 1 ? '' : 's'} updated`, duration: 3500 })
    }
    backgroundSync(announce)
    const onOnline = () => backgroundSync(announce)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new/:templateId" element={<InfoFormPage mode="new" />} />
        <Route path="/inspection/:id" element={<ChecklistPage />} />
        <Route path="/inspection/:id/edit" element={<InfoFormPage mode="edit" />} />
        <Route path="/kpis" element={<KpisPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <ToastHost />
    </HashRouter>
  )
}
