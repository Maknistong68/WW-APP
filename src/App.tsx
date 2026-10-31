import { useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import TodoPage from './pages/TodoPage'
import CampsPage from './pages/CampsPage'
import CampDetailPage from './pages/CampDetailPage'
import TicketsPage from './pages/TicketsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import ContractorsPage from './pages/ContractorsPage'
import ContractorDetailPage from './pages/ContractorDetailPage'
import AuditsPage from './pages/AuditsPage'
import DashboardPage from './pages/DashboardPage'
import KpiDetailPage from './pages/KpiDetailPage'
import InfoFormPage from './pages/InfoFormPage'
import ChecklistPage from './pages/ChecklistPage'
import SettingsPage from './pages/SettingsPage'
import ActivityPage from './pages/ActivityPage'
import Sidebar from './components/Sidebar'
import AddButton from './components/AddButton'
import MissingPage from './pages/MissingPage'
import LoginPage, { WaitingPage } from './pages/LoginPage'
import UsersPage from './pages/UsersPage'
import { AuthContext, canEditRole, useAuth, useAuthInfo } from './lib/auth'
import ToastHost, { showToast } from './components/Toast'
import { backgroundSync, type SyncResult } from './lib/sync'

export default function App() {
  const auth = useAuth()
  if (auth.phase === 'loading') return null
  if (auth.phase === 'signedOut') {
    return (
      <>
        <LoginPage onDone={auth.refresh} />
        <ToastHost />
      </>
    )
  }
  if (auth.phase === 'pending' || auth.phase === 'rejected') {
    return (
      <>
        <WaitingPage
          email={auth.email}
          rejected={auth.phase === 'rejected'}
          onRefresh={auth.refresh}
          onSignOut={() => void auth.signOut()}
        />
        <ToastHost />
      </>
    )
  }
  return (
    <AuthContext.Provider value={{ email: auth.email, role: auth.role, canEdit: canEditRole(auth.role), signOut: auth.signOut }}>
      <AppShell />
    </AuthContext.Provider>
  )
}

/** The app itself, shown once signed in and approved (or in local-only mode). */
function AppShell() {
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
        <Route path="/" element={<TodoPage />} />
        <Route path="/camps" element={<CampsPage />} />
        <Route path="/camps/:uuid" element={<CampDetailPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:uuid" element={<TicketDetailPage />} />
        <Route path="/contractors" element={<ContractorsPage />} />
        <Route path="/contractors/:uuid" element={<ContractorDetailPage />} />
        <Route path="/audits" element={<AuditsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/kpis/:key" element={<KpiDetailPage />} />
        <Route path="/missing/:item" element={<MissingPage />} />
        <Route path="/new/:templateId" element={<EditOnly><InfoFormPage mode="new" /></EditOnly>} />
        <Route path="/inspection/:id" element={<ChecklistPage />} />
        <Route path="/inspection/:id/edit" element={<EditOnly><InfoFormPage mode="edit" /></EditOnly>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/log" element={<ActivityPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/kpis" element={<Navigate to="/dashboard?v=kpis" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Sidebar />
      <AddButton />
      <ToastHost />
    </HashRouter>
  )
}

/** Viewers can't open add/edit forms. */
function EditOnly({ children }: { children: ReactNode }) {
  const { canEdit } = useAuthInfo()
  return canEdit ? <>{children}</> : <Navigate to="/" replace />
}
