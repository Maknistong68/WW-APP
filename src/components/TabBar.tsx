import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShownLocation } from './RouteTransition'
import Icon from './Icon'
import TabIcon, { type TabIconName } from './TabIcon'
import { openCreate } from './AddButton'
import { useAuthInfo } from '../lib/auth'
import { useScrollDir } from '../lib/scroll'
import type { NavState } from '../lib/nav'

interface Tab {
  key: TabIconName
  label: string
  path: string
  /** Paths that light this tab. */
  match: (p: string) => boolean
}

const TABS: Tab[] = [
  { key: 'home', label: 'Home', path: '/', match: (p) => p === '/' || p.startsWith('/missing') || p === '/closeouts' },
  { key: 'tickets', label: 'Tickets', path: '/tickets', match: (p) => p.startsWith('/tickets') },
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', match: (p) => p.startsWith('/dashboard') || p.startsWith('/kpis') },
  {
    key: 'library',
    label: 'Library',
    path: '/library',
    match: (p) => ['/library', '/contractors', '/camps', '/audits', '/settings', '/users'].some((x) => p.startsWith(x)),
  },
]

/** Hidden while filling in an inspection (full-screen work) and in 3D. */
const HIDE = ['/new/', '/inspection/', '/dashboard/3d']

/**
 * One UI floating tab bar: a blurred pill with a sliding highlight, and the
 * round Create button beside it. Slides away while you scroll down.
 */
export default function TabBar() {
  const { pathname } = useShownLocation()
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  const dir = useScrollDir()
  const hiddenRoute = HIDE.some((h) => pathname.startsWith(h))
  const active = TABS.findIndex((t) => t.match(pathname))

  if (hiddenRoute) return null
  return (
    <nav className="tabbar" aria-label="Main" data-hidden={dir === 'down' || undefined}>
      <div className="tabbar-pill" style={{ '--n': TABS.length, '--i': Math.max(0, active) } as CSSProperties}>
        <span className="tab-indicator" data-on={active >= 0 || undefined} aria-hidden="true" />
        {TABS.map((t, i) => {
          const on = i === active
          return (
            <button
              key={t.key}
              className={`tab${on ? ' on' : ''}`}
              aria-current={on ? 'page' : undefined}
              onClick={() =>
                on && pathname === t.path
                  ? window.scrollTo({ top: 0, behavior: 'smooth' })
                  : navigate(t.path, { state: { nav: 'tab' } satisfies NavState })
              }
            >
              <span className="tab-icon">
                <TabIcon name={t.key} on={on} />
              </span>
              <span className="tab-label">{t.label}</span>
            </button>
          )
        })}
      </div>
      {canEdit && (
        <button className="tab-fab" aria-label="Create" onClick={openCreate}>
          <Icon name="plus" size={28} strokeWidth={2.4} />
        </button>
      )}
    </nav>
  )
}
