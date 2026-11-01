import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import StatusChip from '../components/StatusChip'
import TrendLine from '../components/charts/TrendLine'
import { localDate, monthLabel } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct } from '../lib/kpi'
import { useAllData, type KpiItemKey } from '../lib/kpiData'
import { ticketLink } from '../lib/ticketFilter'
import { kpiTone } from '../lib/tone'
import { contractorKpiSeries, itemInputs, trendMonths, type TrendRange } from '../lib/trends'

/** How each KPI item is scored, in one or two short sentences. */
const RULE: Record<KpiItemKey, string> = {
  submission: 'WPS, manpower and salary declarations: all three in 100%, some 50%, none 0%.',
  accommodation: 'Accommodation score typed in, or the score of that month’s audit.',
  onboarding: 'Onboarding score typed in each month.',
  offboarding: 'Workers offboarded on time out of all offboarded.',
  grievance: 'Average days to close the tickets closed that month. Up to 10 days 100% · 15 days 90% · 20 days 80% · 30 days 70% · over 30 days 0%.',
  formal: 'Formal workers out of all declared workers; illegal / freelance count against it.',
  closure: 'Tickets closed in the month out of the tickets open at any point in it.',
  meeting: 'Meeting attendance typed in each month.',
  quarterly: 'The quarterly audit score (shown, not averaged into the overall).',
  overall: 'The average of the KPI items that have a value.',
}

const RANGES: { key: TrendRange; label: string }[] = [
  { key: '6m', label: '6 months' },
  { key: '1y', label: '1 year' },
  { key: 'all', label: 'All' },
]

/** One KPI item for one contractor over time, with what made each month's score. */
export default function ContractorKpiPage() {
  const { uuid = '', key = 'overall' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const d = useAllData()
  const c = d.byUuid.get(uuid)
  const range = (['6m', '1y', 'all'].includes(params.get('r') ?? '') ? params.get('r') : '1y') as TrendRange
  const wo = params.get('wo') || undefined
  const part = KPI_PARTS.find((p) => p.key === key)
  const itemKey = (part?.key ?? 'overall') as KpiItemKey
  const title = part?.label ?? 'Overall KPI'
  const today = localDate()
  const months = useMemo(() => (c ? trendMonths(d, c, range, today) : []), [d, c, range, today])
  const values = useMemo(() => (c ? contractorKpiSeries(d, c, months, wo)[itemKey] : []), [d, c, months, wo, itemKey])

  if (!d.loaded) return null
  if (!c) {
    return (
      <Page title={title} back="/contractors" backLabel="Contractors" large={false}>
        <div className="empty-state">
          <b>Contractor not found</b>
        </div>
      </Page>
    )
  }
  const woName = wo ? `WO ${d.woByUuid.get(wo)?.number ?? ''}` : 'all work orders'
  const fromTickets = itemKey === 'grievance' || itemKey === 'closure'
  const back = `/contractors/${c.uuid}?tab=trends${range !== '1y' ? `&r=${range}` : ''}${wo ? `&wo=${wo}` : ''}`
  const openMonth = (m: string) =>
    fromTickets
      ? navigate(ticketLink({ c: c.uuid, wo, m, in: itemKey === 'grievance' ? 'closed' : 'openAtEnd' }, `/contractors/${c.uuid}/kpi/${itemKey}?${params.toString()}`))
      : navigate(`/contractors/${c.uuid}?m=${m}`)

  return (
    <Page title={title} back={back} backLabel={c.name}>
      <div className="list-foot" style={{ marginTop: -6, marginBottom: 12 }}>
        {c.name} · {woName}
      </div>
      <div className="pill-row" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button
            key={r.key}
            className={`pill${range === r.key ? ' on' : ''}`}
            aria-pressed={range === r.key}
            onClick={() => {
              haptic('tick')
              const next = new URLSearchParams(params)
              if (r.key === '1y') next.delete('r')
              else next.set('r', r.key)
              setParams(next, { replace: true })
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="rule-card">
        <b>How it’s scored</b>
        <span>{RULE[itemKey]}</span>
      </div>

      <div className="chart-card">
        <div className="chart-title">{title} per month</div>
        <div className="chart-sub">Tap a month to open it · gap = no data</div>
        <TrendLine
          data={months.map((m, i) => ({ date: `${m}-01`, value: values[i] }))}
          unit="%"
          mode="month"
          max={100}
          guides={[
            { value: 90, tone: 'good' },
            { value: 70, tone: 'bad' },
          ]}
          toneOf={(v) => kpiTone(kpiStatus(v))}
          onOpen={(i) => openMonth(months[i])}
          openLabel={fromTickets ? 'Tickets' : 'Open month'}
        />
      </div>

      <div className="section-label">By month · newest first</div>
      <div className="list">
        {months
          .map((m, i) => ({ m, v: values[i] }))
          .reverse()
          .map(({ m, v }) => {
            const st = kpiStatus(v)
            const why = itemInputs(d, c, itemKey, m, wo)
            return (
              <button key={m} className="row" onClick={() => openMonth(m)}>
                <span className="row-main">
                  <div className="row-title">{monthLabel(m)}</div>
                  {why && <div className="row-sub">{why}</div>}
                </span>
                <StatusChip tone={kpiTone(st)}>{v === null ? 'No data' : `${pct(v)} · ${STATUS_LABEL[st]}`}</StatusChip>
                <span className="row-chev">
                  <Icon name="chevron-right" size={18} />
                </span>
              </button>
            )
          })}
      </div>
      <div className="list-foot">{fromTickets ? 'Tap a month to see the tickets behind its score.' : 'Tap a month to open it.'}</div>
    </Page>
  )
}
