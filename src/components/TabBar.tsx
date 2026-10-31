import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { ageDays, isOpen } from '../lib/aging'
import Icon, { type IconName } from './Icon'

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'Today', icon: 'home' },
  { path: '/tickets', label: 'Tickets', icon: 'ticket' },
  { path: '/contractors', label: 'Contractors', icon: 'users' },
  { path: '/audits', label: 'Audits', icon: 'clipboard' },
  { path: '/dashboard', label: 'Dashboard', icon: 'chart' },
]

/** Routes that own the full screen (audit checklist with its own FABs). */
const HIDDEN = [/^\/inspection\//, /^\/new\//]

export default function TabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const overdue = useLiveQuery(async () => {
    const open = await db.tickets.where('status').notEqual('Closed').toArray()
    return open.filter((t) => isOpen(t) && ageDays(t) > 30).length
  })
  if (HIDDEN.some((r) => r.test(pathname))) return null
  const active = (p: string) =>
    p === '/'
      ? pathname === '/'
      : pathname === p || pathname.startsWith(`${p}/`) || (p === '/dashboard' && pathname.startsWith('/kpis'))
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.path}
          className={`tab-item${active(t.path) ? ' active' : ''}`}
          aria-current={active(t.path) ? 'page' : undefined}
          onClick={() => navigate(t.path)}
        >
          <Icon name={t.icon} size={25} strokeWidth={active(t.path) ? 2.2 : 1.8} />
          {t.label}
          {t.path === '/tickets' && !!overdue && <span className="tab-badge">{overdue}</span>}
        </button>
      ))}
    </nav>
  )
}
