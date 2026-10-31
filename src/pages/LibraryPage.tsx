import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Cover from '../components/Cover'
import MediaRow from '../components/MediaRow'
import Icon, { type IconName } from '../components/Icon'
import { db } from '../db'
import { useAuthInfo } from '../lib/auth'
import { campState } from '../lib/camps'
import { closeoutTotals, closeouts } from '../lib/closeout'
import { useAllData } from '../lib/kpiData'
import { kpiSubjects } from '../lib/subjects'
import type { Section } from '../lib/art'
import { pendingCount } from './UsersPage'

interface Shelf {
  path: string
  title: string
  sub: string
  section: Section
  icon: IconName
  alert?: string
}

/** Everything that isn't a daily tab: contractors, camps, inspections, logs. */
export default function LibraryPage() {
  const navigate = useNavigate()
  const me = useAuthInfo()
  const d = useAllData()
  const activity = useLiveQuery(() => db.activity.count())
  const [pending, setPending] = useState(0)
  useEffect(() => {
    if (me.role === 'admin') void pendingCount().then(setPending)
  }, [me.role])

  const shelves = useMemo<Shelf[]>(() => {
    const active = d.contractors.filter((c) => c.active)
    const wos = d.workOrders.filter((w) => w.active)
    const camps = d.camps.filter((c) => c.active)
    const late = camps.filter((c) => ['expired', 'never'].includes(campState(c, d.inspections).status)).length
    const co = closeoutTotals(closeouts(kpiSubjects(d.contractors, d.workOrders), d.kpis))
    const list: Shelf[] = [
      { path: '/contractors', title: 'Contractors', sub: `${active.length} active · ${wos.length} work orders`, section: 'contractors', icon: 'buildings' },
      {
        path: '/camps',
        title: 'Camps',
        sub: `${camps.length} camps`,
        section: 'camps',
        icon: 'tent',
        alert: late ? `${late} overdue` : undefined,
      },
      {
        path: '/closeouts',
        title: 'Audit close-out',
        sub: co.findings ? `${co.open} of ${co.findings} findings open` : 'No findings logged',
        section: 'closeout',
        icon: 'seal',
        alert: co.overdue ? `${co.overdue} overdue` : undefined,
      },
      { path: '/audits', title: 'All inspections', sub: `${d.inspections.length} inspections`, section: 'library', icon: 'clipboard' },
      { path: '/settings/log', title: 'Activity log', sub: `${activity ?? 0} changes recorded`, section: 'dashboard', icon: 'activity' },
    ]
    if (me.role === 'admin')
      list.push({
        path: '/users',
        title: 'Users',
        sub: 'Approve people and set roles',
        section: 'users',
        icon: 'shield',
        alert: pending ? `${pending} waiting` : undefined,
      })
    list.push({ path: '/settings', title: 'Settings', sub: 'Sync, password, backup', section: 'settings', icon: 'settings' })
    return list
  }, [d, activity, me.role, pending])

  return (
    <Page title="Library">
      <div className="shelf-list">
        {shelves.map((s) => (
          <MediaRow
            key={s.path}
            className="big"
            cover={<Cover section={s.section} icon={s.icon} size={64} />}
            title={s.title}
            sub={s.sub}
            trail={
              s.alert ? (
                <span className="status-chip bad">{s.alert}</span>
              ) : (
                <Icon name="chevron-right" size={20} className="mrow-chev" />
              )
            }
            onOpen={() => navigate(s.path)}
          />
        ))}
      </div>
    </Page>
  )
}
