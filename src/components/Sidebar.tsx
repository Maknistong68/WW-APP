import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShownLocation } from './RouteTransition'
import Icon, { type IconName } from './Icon'
import IconTile from './IconTile'
import { MENU_HUE, type Hue } from '../lib/hues'
import { ROLE_LABEL, useAuthInfo } from '../lib/auth'
import { campState } from '../lib/camps'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { lastSyncAt } from '../lib/sync'
import { pendingCount } from '../pages/UsersPage'
import { usePresence } from '../lib/usePresence'
import { useBackClose, useFocusTrap } from '../lib/useBackClose'

const OPEN_EVENT = 'ww:sidebar'
/** "MN" from Mark Nieva; else the email's first letter. */
function initials(me: { fullName: string; email: string }): string {
  const words = me.fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length) return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
  return (me.email || 'W').slice(0, 1).toUpperCase()
}

/** Open the drawer from anywhere (the ☰ menu button). */
export const openSidebar = () => window.dispatchEvent(new Event(OPEN_EVENT))

interface Item {
  path: string
  label: string
  icon: IconName
  hue: Hue
  badge?: number
  adminOnly?: boolean
}

/** Menu drawer (tap ☰): who you are, the rest of the app, sync, sign out. */
export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)
  const navigate = useNavigate()
  const { pathname } = useShownLocation()
  const me = useAuthInfo()
  const { mounted, closing } = usePresence(open, 200)
  const after = useRef<number | undefined>(undefined)
  const panel = useRef<HTMLElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => () => window.clearTimeout(after.current), [])
  // The phone's Back closes the drawer; Tab stays inside it.
  const isTop = useBackClose(open, () => setOpen(false))
  useFocusTrap(panel, open, isTop)
  /** Close first, then go: the drawer is gone before the screen slides. */
  const go = (path: string) => {
    setOpen(false)
    window.clearTimeout(after.current)
    after.current = window.setTimeout(() => navigate(path), 160)
  }

  useEffect(() => {
    const on = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && isTop() && setOpen(false)
    document.addEventListener('keydown', onKey)
    if (me.role === 'admin') void pendingCount().then(setPending)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, me.role, isTop])
  // Focus goes to the first menu item on open and back to the menu button on close.
  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLElement>('.side-item')?.focus({ preventScroll: true })
    return () => {
      const back = opener.current
      opener.current = null
      if (back?.isConnected && (!document.activeElement || document.activeElement === document.body || panel.current?.contains(document.activeElement)))
        back.focus({ preventScroll: true })
    }
  }, [open])
  useEffect(() => setOpen(false), [pathname])

  // Read only while the drawer is open: an always-on copy of every table re-ran on each save anywhere.
  const campsDue = useLiveQuery(async () => {
    if (!open) return 0
    const [camps, inspections] = await Promise.all([db.camps.toArray(), db.inspections.toArray()])
    return camps.filter((c) => c.active && ['expired', 'never'].includes(campState(c, inspections).status)).length
  }, [open])
  const badges = { camps: campsDue ?? 0 }

  const items: Item[] = [
    { path: '/contractors', label: 'Contractors', icon: 'buildings', hue: MENU_HUE.contractors },
    { path: '/camps', label: 'Camps', icon: 'tent', hue: MENU_HUE.camps, badge: badges.camps },
    { path: '/closeouts', label: 'Audit close-out', icon: 'seal', hue: MENU_HUE.closeout },
    { path: '/audits', label: 'All inspections', icon: 'clipboard', hue: MENU_HUE.inspections },
    { path: '/settings/log', label: 'Activity log', icon: 'activity', hue: MENU_HUE.activity },
    { path: '/users', label: 'Users', icon: 'shield', hue: MENU_HUE.users, badge: pending, adminOnly: true },
    { path: '/settings', label: 'Settings', icon: 'settings', hue: MENU_HUE.settings },
  ]
  const active = (p: string) => (p === '/' ? pathname === '/' : pathname === p || (p !== '/settings' && pathname.startsWith(`${p}/`)))
  const sync = lastSyncAt()

  if (!mounted) return null
  return (
    <div className={`side-backdrop${closing ? ' closing' : ''}`} onClick={() => setOpen(false)}>
      <nav ref={panel} className="sidebar" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <div className="side-profile">
          <span className="side-avatar" aria-hidden="true">
            {initials(me)}
          </span>
          <div className="side-who">
            <div className="side-email">{me.fullName || me.email || 'This phone only'}</div>
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
              onClick={() => go(i.path)}
            >
              <IconTile icon={i.icon} hue={i.hue} size={36} />
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
              <IconTile icon="sign-out" hue={MENU_HUE.signOut} size={36} />
              <span className="side-label">Sign out</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}
