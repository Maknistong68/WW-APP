import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { localDate, monthName } from '../lib/dates'
import { homeKpis } from '../lib/homeKpis'
import { kpiStatus, pct } from '../lib/kpi'
import { useAllData } from '../lib/kpiData'
import { kpiTone } from '../lib/tone'

/**
 * The ticket log's two KPIs for the running month so far (every followed
 * contractor's D&C tickets): ticket closure and grievance, each with the sum
 * behind it. The same numbers as Home's KPIs; each opens its KPI page.
 */
export default function TicketKpiStrip() {
  const d = useAllData()
  const navigate = useNavigate()
  const today = localDate()
  const k = useMemo(() => (d.loaded ? homeKpis(d, today) : null), [d, today])
  const items = k?.rows.filter((r) => r.soFar) ?? []
  if (!k || items.every((r) => r.soFar!.value === null && r.soFar!.why.startsWith('No'))) return null
  return (
    <section className="tkpi" aria-label={`Ticket KPIs, ${monthName(k.live)} so far`}>
      <div className="tkpi-head">KPIs · {monthName(k.live)} so far</div>
      <div className="tkpi-grid">
        {items.map((r) => (
          <button key={r.key} type="button" className="tkpi-item" onClick={() => navigate(r.soFar!.to)}>
            <span className="tkpi-name">{r.label}</span>
            <span className={`tkpi-num ${kpiTone(kpiStatus(r.soFar!.value))}`}>{pct(r.soFar!.value)}</span>
            <span className="tkpi-why">{r.soFar!.why}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
