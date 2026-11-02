import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import Sparkline from '../components/Sparkline'
import StatusChip from '../components/StatusChip'
import MonthBars from '../components/charts/MonthBars'
import TrendLine from '../components/charts/TrendLine'
import { ageDays, isOpen } from '../lib/aging'
import { localDate, monthLabel } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct } from '../lib/kpi'
import type { AllData } from '../lib/kpiData'
import { sar, sarShort } from '../lib/money'
import { ticketLink } from '../lib/ticketFilter'
import { kpiTone } from '../lib/tone'
import {
  contractorKpiSeries,
  contractorMoneySeries,
  contractorTicketSeries,
  contractorWorkforceSeries,
  trendMonths,
  trendSummary,
  type TrendRange,
} from '../lib/trends'
import type { Contractor } from '../types'
import AuditList from '../components/AuditList'
import { contractorAudits } from '../lib/audits'

const RANGES: { key: TrendRange; label: string }[] = [
  { key: '6m', label: '6 months' },
  { key: '1y', label: '1 year' },
  { key: 'all', label: 'All' },
]
const short = (m: string) => monthLabel(m).slice(0, 3)

/**
 * A contractor over time: the overall KPI (with the 90% / 70% lines), each KPI
 * item's trend, and tickets, money and workers per month. The range and work
 * order choice change every chart; tap a month to open it.
 */
export default function ContractorTrends({ d, c, onOpenMonth }: { d: AllData; c: Contractor; onOpenMonth: (month: string) => void }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const range = (['6m', '1y', 'all'].includes(params.get('r') ?? '') ? params.get('r') : '1y') as TrendRange
  const wos = d.workOrders.filter((w) => w.contractorUuid === c.uuid)
  const woParam = params.get('wo')
  const wo = woParam && wos.some((w) => w.uuid === woParam) ? woParam : undefined
  const [table, setTable] = useState(false)
  const [allAudits, setAllAudits] = useState(false)
  const set = (k: 'r' | 'wo', v: string | null) => {
    haptic('tick')
    const next = new URLSearchParams(params)
    if (v === null) next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }
  const today = localDate()
  const months = useMemo(() => trendMonths(d, c, range, today), [d, c, range, today])
  const series = useMemo(() => contractorKpiSeries(d, c, months, wo), [d, c, months, wo])
  const tickets = useMemo(() => contractorTicketSeries(d, c, months, wo, today), [d, c, months, wo, today])
  const money = useMemo(() => contractorMoneySeries(d, c, months, wo, today), [d, c, months, wo, today])
  const workers = useMemo(() => contractorWorkforceSeries(d, c, months, wo), [d, c, months, wo])
  const sum = trendSummary(series.overall)
  const audits = useMemo(() => contractorAudits(d, c, months), [d, c, months])
  const auditPoints = audits.series.filter((v) => v !== null).length
  const openNow = d.tickets.filter((t) => t.contractorUuid === c.uuid && isOpen(t) && (!wo || t.workOrderUuid === wo))
  const lateNow = openNow.filter((t) => ageDays(t, today) > 30).length
  const from = `/contractors/${c.uuid}?tab=trends${range !== '1y' ? `&r=${range}` : ''}${wo ? `&wo=${wo}` : ''}`
  const lastWorkers = [...workers].reverse().find((w) => w !== null) ?? null
  const lastWorkersMonth = months[workers.lastIndexOf(lastWorkers)]

  return (
    <>
      <div className="pill-row" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r.key} className={`pill${range === r.key ? ' on' : ''}`} aria-pressed={range === r.key} onClick={() => set('r', r.key === '1y' ? null : r.key)}>
            {r.label}
          </button>
        ))}
      </div>
      {wos.length > 1 && (
        <div className="pill-row" role="group" aria-label="Work order">
          <button className={`pill${!wo ? ' on' : ''}`} aria-pressed={!wo} onClick={() => set('wo', null)}>
            All WOs
          </button>
          {wos.map((w) => (
            <button key={w.uuid} className={`pill${wo === w.uuid ? ' on' : ''}`} aria-pressed={wo === w.uuid} onClick={() => set('wo', w.uuid)}>
              WO {w.number}
              {!w.active && ' · off'}
            </button>
          ))}
        </div>
      )}

      <div className="hero-row">
        <div className="hero">
          <div className={`hero-num ${kpiStatus(sum.now)}`}>{pct(sum.now)}</div>
          <div className="hero-label">
            Overall {months.length ? short(months[months.length - 1]) : ''}
            {sum.change !== null && sum.change !== 0 && ` · ${sum.change > 0 ? '▲' : '▼'} ${Math.abs(sum.change)}`}
          </div>
        </div>
        <div className="hero">
          <div className={`hero-num${sum.onTrack ? ' good' : ''}`}>{sum.onTrack}</div>
          <div className="hero-label">On track · of {sum.months} month{sum.months === 1 ? '' : 's'}</div>
        </div>
        <button className="hero live" onClick={() => navigate(ticketLink({ c: c.uuid, wo, f: 'open' }, from))}>
          <div className={`hero-num${lateNow ? ' bad' : ''}`}>{openNow.length}</div>
          <div className="hero-label">
            Open tickets{lateNow ? ` · ${lateNow} late` : ''}
            <Icon name="chevron-right" size={14} strokeWidth={2.6} className="hero-chev" />
          </div>
        </button>
      </div>

      <div className="chart-card">
        <div className="chart-title">Overall KPI</div>
        <div className="chart-sub">Tap a month to open it · gap = no data</div>
        <TrendLine
          data={months.map((m, i) => ({ date: `${m}-01`, value: series.overall[i] }))}
          unit="%"
          mode="month"
          max={100}
          guides={[
            { value: 90, tone: 'good' },
            { value: 70, tone: 'bad' },
          ]}
          toneOf={(v) => kpiTone(kpiStatus(v))}
          onOpen={(i) => onOpenMonth(months[i])}
          openLabel="Open month"
        />
      </div>

      <div className="section-label">Each KPI · {months.length} months</div>
      <div className="list">
        {KPI_PARTS.map((p) => {
          const vals = series[p.key]
          const known = vals.filter((v): v is number => v !== null)
          const last = known.length ? known[known.length - 1] : null
          const st = kpiStatus(last)
          return (
            <button
              key={p.key}
              className="row"
              onClick={() => navigate(`/contractors/${c.uuid}/kpi/${p.key}?r=${range}${wo ? `&wo=${wo}` : ''}`)}
            >
              <span className="row-main">
                <div className="row-title">{p.label}</div>
                <div className="row-sub">{p.auto ? 'auto · ' : ''}{STATUS_LABEL[st]}</div>
              </span>
              <Sparkline values={vals} label={`${p.label}, ${months.length} months`} tone={kpiTone(st)} width={72} height={28} guide={90} />
              <span className="row-trail" style={{ minWidth: 44, textAlign: 'right' }}>
                {pct(last)}
              </span>
              <span className="row-chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
          )
        })}
      </div>

      <div className="chart-card">
        <div className="chart-title">Tickets per month</div>
        <div className="chart-sub">Tap a month for its tickets</div>
        <MonthBars
          data={months.map((m, i) => ({ month: m, values: [tickets[i].opened, tickets[i].closed] }))}
          series={['Opened', 'Closed']}
          onOpen={(m) => navigate(ticketLink({ c: c.uuid, wo, m, in: 'opened' }, from))}
          openLabel="Open"
        />
      </div>

      <div className="chart-card">
        <div className="chart-title">Money (SAR)</div>
        <div className="chart-sub">Owed at month end · recovered in the month</div>
        <MonthBars
          data={months.map((m, i) => ({ month: m, values: [money[i].owedAtEnd, money[i].recovered] }))}
          series={['Owed', 'Recovered']}
          format={sar}
          axisFormat={sarShort}
          onOpen={(m) => navigate(ticketLink({ c: c.uuid, wo, m, in: 'openAtEnd', owed: 'open' }, from))}
          openLabel="Open"
        />
      </div>

      <div className="chart-card">
        <div className="chart-title">Workers</div>
        <div className="chart-sub">Declared per month · counts only</div>
        <MonthBars
          data={months.map((m, i) => ({ month: m, values: [workers[i]?.total ?? null] }))}
          series={['Workers']}
          onOpen={(m) => navigate(`/missing/formal?m=${m}`)}
          openLabel="Open"
        />
        {lastWorkers && (
          <div className="hero-row" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="hero">
              <div className={`hero-num${lastWorkers.illegal ? ' warn' : ''}`}>{lastWorkers.illegal}</div>
              <div className="hero-label">Illegal · {short(lastWorkersMonth)}</div>
            </div>
            <div className="hero">
              <div className={`hero-num${lastWorkers.visas ? ' warn' : ''}`}>{lastWorkers.visas}</div>
              <div className="hero-label">Visas ≤30 days</div>
            </div>
            <div className="hero">
              <div className={`hero-num${lastWorkers.paidFees ? ' bad' : ''}`}>{lastWorkers.paidFees}</div>
              <div className="hero-label">Paid fees</div>
            </div>
          </div>
        )}
      </div>

      <div className="chart-card" id="audits">
        <div className="chart-title">Audits</div>
        <div className="chart-sub">Quarterly audit scores and camp inspections · all work orders</div>
        {auditPoints >= 2 && (
          <TrendLine
            data={months.map((m, i) => ({ date: `${m}-01`, value: audits.series[i] }))}
            unit="%"
            mode="month"
            max={100}
            guides={[
              { value: 90, tone: 'good' },
              { value: 70, tone: 'bad' },
            ]}
            toneOf={(v) => kpiTone(kpiStatus(v))}
            onOpen={(i) => onOpenMonth(months[i])}
            openLabel="Open month"
          />
        )}
        {audits.list.length === 0 ? (
          <div className="note">No audits yet.</div>
        ) : (
          <div style={{ marginTop: auditPoints >= 2 ? 12 : 4 }}>
            <AuditList flush items={allAudits ? audits.list : audits.list.slice(0, 5)} />
            {audits.list.length > 5 && (
              <button className="show-more" style={{ marginTop: 10 }} onClick={() => setAllAudits((v) => !v)}>
                {allAudits ? 'Show fewer' : `Show all ${audits.list.length}`}
              </button>
            )}
          </div>
        )}
      </div>

      <button className="show-more" onClick={() => setTable((t) => !t)}>
        {table ? 'Hide table' : 'Show as table'}
      </button>
      {table && (
        <div className="chart-card" style={{ overflowX: 'auto' }}>
          <table className="kpi-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">KPI</th>
                <th className="num">Opened</th>
                <th className="num">Closed</th>
                <th className="num">Workers</th>
              </tr>
            </thead>
            <tbody>
              {months
                .map((m, i) => ({ m, i }))
                .reverse()
                .map(({ m, i }) => (
                  <tr key={m}>
                    <td>{monthLabel(m)}</td>
                    <td className="num">
                      <StatusChip tone={kpiTone(kpiStatus(series.overall[i]))} icon={false}>
                        {pct(series.overall[i])}
                      </StatusChip>
                    </td>
                    <td className="num">{tickets[i].opened}</td>
                    <td className="num">{tickets[i].closed}</td>
                    <td className="num">{workers[i]?.total ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
