import { Suspense, lazy, useEffect, useRef, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import TodoPage from './pages/TodoPage'
import AreaPage from './pages/AreaPage'
import CampsPage from './pages/CampsPage'
import CampDetailPage from './pages/CampDetailPage'
import TicketsPage from './pages/TicketsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import RemovedTicketsPage from './pages/RemovedTicketsPage'
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
import TabBar from './components/TabBar'
import ActionSheetHost from './components/ActionSheet'
import SheetHost from './components/SheetHost'
import ContractorKpiPage from './pages/ContractorKpiPage'
import ComparePage from './pages/ComparePage'
import NavProvider, { useShown } from './components/RouteTransition'
import type { NavKind } from './lib/nav'
import LibraryPage from './pages/LibraryPage'

// The 3D view (three.js) loads only when opened, so the app stays light.
const City3DPage = lazy(() => import('./pages/City3DPage'))
import EntryPage from './pages/EntryPage'
import { entryFromMissing } from './lib/entryItems'
import CloseoutPage from './pages/CloseoutPage'
import LoginPage, { SetPasswordPage, WaitingPage } from './pages/LoginPage'
import { gateScreen } from './lib/gate'
import InstallPage from './pages/InstallPage'
import { useInstallState } from './lib/installPrompt'
import UsersPage from './pages/UsersPage'
import { AuthContext, actorName, canEditRole, useAuth, useAuthInfo } from './lib/auth'
import { setActor, setRole } from './lib/actor'
import { setOnboardingUser } from './lib/onboarding'
import ToastHost, { showToast } from './components/Toast'
import { backgroundSync, type SyncResult } from './lib/sync'
import { db } from './db'
import { duplicateNumbers } from './lib/ticketCheck'

export default function App() {
  const auth = useAuth()
  const install = useInstallState()
  const screen = gateScreen({ phase: auth.phase, setPassword: auth.setPassword, install: install.offerFirst })
  if (screen === 'loading') return null
  if (screen === 'install') {
    return (
      <>
        <InstallPage signInAs={auth.session ? (auth.username ? `@${auth.username}` : auth.email) : undefined} linkError={auth.linkError} />
        <ToastHost />
      </>
    )
  }
  if (screen === 'setPassword') {
    return (
      <>
        <SetPasswordPage
          name={auth.fullName || (auth.username ? `@${auth.username}` : '')}
          invited={auth.invited}
          onDone={auth.refresh}
          onSignOut={() => void auth.signOut()}
        />
        <ToastHost />
      </>
    )
  }
  if (screen === 'login') {
    return (
      <>
        <LoginPage onDone={auth.refresh} linkError={auth.linkError} />
        <ToastHost />
      </>
    )
  }
  if (screen === 'waiting') {
    return (
      <>
        <WaitingPage
          email={auth.email}
          rejected={auth.phase === 'rejected'}
          fullName={auth.fullName}
          username={auth.username}
          onRefresh={auth.refresh}
          onSignOut={() => void auth.signOut()}
        />
        <ToastHost />
      </>
    )
  }
  setRole(auth.role)
  setOnboardingUser(auth.session?.user.id ?? '')
  // Every change made on this phone is stamped with who is signed in.
  setActor(
    auth.session
      ? { id: auth.session.user.id, name: actorName({ full_name: auth.fullName, username: auth.username, email: auth.email }), role: auth.role }
      : null,
  )
  return (
    <AuthContext.Provider
      value={{
        email: auth.email,
        role: auth.role,
        canEdit: canEditRole(auth.role),
        signOut: auth.signOut,
        userId: auth.session?.user.id ?? '',
        username: auth.username,
        fullName: auth.fullName,
        refresh: auth.refresh,
      }}
    >
      <AppShell />
    </AuthContext.Provider>
  )
}

/** The app itself, shown once signed in and approved (or in local-only mode). */
function AppShell() {
  const { canEdit } = useAuthInfo()
  // Auto-sync when the app opens or connectivity returns (no-op until
  // cloud sync is configured in Settings).
  useEffect(() => {
    const announce = (r: SyncResult) => {
      if (r.failed > 0) {
        showToast({
          text: `Cloud sync: ${r.failed} item${r.failed === 1 ? '' : 's'} failed — see Settings › Sync log`,
          duration: 6000,
        })
        return
      }
      const moved = r.pushed + r.pulled + r.photosUp + r.photosDown + r.records
      if (moved > 0) showToast({ text: `Cloud sync: ${moved} item${moved === 1 ? '' : 's'} updated`, duration: 3500 })
      // Two phones offline can both take the same number: say so once per sync.
      void db.tickets.toArray().then((all) => {
        const twice = duplicateNumbers(all)
        if (twice.length)
          showToast({
            text: `${twice.slice(0, 2).join(', ')}${twice.length > 2 ? ` and ${twice.length - 2} more` : ''} used twice. Search the number in Tickets and edit one.`,
            tone: 'bad',
            duration: 9000,
          })
      })
    }
    backgroundSync(announce)
    const onOnline = () => backgroundSync(announce)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <HashRouter>
      <NavProvider>
        <AppRoutes />
        <Sidebar />
        <AddButton />
        <TabBar />
        <ActionSheetHost canEdit={canEdit} />
        <SheetHost />
        <ToastHost />
      </NavProvider>
    </HashRouter>
  )
}

/**
 * The screens. They render the *shown* location (it trails the router while a
 * screen transition captures the old screen); `data-enter` tells CSS how this
 * screen arrived, and stays fixed for its lifetime.
 */
function AppRoutes() {
  const { location, kind } = useShown()
  const entry = useRef<{ path: string; kind: NavKind } | null>(null)
  if (!entry.current || entry.current.path !== location.pathname) entry.current = { path: location.pathname, kind }
  return (
    <div key={location.pathname} className="route" data-enter={entry.current.kind}>
      <Routes location={location}>
        <Route path="/" element={<TodoPage />} />
        <Route path="/today/:area" element={<AreaPage />} />
        <Route path="/camps" element={<CampsPage />} />
        <Route path="/camps/:uuid" element={<CampDetailPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/removed" element={<RemovedTicketsPage />} />
        <Route path="/tickets/:uuid" element={<TicketDetailPage />} />
        <Route path="/contractors" element={<ContractorsPage />} />
        <Route path="/contractors/:uuid" element={<ContractorDetailPage />} />
        <Route path="/contractors/:uuid/kpi/:key" element={<ContractorKpiPage />} />
        <Route path="/audits" element={<AuditsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/dashboard/3d"
          element={
            <Suspense fallback={<div className="city-loading"><span className="city-spinner" aria-hidden="true" />Loading 3D (first time only)…</div>}>
              <City3DPage />
            </Suspense>
          }
        />
        <Route path="/kpis/:key" element={<KpiDetailPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/entry" element={<EntryPage />} />
        {/* the old "still missing" lists open Monthly entry */}
        <Route path="/missing/:item" element={<MissingRedirect />} />
        <Route path="/closeouts" element={<CloseoutPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/new/:templateId" element={<EditOnly><InfoFormPage mode="new" /></EditOnly>} />
        <Route path="/inspection/:id" element={<ChecklistPage />} />
        <Route path="/inspection/:id/edit" element={<EditOnly><InfoFormPage mode="edit" /></EditOnly>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/log" element={<ActivityPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/kpis" element={<Navigate to="/dashboard?v=kpis" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

/** Viewers can't open add/edit forms. */
function EditOnly({ children }: { children: ReactNode }) {
  const { canEdit } = useAuthInfo()
  return canEdit ? <>{children}</> : <Navigate to="/" replace />
}

/** An old /missing/:item link (Home, the Dashboard, a bookmark): the same list in Monthly entry. */
function MissingRedirect() {
  const { item = '' } = useParams()
  const [params] = useSearchParams()
  return <Navigate to={entryFromMissing(item, params)} replace />
}
