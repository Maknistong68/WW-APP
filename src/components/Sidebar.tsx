import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon, { type IconName } from './Icon'
import { ROLE_LABEL, useAuthInfo } from '../lib/auth'
import { campState } from '../lib/camps'
import { overdueTickets } from '../lib/dashboard'
import { useAllData } from '../lib/kpiData'
import { buildTodo } from '../lib/todo'
import { lastSyncAt } from '../lib/sync'
import { pendingCount } from '../pages/UsersPage'

const OPEN_EVENT = 'ww:sidebar'
/** Open the sidebar from anywhere (the ☰ button). */
export const openSidebar = () => window.dispatchEvent(new Event(OPEN_EVENT))

interface Item {
  path: string
  label: string
  icon: IconName
  badge?: number
  adminOnly?: boolean
}

/** Slide-in navigation with alert badges. */
export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const me = useAuthInfo()
  const d = useAllData()

  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    if (me.role === 'admin') void pendingCount().then(setPending)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, me.role])
  useEffect(() => setOpen(false), [pathname])

  const badges = useMemo(() => {
    if (!d.loaded) return { todo: 0, late: 0, camps: 0 }
    return {
      todo: buildTodo(d).filter((c) => c.alert?.level === 'bad').length,
      late: overdueTickets(d.tickets).length,
      camps: d.camps.filter((c) => c.active && ['expired', 'never'].includes(campState(c, d.inspections).status)).length,
    }
  }, [d])

  const items: Item[] = [
    { path: '/', label: 'Home', icon: 'home', badge: badges.todo },
    { path: '/tickets', label: 'Tickets', icon: 'ticket', badge: badges.late },
    { path: '/contractors', label: 'Contractors', icon: 'users' },
    { path: '/camps', label: 'Camps', icon: 'tent', badge: badges.camps },
    { path: '/dashboard', label: 'Dashboard', icon: 'chart' },
    { path: '/settings/log', label: 'Activity log', icon: 'activity' },
    { path: '/users', label: 'Users', icon: 'shield', badge: pending, adminOnly: true },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ]
  const active = (p: string) => (p === '/' ? pathname === '/' : pathname === p || (p !== '/settings' && pathname.startsWith(`${p}/`)))
  const sync = lastSyncAt()

  if (!open) return null
  return (
    <div className="side-backdrop" onClick={() => setOpen(false)}>
      <nav className="sidebar" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <div className="side-head">
          <div className="side-app">WW Co-pilot</div>
          <button className="nav-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <Icon name="x" size={22} />
          </button>
        </div>
        {items
          .filter((i) => !i.adminOnly || me.role === 'admin')
          .map((i) => (
            <button
              key={i.path}
              className={`side-item${active(i.path) ? ' active' : ''}`}
              aria-current={active(i.path) ? 'page' : undefined}
              onClick={() => navigate(i.path)}
            >
              <Icon name={i.icon} size={22} />
              <span className="side-label">{i.label}</span>
              {!!i.badge && <span className="side-badge">{i.badge}</span>}
            </button>
          ))}
        <div className="side-foot">
          {me.email && <div>{me.email} · {ROLE_LABEL[me.role]}</div>}
          <div>{sync ? `Synced ${new Date(sync).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Not synced yet'}</div>
          {me.email && (
            <button className="details-toggle" onClick={() => void me.signOut()}>
              Sign out
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}
