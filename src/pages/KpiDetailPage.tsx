import { useMemo, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Sparkline from '../components/Sparkline'
import TrendLine from '../components/charts/TrendLine'
import { workOrderMenu } from '../components/menus'
import { addMonths, monthLabel, monthOf } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct, type KpiStatus } from '../lib/kpi'
import { itemStats, subjectKpis, useAllData, type KpiItemKey } from '../lib/kpiData'
import { kpiTone } from '../lib/tone'
import { useLongPress } from '../lib/useLongPress'

const N = 6

/** A list row that also opens a menu when held. */
function HoldRow({ onOpen, onMore, children }: { onOpen: () => void; onMore?: () => void; children: ReactNode }) {
  const press = useLongPress(onMore)
  return (
    <button className="row" onClick={onOpen} {...press}>
      {children}
    </button>
  )
}

/** One KPI item across every active work order / contractor, with each one's trend. */
export default function KpiDetailPage() {
  const { key = 'submission' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const d = useAllData()
  const thisMonth = monthOf()
  const mParam = params.get('m')
  const month = mParam && /^\d{4}-\d{2}$/.test(mParam) ? mParam : thisMonth
  const only = (params.get('s') as KpiStatus | null) ?? null
  const setLink = (k: 'm' | 's', v: string | null) => {
    const next = new URLSearchParams(params)
    if (v === null) next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }
  const setMonth = (m: string) => setLink('m', m === thisMonth ? null : m)
  const toggle = (s: KpiStatus) => {
    haptic('tick')
    setLink('s', only === s ? null : s)
  }
  const part = KPI_PARTS.find((p) => p.key === key)
  const itemKey = (part?.key ?? 'overall') as KpiItemKey
  const title = part?.label ?? 'Overall KPI'

  // The last 6 months for every subject, oldest first (the chosen month last).
  const months = useMemo(() => Array.from({ length: N }, (_, i) => addMonths(month, i - N + 1)), [month])
  const history = useMemo(() => months.map((m) => subjectKpis(d, m)), [d, months])
  const rows = history[N - 1]
  const stats = itemStats(rows, itemKey)
  const trend = months.map((m, i) => {
    const avg = itemStats(history[i], itemKey).avg
    return { date: `${m}-01`, value: avg === null ? null : Math.round(avg) }
  })
  /** Each subject's values over the 6 months. */
  const seriesOf = (subjectKey: string) =>
    history.map((list) => {
      const v = list.find((r) => r.subject.key === subjectKey)?.result[itemKey]
      return v === null || v === undefined ? null : Math.round(v)
    })
  const ranked = [...rows]
    .filter((r) => !only || kpiStatus(r.result[itemKey]) === only)
    .sort((a, b) => (a.result[itemKey] ?? 101) - (b.result[itemKey] ?? 101))

  return (
    <Page title={title} back={`/dashboard?v=kpis${month !== thisMonth ? `&m=${month}` : ''}`} backLabel="KPIs">
      <div className="segmented" style={{ gridTemplateColumns: '44px 1fr 44px', display: 'grid', gridAutoFlow: 'unset' }}>
        <button aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <button className="on">{monthLabel(month)}</button>
        <button aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>

      <div className="hero-row">
        <div className="hero">
          <div className={`hero-num ${kpiStatus(stats.avg)}`}>{pct(stats.avg)}</div>
          <div className="hero-label">Average</div>
        </div>
        <button className={`hero live${only === 'good' ? ' on' : ''}`} aria-pressed={only === 'good'} onClick={() => toggle('good')}>
          <div className="hero-num good">{stats.good}</div>
          <div className="hero-label">
            On track ≥90%
            <Icon name="chevron-right" size={14} strokeWidth={2.6} className="hero-chev" />
          </div>
        </button>
        <button className={`hero live${only === 'bad' ? ' on' : ''}`} aria-pressed={only === 'bad'} onClick={() => toggle('bad')}>
          <div className={`hero-num${stats.bad ? ' bad' : ''}`}>{stats.bad}</div>
          <div className="hero-label">
            Critical &lt;70%
            <Icon name="chevron-right" size={14} strokeWidth={2.6} className="hero-chev" />
          </div>
        </button>
      </div>

      <div className="chart-card">
        <div className="chart-title">Average · last 6 months</div>
        <div className="chart-sub">% · tap a month to open it</div>
        <TrendLine
          data={trend}
          unit="%"
          mode="month"
          max={100}
          guides={[
            { value: 90, tone: 'good' },
            { value: 70, tone: 'bad' },
          ]}
          toneOf={(v) => kpiTone(kpiStatus(v))}
          onOpen={(i) => setMonth(months[i])}
          openLabel="Show"
        />
      </div>

      <button className="compare-link" style={{ marginBottom: 6 }} onClick={() => navigate(`/compare${itemKey === 'overall' ? '' : `?k=${itemKey}`}`)}>
        Compare month by month ›
      </button>

      <div className="section-label">
        {only ? `${STATUS_LABEL[only]} · ${ranked.length}` : `Worst first · ${rows.length}`}
        {only && (
          <button className="clear-btn" style={{ marginLeft: 8, color: 'var(--brand)', fontWeight: 600 }} onClick={() => toggle(only)}>
            Show all
          </button>
        )}
      </div>
      <div className="list">
        {ranked.map(({ subject, result }) => {
          const v = result[itemKey]
          const st = kpiStatus(v)
          const series = seriesOf(subject.key)
          const prev = series[N - 2]
          const now = series[N - 1]
          const change = now !== null && prev !== null ? now - prev : null
          return (
            <HoldRow
              key={subject.key}
              onOpen={() => navigate(`/contractors/${subject.contractor.uuid}?m=${month}`)}
              onMore={subject.workOrder ? () => workOrderMenu({ ...subject, workOrder: subject.workOrder! }, { month }) : undefined}
            >
              <span className={`status-dot ${st}`} />
              <span className="row-main">
                <div className="row-title">{subject.label}</div>
                <div className="row-sub">
                  {STATUS_LABEL[st]}
                  {change !== null && change !== 0 && ` · ${change > 0 ? '▲' : '▼'} ${Math.abs(change)} since ${monthLabel(months[N - 2]).slice(0, 3)}`}
                </div>
              </span>
              <Sparkline values={series} label={`${subject.label}, last 6 months`} tone={kpiTone(st)} width={52} height={26} guide={90} />
              <span className="row-trail" style={{ minWidth: 44, textAlign: 'right' }}>
                {pct(v)}
              </span>
              <span className="row-chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </HoldRow>
          )
        })}
      </div>
      {part?.auto && <div className="list-foot">Calculated automatically from tickets / manpower.</div>}
      <div className="list-foot">Hold a work order to fill it in or see its workers.</div>
    </Page>
  )
}
