import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page, { SettingsButton } from '../components/Page'
import Icon from '../components/Icon'
import ContractorSheet from '../components/ContractorSheet'
import { isOpen } from '../lib/aging'
import { monthLabel, monthOf } from '../lib/dates'
import { pct } from '../lib/kpi'
import { kpisForMonth, useAllData } from '../lib/kpiData'
import { newContractor } from '../lib/useData'
import type { Contractor } from '../types'

export default function ContractorsPage() {
  const navigate = useNavigate()
  const d = useAllData()
  const month = monthOf()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<Contractor | null>(null)
  const kpis = useMemo(() => kpisForMonth(d, month), [d, month])

  const q = query.trim().toLowerCase()
  const match = (c: Contractor) => !q || [c.name, c.workOrder, ...c.aliases].some((s) => s.toLowerCase().includes(q))
  const openCount = (uuid: string) => d.tickets.filter((t) => t.contractorUuid === uuid && isOpen(t)).length
  const active = d.contractors.filter((c) => c.active && match(c))
  const inactive = d.contractors.filter((c) => !c.active && match(c))

  const row = (c: Contractor) => {
    const r = kpis.get(c.uuid)
    const open = openCount(c.uuid)
    return (
      <button key={c.uuid} className="row" onClick={() => navigate(`/contractors/${c.uuid}`)}>
        <span className={`status-dot ${c.active ? (r?.status ?? 'none') : 'none'}`} aria-hidden="true" />
        <span className="row-main">
          <div className="row-title">{c.name}</div>
          <div className="row-sub">
            {open} open ticket{open === 1 ? '' : 's'}
            {c.workOrder ? ` · WO ${c.workOrder}` : ''}
          </div>
        </span>
        <span className="row-trail">{pct(r?.overall)}</span>
        <span className="row-chev">
          <Icon name="chevron-right" size={18} />
        </span>
      </button>
    )
  }

  return (
    <Page
      title="Contractors"
      actions={
        <>
          <button className="nav-btn" aria-label="New contractor" onClick={() => setAdding(newContractor())}>
            <Icon name="plus" size={26} />
          </button>
          <SettingsButton />
        </>
      }
    >
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {d.loaded && d.contractors.length === 0 ? (
        <div className="empty-state">
          <Icon name="users" size={44} />
          <b>No contractors yet</b>
          Tap + or import your history in Settings.
        </div>
      ) : (
        <>
          <div className="section-label">KPI tracked · {monthLabel(month)}</div>
          <div className="list">{active.map(row)}</div>
          {inactive.length > 0 && (
            <>
              <div className="section-label">Not tracked · tickets only</div>
              <div className="list">{inactive.map(row)}</div>
            </>
          )}
          <div className="list-foot">🟢 90%+ on track · 🟡 70%+ at risk · 🔴 below 70% critical</div>
        </>
      )}
      {adding && <ContractorSheet contractor={adding} onClose={() => setAdding(null)} />}
    </Page>
  )
}
