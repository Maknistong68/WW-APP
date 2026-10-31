import { useLocation, useNavigate } from 'react-router-dom'
import Icon, { type IconName } from './Icon'
import { openCreate } from './AddButton'
import { useAuthInfo } from '../lib/auth'

interface Tab {
  key: string
  label: string
  icon: IconName
  path?: string
  /** Paths that light this tab. */
  match?: (p: string) => boolean
}

const TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: 'home', path: '/', match: (p) => p === '/' || p.startsWith('/missing') || p === '/closeouts' },
  { key: 'tickets', label: 'Tickets', icon: 'ticket', path: '/tickets', match: (p) => p.startsWith('/tickets') },
  { key: 'create', label: 'Create', icon: 'plus' },
  { key: 'dashboard', label: 'Dashboard', icon: 'chart', path: '/dashboard', match: (p) => p.startsWith('/dashboard') || p.startsWith('/kpis') },
  {
    key: 'library',
    label: 'Library',
    icon: 'library',
    path: '/library',
    match: (p) => ['/library', '/contractors', '/camps', '/audits', '/settings', '/users'].some((x) => p.startsWith(x)),
  },
]

/** Hidden while filling in an inspection (full-screen work). */
const HIDE = ['/new/', '/inspection/']

/** Spotify-style bottom bar: Home · Tickets · Create · Dashboard · Library. */
export default function TabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  if (HIDE.some((h) => pathname.startsWith(h))) return null
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.filter((t) => t.key !== 'create' || canEdit).map((t) => {
        const on = !!t.match?.(pathname)
        return (
          <button
            key={t.key}
            className={`tab${on ? ' on' : ''}${t.key === 'create' ? ' create' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => (t.path ? navigate(t.path) : openCreate())}
          >
            <span className="tab-icon">
              <Icon name={t.icon} size={26} fill={on} strokeWidth={t.key === 'create' ? 2.4 : 2} />
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
