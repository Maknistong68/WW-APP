import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import CountUp from './CountUp'
import StatusChip from './StatusChip'
import { monthLabel, monthName } from '../lib/dates'
import { kpiStatus, pct } from '../lib/kpi'
import { kpiTone } from '../lib/tone'
import type { HomeKpis as HomeKpisData } from '../lib/homeKpis'

const shortMonth = (m: string) => monthLabel(m).slice(0, 3)

/**
 * Home's KPIs: last month's overall score (big, in its status colour) with the
 * work orders on track / at risk / critical, then the three KPIs the app works
 * out by itself, each with what it's made of. Every number opens its KPI page.
 */
export default function HomeKpis({ k }: { k: HomeKpisData }) {
  const navigate = useNavigate()
  const tone = kpiTone(kpiStatus(k.overall.avg))
  const counts = [
    { s: 'good' as const, n: k.overall.good, word: 'on track' },
    { s: 'warn' as const, n: k.overall.warn, word: 'at risk' },
    { s: 'bad' as const, n: k.overall.bad, word: 'critical' },
  ].filter((c) => c.n > 0)
  return (
    <section className="hkpis" aria-label="KPIs">
      <h2 className="clist-head">KPIs · {monthName(k.month)}</h2>
      <div className="hkpi-card">
        <div className="hkpi-top">
          <button type="button" className="hkpi-overall" onClick={() => navigate(k.overallTo)} aria-label={`Overall KPI ${pct(k.overall.avg)}`}>
            <span className={`hkpi-num ${tone}`}>
              <CountUp value={pct(k.overall.avg)} />
            </span>
            <span className="hkpi-label">Overall</span>
          </button>
          <div className="hkpi-counts" role="group" aria-label="Work orders by status">
            {counts.map((c) => (
              <button key={c.s} type="button" className="hkpi-count" onClick={() => navigate(`${k.overallTo}&s=${c.s}`)}>
                <StatusChip tone={c.s}>
                  {c.n} {c.word}
                </StatusChip>
              </button>
            ))}
          </div>
        </div>
        {k.rows.map((r) => (
          <div key={r.key} className="hkpi-row">
            <button type="button" className="hkpi-row-main" onClick={() => navigate(r.to)}>
              <span className="hkpi-row-text">
                <span className="hkpi-row-name">{r.label}</span>
                <span className="hkpi-row-why">{r.why}</span>
              </span>
              <StatusChip tone={kpiTone(kpiStatus(r.value))} icon={false}>
                {pct(r.value)}
              </StatusChip>
              <Icon name="chevron-right" size={18} className="hkpi-chev" />
            </button>
            {r.soFar && (
              <button type="button" className="hkpi-sofar" onClick={() => navigate(r.soFar!.to)}>
                {shortMonth(k.live)} so far <b>{pct(r.soFar.value)}</b>
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
