import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { changeText, fmtWhen } from '../components/History'
import { useContractors } from '../lib/useData'
import type { ActivityEntity, ActivityEntry } from '../types'
import { ACTIONS, PERIODS, filterActivity, type ActionFilter, type Period } from '../lib/activityFilter'

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
  const [limit, setLimit] = useState(PAGE)
  const entries = useLiveQuery(() => db.activity.orderBy('time').reverse().toArray())

  const visible = useMemo(
    () => filterActivity(entries ?? [], { entity: filter, action, period, query }),
    [entries, filter, action, period, query],
  )

  const open = (e: ActivityEntry) => {
    if (e.action === 'delete') return
    if (e.entity === 'ticket') navigate(`/tickets/${e.entityUuid}`)
    else if (e.entity === 'contractor') navigate(`/contractors/${e.entityUuid}`)
  }

  return (
    <Page title="Activity log" back="/library" backLabel="Library">
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Ticket no., contractor, value" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="segmented">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
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
            <button key={e.uuid} className="row" onClick={() => open(e)} style={{ alignItems: 'flex-start' }}>
              <span className="row-main">
                <div className="row-title" style={{ fontSize: 15 }}>
                  {VERB[e.action]} · {e.label}
                </div>
                {e.action === 'edit' || e.action === 'close'
                  ? e.changes.slice(0, 2).map((c) => (
                      <div key={c.field} className="row-sub">
                        {changeText(c, byUuid)}
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
