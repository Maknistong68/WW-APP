import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Cover from '../components/Cover'
import MediaRow from '../components/MediaRow'
import { showActions } from '../components/ActionSheet'
import { SubjectEditor } from '../components/SubjectPicker'
import { kpiSubjects, type KpiSubject } from '../lib/subjects'
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
  const [scoring, setScoring] = useState<KpiSubject | null>(null)
  const kpis = useMemo(() => kpisForMonth(d, month), [d, month])

  const q = query.trim().toLowerCase()
  const wosOf = (uuid: string) => d.workOrders.filter((w) => w.contractorUuid === uuid)
  const match = (c: Contractor) =>
    !q || [c.name, ...c.aliases, ...wosOf(c.uuid).map((w) => w.number)].some((s) => s.toLowerCase().includes(q))
  const openCount = (uuid: string) => d.tickets.filter((t) => t.contractorUuid === uuid && isOpen(t)).length
  const active = d.contractors.filter((c) => c.active && match(c))
  const inactive = d.contractors.filter((c) => !c.active && match(c))

  const more = (c: Contractor) => {
    const subjects = kpiSubjects([c], d.workOrders)
    showActions({
      title: c.name,
      sub: `KPI ${pct(kpis.get(c.uuid)?.overall)} · ${monthLabel(month)}`,
      cover: <Cover section="contractors" seed={c.name} text={c.name} size={56} />,
      actions: [
        { label: 'Open', icon: 'arrow-right', onSelect: () => navigate(`/contractors/${c.uuid}`) },
        ...subjects.slice(0, 4).map((s) => ({
          label: `Score ${s.workOrder ? `WO ${s.workOrder.number}` : 'this month'}`,
          icon: 'gauge' as const,
          onSelect: () => setScoring(s),
          edit: true,
        })),
        { label: 'Edit details', icon: 'pencil', onSelect: () => setAdding(c), edit: true },
      ],
    })
  }

  const row = (c: Contractor) => {
    const r = kpis.get(c.uuid)
    const open = openCount(c.uuid)
    const wos = wosOf(c.uuid)
    const on = wos.filter((w) => w.active).length
    return (
      <MediaRow
        key={c.uuid}
        cover={<Cover section="contractors" seed={c.name} text={c.name} size={48} />}
        title={c.name}
        sub={`${wos.length ? `${on}/${wos.length} WO active · ` : ''}${open} open ticket${open === 1 ? '' : 's'}`}
        trail={
          c.active && r?.overall != null ? (
            <span className={`status-chip ${r.status === 'none' ? '' : r.status}`}>{pct(r.overall)}</span>
          ) : (
            <span className="row-trail">{c.active ? '—' : 'Inactive'}</span>
          )
        }
        onOpen={() => navigate(`/contractors/${c.uuid}`)}
        onMore={() => more(c)}
      />
    )
  }

  return (
    <Page
      title="Contractors"
      back="/library"
      backLabel="Library"
      actions={
        <>
          <button className="nav-btn" aria-label="New contractor" onClick={() => setAdding(newContractor())}>
            <Icon name="plus" size={26} />
          </button>
        </>
      }
    >
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Name or work order" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {d.loaded && d.contractors.length === 0 ? (
        <div className="empty-state">
          <Icon name="users" size={44} />
          <b>No contractors yet</b>
          Tap + to add one.
        </div>
      ) : (
        <>
          <div className="section-label">Active · KPI {monthLabel(month)}</div>
          <div className="list">{active.map(row)}</div>
          {inactive.length > 0 && (
            <>
              <div className="section-label">Inactive</div>
              <div className="list">{inactive.map(row)}</div>
            </>
          )}
          <div className="list-foot">KPI this month: green 90%+ · amber 70%+ · red below 70%. Hold a contractor for more.</div>
        </>
      )}
      {adding && <ContractorSheet contractor={adding} onClose={() => setAdding(null)} />}
      {scoring && <SubjectEditor d={d} subject={scoring} month={month} sheet="kpi" onClose={() => setScoring(null)} />}
    </Page>
  )
}
