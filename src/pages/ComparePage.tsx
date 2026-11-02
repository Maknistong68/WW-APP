import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import CompareGrid from '../components/CompareGrid'
import { contractorMenu, workOrderMenu } from '../components/menus'
import { columnAverages, compareRows, sortRows, type CompareBy, type CompareRow } from '../lib/compare'
import { lastMonths } from '../lib/dashboard'
import { localDate, monthLabel } from '../lib/dates'
import { lastEndedMonth } from '../lib/due'
import { haptic } from '../lib/haptics'
import { KPI_PARTS } from '../lib/kpi'
import { kpisForMonth, useAllData, type KpiItemKey } from '../lib/kpiData'
import { kpiSubjects } from '../lib/subjects'
import { contractorOverall } from '../lib/trends'

const ITEMS: { key: KpiItemKey; label: string }[] = [{ key: 'overall', label: 'Overall' }, ...KPI_PARTS.map((p) => ({ key: p.key as KpiItemKey, label: p.label }))]

/** Every contractor (or work order) month by month on one KPI. Pattern: Analytics. */
export default function ComparePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const d = useAllData()
  const key = (ITEMS.some((i) => i.key === params.get('k')) ? params.get('k') : 'overall') as KpiItemKey
  const range = params.get('r') === '1y' ? 12 : 6
  const by: CompareBy = params.get('by') === 'wo' ? 'workOrder' : 'contractor'
  const order = params.get('s') === 'name' ? 'name' : 'worst'
  const set = (k: 'k' | 'r' | 'by' | 's', v: string | null) => {
    haptic('tick')
    const next = new URLSearchParams(params)
    if (v === null) next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }
  const end = lastEndedMonth(localDate())
  const months = useMemo(() => lastMonths(end, range), [end, range])
  const rows = useMemo(() => (d.loaded ? sortRows(compareRows(d, months, key, by), order) : []), [d, months, key, by, order])
  const averages = columnAverages(rows, months.length)
  const item = ITEMS.find((i) => i.key === key)!
  const critical = rows.filter((r) => r.latest !== null && r.latest < 70).length

  const openCell = (r: CompareRow, m: string) => navigate(`/contractors/${r.contractorUuid}?m=${m}`)
  const openRow = (r: CompareRow) => navigate(`/contractors/${r.contractorUuid}?tab=trends${r.workOrderUuid ? `&wo=${r.workOrderUuid}` : ''}`)
  const holdRow = (r: CompareRow) => {
    const c = d.byUuid.get(r.contractorUuid)
    if (!c) return
    if (r.workOrderUuid) {
      const s = kpiSubjects([c], d.workOrders).find((x) => x.workOrder?.uuid === r.workOrderUuid)
      if (s?.workOrder) return workOrderMenu({ ...s, workOrder: s.workOrder }, { month: end })
    }
    contractorMenu(c, {
      subjects: kpiSubjects([c], d.workOrders),
      kpi: kpisForMonth(d, end).get(c.uuid),
      kpiMonth: end,
      openTickets: d.tickets.filter((t) => t.contractorUuid === c.uuid && t.status !== 'Closed').length,
      spark: contractorOverall(d, c, lastMonths(end, 6)),
    })
  }

  return (
    <Page title="Compare" back="/dashboard?v=kpis" backLabel="KPIs">
      <div className="pill-row scroll" role="group" aria-label="KPI">
        {ITEMS.map((i) => (
          <button key={i.key} className={`pill${key === i.key ? ' on' : ''}`} aria-pressed={key === i.key} onClick={() => set('k', i.key === 'overall' ? null : i.key)}>
            {i.label}
          </button>
        ))}
      </div>
      <div className="pill-row" role="group" aria-label="Range and rows">
        <button className={`pill${range === 6 ? ' on' : ''}`} aria-pressed={range === 6} onClick={() => set('r', null)}>
          6 months
        </button>
        <button className={`pill${range === 12 ? ' on' : ''}`} aria-pressed={range === 12} onClick={() => set('r', '1y')}>
          1 year
        </button>
        <button className={`pill${by === 'contractor' ? ' on' : ''}`} aria-pressed={by === 'contractor'} onClick={() => set('by', null)}>
          Contractors
        </button>
        <button className={`pill${by === 'workOrder' ? ' on' : ''}`} aria-pressed={by === 'workOrder'} onClick={() => set('by', 'wo')}>
          Work orders
        </button>
      </div>

      <div className="chart-card">
        <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span>{item.label}</span>
          <button className="clear-btn" style={{ color: 'var(--brand)', fontWeight: 600, padding: 4 }} onClick={() => set('s', order === 'worst' ? 'name' : null)}>
            {order === 'worst' ? 'Worst first' : 'A–Z'} ⇅
          </button>
        </div>
        <div className="chart-sub">
          {rows.length} {by === 'contractor' ? 'contractor' : 'work order'}
          {rows.length === 1 ? '' : 's'} · {critical} critical in {monthLabel(end).slice(0, 3)} · tap a cell, hold a name
        </div>
        {d.loaded && rows.length === 0 ? (
          <div className="note">No active contractors yet.</div>
        ) : (
          <CompareGrid
            rows={rows}
            months={months}
            averages={averages}
            onOpenCell={openCell}
            onOpenRow={openRow}
            onHoldRow={holdRow}
            label={`${item.label} by ${by === 'contractor' ? 'contractor' : 'work order'}, ${months.length} months`}
          />
        )}
        <div className="cmp-legend" aria-hidden="true">
          <span><i className="good" />On track ≥90</span>
          <span><i className="warn" />At risk 70–89</span>
          <span><i className="bad" />Critical &lt;70</span>
          <span><i className="none" />– no data</span>
        </div>
      </div>
      <div className="list-foot">Months up to {monthLabel(end)}, the last month that ended.</div>
    </Page>
  )
}
