import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import TrendLine from '../components/charts/TrendLine'
import { addMonths, monthLabel, monthOf } from '../lib/dates'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct } from '../lib/kpi'
import { itemStats, subjectKpis, useAllData, type KpiItemKey } from '../lib/kpiData'

/** One KPI item across every active work order / contractor. */
export default function KpiDetailPage() {
  const { key = 'submission' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const d = useAllData()
  const [month, setMonth] = useState(params.get('m') || monthOf())
  const part = KPI_PARTS.find((p) => p.key === key)
  const itemKey = (part?.key ?? 'overall') as KpiItemKey
  const title = part?.label ?? 'Overall KPI'

  const rows = useMemo(() => subjectKpis(d, month), [d, month])
  const stats = itemStats(rows, itemKey)
  const ranked = [...rows].sort((a, b) => (a.result[itemKey] ?? 101) - (b.result[itemKey] ?? 101))
  const trend = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)).map((m) => {
        const avg = itemStats(subjectKpis(d, m), itemKey).avg
        return { date: `${m}-01`, value: avg === null ? null : Math.round(avg) }
      }),
    [d, month, itemKey],
  )

  return (
    <Page title={title} back="/dashboard?v=kpis" backLabel="KPIs">
      <div className="segmented" style={{ gridTemplateColumns: '44px 1fr 44px', display: 'grid', gridAutoFlow: 'unset' }}>
        <button aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <button className="on">{monthLabel(month)}</button>
        <button aria-label="Next month" disabled={month >= monthOf()} onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>

      <div className="hero-row">
        <div className="hero">
          <div className={`hero-num ${kpiStatus(stats.avg)}`}>{pct(stats.avg)}</div>
          <div className="hero-label">Average</div>
        </div>
        <div className="hero">
          <div className="hero-num good">{stats.good}</div>
          <div className="hero-label">On track ≥90%</div>
        </div>
        <div className="hero">
          <div className={`hero-num${stats.bad ? ' bad' : ''}`}>{stats.bad}</div>
          <div className="hero-label">Critical &lt;70%</div>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-title">Average · last 6 months</div>
        <div className="chart-sub">%</div>
        <TrendLine data={trend} unit="%" />
      </div>

      <div className="section-label">Worst first · {rows.length}</div>
      <div className="list">
        {ranked.map(({ subject, result }) => {
          const v = result[itemKey]
          const st = kpiStatus(v)
          return (
            <button key={subject.key} className="row" onClick={() => navigate(`/contractors/${subject.contractor.uuid}`)}>
              <span className={`status-dot ${st}`} />
              <span className="row-main">
                <div className="row-title">{subject.label}</div>
                <div className="row-sub">{STATUS_LABEL[st]}</div>
              </span>
              <span className="row-trail">{pct(v)}</span>
              <span className="row-chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
          )
        })}
      </div>
      {part?.auto && <div className="list-foot">Calculated automatically from tickets / manpower.</div>}
    </Page>
  )
}
