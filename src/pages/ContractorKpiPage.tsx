import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Page, { NotFound, PageSkeleton } from '../components/Page'
import Icon from '../components/Icon'
import StatusChip from '../components/StatusChip'
import TrendLine from '../components/charts/TrendLine'
import { addMonths, localDate, monthLabel, monthName, monthOf } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct } from '../lib/kpi'
import { useAllData, type KpiItemKey } from '../lib/kpiData'
import { ticketLink } from '../lib/ticketFilter'
import { ticketKpiBreakdown } from '../lib/ticketKpi'
import { kpiTone } from '../lib/tone'
import { contractorKpiSeries, itemInputs, trendMonths, type TrendRange } from '../lib/trends'

/** How each KPI item is scored, in one or two short sentences. */
const RULE: Record<KpiItemKey, string> = {
  submission: 'WPS, manpower and salary declarations: all in 100%, some 50%, none 0%. Ones they can’t provide are left out.',
  accommodation: 'Accommodation score typed in, or the score of that month’s audit.',
  onboarding: 'Onboarding score typed in each month.',
  offboarding: 'Offboarding score typed in each month.',
  grievance: 'Average days to close the tickets closed that month. Up to 10 days 100% · 15 days 90% · 20 days 80% · 30 days 70% · over 30 days 0%.',
  formal: 'Formal workers out of all declared workers; illegal / freelance count against it.',
  closure: 'Tickets closed in the month out of the tickets open at any point in it.',
  meeting: 'Attended the monthly meeting: yes 100%, no 0%.',
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
  // Grievance and closure: the tickets behind one month's score (?m=, else the newest month with tickets).
  const ticketKey = itemKey === 'grievance' || itemKey === 'closure' ? itemKey : null
  const firstMonth = months[0] ?? monthOf(today)
  const lastMonth = monthOf(today)
  const mParam = params.get('m')
  const behindMonth = useMemo(() => {
    if (!c || !ticketKey) return lastMonth
    if (mParam && /^\d{4}-\d{2}$/.test(mParam) && mParam >= firstMonth && mParam <= lastMonth) return mParam
    for (let m = lastMonth; m >= firstMonth; m = addMonths(m, -1)) {
      if (ticketKpiBreakdown(d, c, ticketKey, m, wo, today).parts.some((p) => p.tickets.length)) return m
    }
    return addMonths(lastMonth, -1)
  }, [d, c, ticketKey, mParam, firstMonth, lastMonth, wo, today])
  const behind = useMemo(() => (c && ticketKey ? ticketKpiBreakdown(d, c, ticketKey, behindMonth, wo, today) : null), [d, c, ticketKey, behindMonth, wo, today])
  const setBehindMonth = (m: string) => {
    haptic('tick')
    const next = new URLSearchParams(params)
    next.set('m', m)
    setParams(next, { replace: true })
  }

  if (!d.loaded || !c) {
    return (
      <Page title={title} back="/contractors" backLabel="Contractors" large={false}>
        {d.loaded ? <NotFound what="Contractor" back="/contractors" backLabel="Contractors" /> : <PageSkeleton rows={2} />}
      </Page>
    )
  }
  const woName = wo ? `WO ${d.woByUuid.get(wo)?.number ?? ''}` : 'all work orders'
  const fromTickets = itemKey === 'grievance' || itemKey === 'closure'
  const back = `/contractors/${c.uuid}?tab=trends${range !== '1y' ? `&r=${range}` : ''}${wo ? `&wo=${wo}` : ''}`
  const openMonth = (m: string) =>
    fromTickets
      ? navigate(ticketLink({ c: c.uuid, wo, m, in: itemKey === 'grievance' ? 'closed' : 'during' }, `/contractors/${c.uuid}/kpi/${itemKey}?${params.toString()}`))
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

      {behind && (
        <div className="chart-card tkb">
          <div className="tkb-head">
            <div>
              <div className="chart-title">Tickets behind {monthName(behindMonth)}</div>
              <div className="chart-sub">
                {title}
                {behindMonth === lastMonth ? ' so far' : ''}: {pct(behind.value)}
              </div>
            </div>
            <div className="tkb-step">
              <button type="button" className="round-btn" aria-label="Month before" disabled={behindMonth <= firstMonth} onClick={() => setBehindMonth(addMonths(behindMonth, -1))}>
                <Icon name="chevron-left" size={22} strokeWidth={2.4} />
              </button>
              <button type="button" className="round-btn" aria-label="Month after" disabled={behindMonth >= lastMonth} onClick={() => setBehindMonth(addMonths(behindMonth, 1))}>
                <Icon name="chevron-right" size={22} strokeWidth={2.4} />
              </button>
            </div>
          </div>
          {behind.parts.map((p) => (
            <div key={p.label} className="tkb-part">
              {behind.parts.length > 1 && (
                <div className="tkb-part-head">
                  <b>{p.label}</b>
                  <span>{pct(p.value)}</span>
                </div>
              )}
              {p.tickets.map((x) => (
                <button key={x.uuid} type="button" className="tkb-row" onClick={() => navigate(`/tickets/${x.uuid}`)}>
                  <span className="tkb-text">
                    <span className="tkb-no">{x.ticketNo || 'Ticket'}</span>
                    <span className="tkb-dates">{x.dates}</span>
                  </span>
                  <StatusChip tone={x.tone} icon={false}>
                    {x.note}
                  </StatusChip>
                </button>
              ))}
              <div className="tkb-sum">{p.sum}</div>
            </div>
          ))}
          {behind.total && <div className="tkb-sum total">{behind.total}</div>}
        </div>
      )}

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
