import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShownLocation } from './RouteTransition'
import Icon, { type IconName } from './Icon'
import { ROLE_LABEL, useAuthInfo } from '../lib/auth'
import { campState } from '../lib/camps'
import { useAllData } from '../lib/kpiData'
import { lastSyncAt } from '../lib/sync'
import { pendingCount } from '../pages/UsersPage'

const OPEN_EVENT = 'ww:sidebar'
/** Open the drawer from anywhere (the avatar button). */
export const openSidebar = () => window.dispatchEvent(new Event(OPEN_EVENT))

interface Item {
  path: string
  label: string
  icon: IconName
  badge?: number
  adminOnly?: boolean
}

/** Profile drawer (tap your avatar): who you are, the rest of the app, sync, sign out. */
export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)
  const navigate = useNavigate()
  const { pathname } = useShownLocation()
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
    if (!d.loaded) return { camps: 0 }
    return {
      camps: d.camps.filter((c) => c.active && ['expired', 'never'].includes(campState(c, d.inspections).status)).length,
    }
  }, [d])

  const items: Item[] = [
    { path: '/contractors', label: 'Contractors', icon: 'buildings' },
    { path: '/camps', label: 'Camps', icon: 'tent', badge: badges.camps },
    { path: '/closeouts', label: 'Audit close-out', icon: 'seal' },
    { path: '/audits', label: 'All inspections', icon: 'clipboard' },
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
        <div className="side-profile">
          <span className="side-avatar" aria-hidden="true">
            {(me.email || 'W').slice(0, 1).toUpperCase()}
          </span>
          <div className="side-who">
            <div className="side-email">{me.email || 'This phone only'}</div>
            <span className="role-chip">{ROLE_LABEL[me.role]}</span>
          </div>
          <button className="round-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="side-rule" />
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
          <div className="side-sync">
            <Icon name="cloud" size={18} />
            {sync ? `Synced ${new Date(sync).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Not synced yet'}
          </div>
          {me.email && (
            <button className="side-item" onClick={() => void me.signOut()}>
              <Icon name="sign-out" size={22} />
              <span className="side-label">Sign out</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}
