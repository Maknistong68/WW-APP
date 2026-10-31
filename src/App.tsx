import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import TodayPage from './pages/TodayPage'
import TicketsPage from './pages/TicketsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import ContractorsPage from './pages/ContractorsPage'
import ContractorDetailPage from './pages/ContractorDetailPage'
import AuditsPage from './pages/AuditsPage'
import DashboardPage from './pages/DashboardPage'
import InfoFormPage from './pages/InfoFormPage'
import ChecklistPage from './pages/ChecklistPage'
import SettingsPage from './pages/SettingsPage'
import ImportPage from './pages/ImportPage'
import ActivityPage from './pages/ActivityPage'
import TabBar from './components/TabBar'
import ToastHost, { showToast } from './components/Toast'
import { backgroundSync, type SyncResult } from './lib/sync'

export default function App() {
  // Auto-sync when the app opens or connectivity returns (no-op until
  // cloud sync is configured in Settings).
  useEffect(() => {
    const announce = (r: SyncResult) => {
      if (r.failed > 0) {
        showToast({
          text: `Cloud sync: ${r.failed} item${r.failed === 1 ? '' : 's'} failed — see activity log`,
          duration: 6000,
        })
        return
      }
      const moved = r.pushed + r.pulled + r.photosUp + r.photosDown + r.records
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
        <Route path="/" element={<TodayPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:uuid" element={<TicketDetailPage />} />
        <Route path="/contractors" element={<ContractorsPage />} />
        <Route path="/contractors/:uuid" element={<ContractorDetailPage />} />
        <Route path="/audits" element={<AuditsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/new/:templateId" element={<InfoFormPage mode="new" />} />
        <Route path="/inspection/:id" element={<ChecklistPage />} />
        <Route path="/inspection/:id/edit" element={<InfoFormPage mode="edit" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/import" element={<ImportPage />} />
        <Route path="/settings/log" element={<ActivityPage />} />
        <Route path="/kpis" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
      <ToastHost />
    </HashRouter>
  )
}
