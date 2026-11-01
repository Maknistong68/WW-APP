import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import BigCard from '../components/BigCard'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import type { IconName } from '../components/Icon'
import { db } from '../db'
import { useAuthInfo } from '../lib/auth'
import { campState } from '../lib/camps'
import { closeoutTotals, closeouts } from '../lib/closeout'
import { useAllData } from '../lib/kpiData'
import { kpiSubjects } from '../lib/subjects'
import { MENU_HUE, type Hue } from '../lib/hues'
import { pendingCount } from './UsersPage'

interface Shelf {
  path: string
  title: string
  sub: string
  hue: Hue
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
      { path: '/contractors', title: 'Contractors', sub: `${active.length} active · ${wos.length} work orders`, hue: MENU_HUE.contractors, icon: 'buildings' },
      {
        path: '/camps',
        title: 'Camps',
        sub: `${camps.length} camps`,
        hue: MENU_HUE.camps,
        icon: 'tent',
        alert: late ? `${late} overdue` : undefined,
      },
      {
        path: '/closeouts',
        title: 'Audit close-out',
        sub: co.findings ? `${co.open} of ${co.findings} findings open` : 'No findings logged',
        hue: MENU_HUE.closeout,
        icon: 'seal',
        alert: co.overdue ? `${co.overdue} overdue` : undefined,
      },
      { path: '/audits', title: 'All inspections', sub: `${d.inspections.length} inspections`, hue: MENU_HUE.inspections, icon: 'clipboard' },
      { path: '/settings/log', title: 'Activity log', sub: `${activity ?? 0} changes recorded`, hue: MENU_HUE.activity, icon: 'activity' },
    ]
    if (me.role === 'admin')
      list.push({
        path: '/users',
        title: 'Users',
        sub: 'Approve people and set roles',
        hue: MENU_HUE.users,
        icon: 'shield',
        alert: pending ? `${pending} waiting` : undefined,
      })
    list.push({ path: '/settings', title: 'Settings', sub: 'Sync, password, backup', hue: MENU_HUE.settings, icon: 'settings' })
    return list
  }, [d, activity, me.role, pending])

  return (
    <Page title="Library">
      <div className="bgrid two stagger">
        {shelves.map((s) => (
          <BigCard
            key={s.path}
            tile={<IconTile icon={s.icon} hue={s.hue} size={64} />}
            title={s.title}
            sub={
              <>
                {s.sub}
                {s.alert && (
                  <span style={{ display: 'block', marginTop: 8 }}>
                    <StatusChip tone="bad">{s.alert}</StatusChip>
                  </span>
                )}
              </>
            }
            onOpen={() => navigate(s.path)}
          />
        ))}
      </div>
    </Page>
  )
}
