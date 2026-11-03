import { useMemo, useRef, useState } from 'react'
import { useChipScroll } from '../lib/chipScroll'
import { useCachedLiveQuery } from '../lib/useCachedQuery'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { changeLines, fmtWhen } from '../components/History'
import { useContractors } from '../lib/useData'
import type { ActivityEntity, ActivityEntry } from '../types'
import { ACTIONS, PERIODS, filterActivity, type ActionFilter, type Period } from '../lib/activityFilter'
import { displayName, whoName } from '../lib/actor'
import { useTeam } from '../lib/team'
import { useAuthInfo } from '../lib/auth'

const FILTERS: { key: 'all' | ActivityEntity; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ticket', label: 'Tickets' },
  { key: 'contractor', label: 'Contractors' },
  { key: 'kpi', label: 'KPIs' },
  { key: 'audit', label: 'Audits' },
]

const VERB: Record<ActivityEntry['action'], string> = {
  add: 'Added',
  edit: 'Edited',
  close: 'Closed',
  reopen: 'Reopened',
  delete: 'Deleted',
  restore: 'Restored',
  import: 'Imported',
}

const PAGE = 150

export default function ActivityPage() {
  const navigate = useNavigate()
  const { byUuid } = useContractors()
  const [filter, setFilter] = useState<'all' | ActivityEntity>('all')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState<ActionFilter>('all')
  const [period, setPeriod] = useState<Period>('all')
  const [who, setWho] = useState('all')
  const team = useTeam()
  const { userId, role } = useAuthInfo()
  const [limit, setLimit] = useState(PAGE)
  const filterRow = useRef<HTMLDivElement>(null)
  useChipScroll(filterRow, filter)
  const entries = useCachedLiveQuery('activity', () => db.activity.orderBy('time').reverse().toArray())
  // ticket numbers, so a case's link to its D&C ticket reads as the number
  const tickets = useCachedLiveQuery('tickets', () => db.tickets.toArray())
  const ticketNos = useMemo(() => new Map((tickets ?? []).map((t) => [t.uuid, t.ticketNo])), [tickets])

  const visible = useMemo(
    () => filterActivity(entries ?? [], { entity: filter, action, period, query, by: who }),
    [entries, filter, action, period, query, who],
  )

  /** Open what the entry is about (deleted things have nowhere to go). */
  const open = async (e: ActivityEntry) => {
    if (e.action === 'delete') {
      if (e.entity === 'ticket' && role === 'admin') navigate('/tickets/removed')
      return
    }
    const id = e.entityUuid
    switch (e.entity) {
      case 'ticket':
        return navigate(`/tickets/${id}`)
      case 'contractor':
        return navigate(`/contractors/${id}`)
      case 'camp':
        return navigate(`/camps/${id}`)
      case 'site':
      case 'map':
        return navigate('/dashboard/3d')
      case 'routine':
        return navigate('/')
      case 'workOrder': {
        const wo = await db.workOrders.get(id)
        if (wo) navigate(`/contractors/${wo.contractorUuid}`)
        return
      }
      case 'kpi':
      case 'manpower': {
        const row = e.entity === 'kpi' ? await db.kpiMonths.get(id) : await db.manpower.get(id)
        if (row) navigate(`/contractors/${row.contractorUuid}?m=${row.month}`)
        return
      }
      case 'audit': {
        // audits are logged by uuid (or by number for very old entries)
        const ins = (await db.inspections.where('uuid').equals(id).first()) ?? (/^\d+$/.test(id) ? await db.inspections.get(Number(id)) : undefined)
        if (ins?.id !== undefined) navigate(`/inspection/${ins.id}`)
        return
      }
    }
  }

  return (
    <Page title="Activity log" back="/library" backLabel="Library">
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Ticket no., contractor, value" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="segmented scroll" role="group" aria-label="Show" ref={filterRow}>
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'on' : ''} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="list">
        <label className="row">
          <span className="row-label">Action</span>
          <select value={action} onChange={(e) => setAction(e.target.value as ActionFilter)}>
            {ACTIONS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {(team.length > 1 || who !== 'all') && (
          <label className="row">
            <span className="row-label">Who</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Anyone</option>
              {userId && <option value={userId}>You</option>}
              {team
                .filter((m) => m.id !== userId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {displayName(m) || 'Someone'}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="row">
          <span className="row-label">Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="list-foot" style={{ marginTop: 0 }}>
        {visible.length} entr{visible.length === 1 ? 'y' : 'ies'}
      </div>
      {entries && visible.length === 0 ? (
        <div className="empty-state">
          <Icon name="activity" size={44} />
          <b>Nothing yet</b>
          Every add, edit and close shows up here automatically.
        </div>
      ) : (
        <div className="list">
          {visible.slice(0, limit).map((e) => (
            <button key={e.uuid} className="row" onClick={() => void open(e)} style={{ alignItems: 'flex-start' }}>
              <span className="row-main">
                <div className="row-title" style={{ fontSize: 15 }}>
                  {VERB[e.action] ?? e.action} · {e.label}
                  {whoName(e, team, userId) && <span className="by"> · by {whoName(e, team, userId)}</span>}
                </div>
                {e.action === 'edit' || e.action === 'close' || e.action === 'delete'
                  ? changeLines(e.changes, byUuid, ticketNos)
                      .slice(0, 2)
                      .map((line, i) => (
                        <div key={i} className="row-sub">
                          {line}
                        </div>
                      ))
                  : null}
              </span>
              <span className="row-trail" style={{ fontSize: 12.5 }}>
                {fmtWhen(e.time)}
              </span>
            </button>
          ))}
        </div>
      )}
      {visible.length > limit && (
        <button className="btn block" onClick={() => setLimit(limit + PAGE)}>
          Show more ({visible.length - limit})
        </button>
      )}
      <div className="list-foot">Entries can’t be edited or deleted — this is your audit trail.</div>
    </Page>
  )
}
