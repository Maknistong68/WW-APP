import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import { showToast } from '../components/Toast'
import TrendLine from '../components/charts/TrendLine'
import BarList from '../components/charts/BarList'
import MonthBars from '../components/charts/MonthBars'
import ItemRow from '../components/ItemRow'
import CardList from '../components/CardList'
import IconTile from '../components/IconTile'
import { showActions } from '../components/ActionSheet'
import { TicketRow, ticketSub } from './TicketsPage'
import {
  auditAverage,
  campsSummary,
  inspectionsPerMonth,
  lastMonths,
  missingSubmissions,
  openAging,
  periodStats,
  recoveredPerMonth,
  ticketsBy,
  ticketsPerMonth,
  weeklyTrend,
  workersPerMonth,
  workforce,
} from '../lib/dashboard'
import { addMonths, localDate, monthLabel, monthOf } from '../lib/dates'
import { KPI_PARTS, STATUS_LABEL, closurePct, kpiStatus, pct } from '../lib/kpi'
import { itemStats, kpisForMonth, subjectKpis, useAllData } from '../lib/kpiData'
import { kpiSubjects } from '../lib/subjects'
import { CAMP_STATUS_LABEL } from '../lib/camps'
import { closeoutTotals, closeouts } from '../lib/closeout'
import { moneyStats, sar, sarShort } from '../lib/money'
import { memberCounts } from '../lib/groups'
import { logEvent } from '../db'
import { buildAttention } from '../lib/attention'

type View = 'overview' | 'tickets' | 'money' | 'kpis' | 'workers' | 'camps'
const VIEWS: { key: View; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'money', label: 'Money' },
  { key: 'kpis', label: 'KPIs' },
  { key: 'workers', label: 'Workers' },
  { key: 'camps', label: 'Camps' },
]
/** Tabs that can show "All" time; the rest are per month. */
const ALL_TIME: View[] = ['tickets', 'money']

type ExportKind = 'excel' | 'word' | 'pack'
type Tone = 'good' | 'warn' | 'bad' | ''

const AGE_LABEL: Record<string, string> = {
  '0-10': '0–10 days',
  '11-30': '11–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': 'Over 90 days',
}

/** "3 on track · 1 critical · 9 no data" — zeros left out. */
const countsText = (s: { good: number; warn: number; bad: number; none: number }) =>
  [s.good && `${s.good} on track`, s.warn && `${s.warn} at risk`, s.bad && `${s.bad} critical`, s.none && `${s.none} no data`]
    .filter(Boolean)
    .join(' · ') || '—'

const toneOf = (status: string): Tone => (status === 'good' || status === 'warn' || status === 'bad' ? status : '')

/** One number with a short label; optionally tappable. */
function Hero({ value, label, tone = '', onClick }: { value: ReactNode; label: string; tone?: Tone; onClick?: () => void }) {
  const body = (
    <>
      <div className={`hero-num${tone ? ` ${tone}` : ''}`}>{value}</div>
      <div className="hero-label">{label}</div>
    </>
  )
  return onClick ? (
    <button className="hero" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="hero">{body}</div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {sub && <div className="chart-sub">{sub}</div>}
      {children}
    </div>
  )
}


export default function DashboardPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = (params.get('v') as View) || 'overview'
  const setView = (v: View) => setParams(v === 'overview' ? {} : { v }, { replace: true })
  const d = useAllData()
  const today = localDate()
  const thisMonth = monthOf()
  const [picked, setPicked] = useState<string | null>(thisMonth)
  const [exporting, setExporting] = useState(false)
  const allowAll = ALL_TIME.includes(view)
  const month = allowAll ? picked : (picked ?? thisMonth)
  const kpiMonth = picked ?? thisMonth

  // --- tickets & money -------------------------------------------------------
  const stats = useMemo(() => periodStats(d.tickets, month, d.byUuid), [d.tickets, d.byUuid, month])
  const trend = useMemo(() => weeklyTrend(d.weekly, d.tickets).map((p) => ({ date: p.date, value: p.open })), [d.weekly, d.tickets])
  const months12 = useMemo(() => lastMonths(kpiMonth, 12), [kpiMonth])
  const months6 = useMemo(() => lastMonths(kpiMonth, 6), [kpiMonth])
  const perMonth = useMemo(() => ticketsPerMonth(d.tickets, months12), [d.tickets, months12])
  const aging = useMemo(() => openAging(d.tickets, today), [d.tickets, today])
  const groupCounts = useMemo(() => memberCounts(d.tickets), [d.tickets])
  const scope = month ? stats.opened : d.tickets
  const money = useMemo(() => moneyStats(scope), [scope])
  const moneyNow = useMemo(() => moneyStats(d.tickets), [d.tickets])
  const recovered = useMemo(() => recoveredPerMonth(d.tickets, months12), [d.tickets, months12])
  const closure = useMemo(() => closurePct(d.tickets, kpiMonth), [d.tickets, kpiMonth])

  // --- KPIs, workers, camps --------------------------------------------------
  const subjectList = useMemo(() => kpiSubjects(d.contractors, d.workOrders), [d.contractors, d.workOrders])
  const subjects = useMemo(() => subjectKpis(d, kpiMonth), [d, kpiMonth])
  const overall = itemStats(subjects, 'overall')
  const byContractor = useMemo(() => {
    const m = kpisForMonth(d, kpiMonth)
    return d.contractors
      .filter((c) => c.active)
      .map((c) => ({ c, r: m.get(c.uuid)! }))
      .filter(({ r }) => r && r.overall !== null)
      .sort((a, b) => (a.r.overall ?? 101) - (b.r.overall ?? 101))
  }, [d, kpiMonth])
  const kpiTrend = useMemo(
    () => months6.map((m) => ({ month: m, values: [Math.round(itemStats(subjectKpis(d, m), 'overall').avg ?? 0)] })),
    [d, months6],
  )
  const missingDocs = useMemo(() => missingSubmissions(subjectList, d.kpis, kpiMonth), [subjectList, d.kpis, kpiMonth])
  const wf = useMemo(() => workforce(subjectList, d.manpower, kpiMonth), [subjectList, d.manpower, kpiMonth])
  const wfTrend = useMemo(() => workersPerMonth(subjectList, d.manpower, months6), [subjectList, d.manpower, months6])
  const camps = useMemo(() => campsSummary(d.camps, d.inspections, today), [d.camps, d.inspections, today])
  const audits = useMemo(() => auditAverage(d.inspections, kpiMonth), [d.inspections, kpiMonth])
  const inspTrend = useMemo(() => inspectionsPerMonth(d.inspections, months6), [d.inspections, months6])
  const co = useMemo(() => closeoutTotals(closeouts(subjectList, d.kpis, today)), [subjectList, d.kpis, today])

  // --- what needs attention (overview) --------------------------------------
  const attention = useMemo(() => buildAttention(d, kpiMonth, today), [d, kpiMonth, today])

  const doExport = async (kind: ExportKind) => {
    setExporting(false)
    try {
      let file: { blob: Blob; fileName: string }
      if (kind === 'pack') file = await (await import('../export/kpiPack')).buildKpiPack(d, kpiMonth)
      else {
        const mod = await import('../export/monthly')
        file = kind === 'excel' ? await mod.buildMonthlyExcel(d, kpiMonth) : await mod.buildMonthlyWord(d, kpiMonth)
      }
      saveAs(file.blob, file.fileName)
      logEvent(null, 'Monthly export', file.fileName)
      showToast({ text: `Saved ${file.fileName}` })
    } catch (err) {
      showToast({ text: `Export failed: ${err instanceof Error ? err.message : String(err)}`, duration: 7000 })
    }
  }

  const avg = stats.avgDaysToClose
  const short = (m: string) => monthLabel(m).slice(0, 3)
  const wfFrom = wf.month && wf.month !== kpiMonth ? ` · ${short(wf.month)}` : ''

  return (
    <Page
      title="Dashboard"
      actions={
        <>
          <button className="nav-btn" aria-label="Open the 3D view" onClick={() => navigate('/dashboard/3d')}>
            <Icon name="cube" size={24} /> 3D
          </button>
          <button className="nav-btn" aria-label="Export" onClick={() => setExporting(true)}>
            <Icon name="download" size={24} />
          </button>
        </>
      }
    >
      <div className="segmented scroll" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            className={view === v.key ? 'on' : ''}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="segmented" style={{ gridTemplateColumns: '44px 1fr 44px 64px', gridAutoFlow: 'unset', display: 'grid' }}>
        <button aria-label="Previous month" onClick={() => setPicked(addMonths(kpiMonth, -1))}>
          ‹
        </button>
        <button className={month ? 'on' : ''} onClick={() => setPicked(kpiMonth)}>
          {monthLabel(kpiMonth)}
        </button>
        <button aria-label="Next month" disabled={kpiMonth >= thisMonth} onClick={() => setPicked(addMonths(kpiMonth, 1))}>
          ›
        </button>
        <button className={month ? '' : 'on'} disabled={!allowAll} onClick={() => setPicked(null)}>
          All
        </button>
      </div>

      {view === 'overview' && (
        <>
          <div className="hero-row">
            <Hero
              value={stats.openAtEnd}
              label={stats.over30AtEnd ? `Open · ${stats.over30AtEnd} over 30d` : 'Open tickets'}
              tone={stats.over30AtEnd ? 'bad' : ''}
              onClick={() => setView('tickets')}
            />
            <Hero
              value={sarShort(moneyNow.outstanding)}
              label="SAR still owed"
              tone={moneyNow.outstanding ? 'bad' : ''}
              onClick={() => setView('money')}
            />
            <Hero value={pct(overall.avg)} label="Overall KPI" tone={toneOf(kpiStatus(overall.avg))} onClick={() => setView('kpis')} />
          </div>
          <div className="hero-row">
            <Hero
              value={wf.total ? wf.total.toLocaleString('en-US') : '—'}
              label={`Workers${wfFrom}`}
              onClick={() => setView('workers')}
            />
            <Hero
              value={camps.expired + camps.never + camps.due}
              label="Camps to inspect"
              tone={camps.expired + camps.never ? 'bad' : camps.due ? 'warn' : ''}
              onClick={() => setView('camps')}
            />
            <Hero
              value={missingDocs.length}
              label="Missing submissions"
              tone={missingDocs.length ? 'warn' : 'good'}
              onClick={() => navigate(`/missing/submission?m=${kpiMonth}`)}
            />
          </div>

          {attention.length === 0 ? (
            <CardList title="Needs attention">
              <div className="list-foot" style={{ margin: '4px 18px 16px' }}>Nothing urgent.</div>
            </CardList>
          ) : (
            <CardList title="Needs attention" count={attention.length}>
              {attention.map((a) => (
                <ItemRow
                  key={a.key}
                  wrap
                  tile={<IconTile icon={a.tone === 'bad' ? 'alert' : 'clock'} tone={a.tone} size={52} />}
                  title={a.text}
                  sub={a.tone === 'bad' ? 'Overdue' : 'Due soon'}
                  onOpen={() => navigate(a.to)}
                  onMore={() =>
                    showActions({
                      title: a.text,
                      sub: a.tone === 'bad' ? 'Needs attention now' : 'Coming up',
                      actions: [
                        { label: 'Open', icon: 'arrow-right', onSelect: () => navigate(a.to) },
                        {
                          label: 'Copy as text',
                          icon: 'copy',
                          onSelect: () =>
                            void navigator.clipboard?.writeText(`${a.text} (${monthLabel(kpiMonth)})`).then(() => showToast({ text: 'Copied' })),
                        },
                      ],
                    })
                  }
                />
              ))}
            </CardList>
          )}

          <Card title="Open system tickets" sub={`Per week · ${trend.length} weeks`}>
            <TrendLine data={trend} unit="open" />
          </Card>

          <Card title="Lowest KPI" sub={`${monthLabel(kpiMonth)} · overall · worst first`}>
            {byContractor.length === 0 ? (
              <div className="note">No KPI data for this month yet.</div>
            ) : (
              <KpiTable rows={byContractor.slice(0, 5)} onOpen={(uuid) => navigate(`/contractors/${uuid}`)} />
            )}
          </Card>
        </>
      )}

      {view === 'tickets' && (
        <>
          <div className="hero-row">
            <Hero value={stats.openAtEnd} label={`Open${month && month < thisMonth ? ' at month end' : ''}`} />
            <Hero value={stats.opened.length} label="Opened" />
            <Hero value={stats.closed.length} label="Closed" />
          </div>
          <div className="hero-row">
            <Hero value={stats.over30AtEnd} label="Over 30 days" tone={stats.over30AtEnd ? 'bad' : ''} />
            <Hero value={stats.workersOpened.toLocaleString()} label="Workers affected" />
            <Hero
              value={avg === null ? '—' : Math.round(avg)}
              label="Avg days to close"
              tone={avg === null ? '' : avg <= 10 ? 'good' : avg <= 30 ? 'warn' : 'bad'}
            />
          </div>

          <Card title="Opened vs closed" sub={`Per month · 12 months to ${monthLabel(kpiMonth)}`}>
            <MonthBars data={perMonth} series={['Opened', 'Closed']} />
          </Card>

          <Card title="Open tickets by age" sub={`Today · ${aging.reduce((s, r) => s + r.count, 0)} open`}>
            <BarList
              max={5}
              data={aging.map((r) => ({
                key: r.bucket,
                label: AGE_LABEL[r.bucket],
                value: r.count,
                detail: `${r.workers} worker${r.workers === 1 ? '' : 's'}`,
                onClick: () => navigate(r.bucket === '0-10' || r.bucket === '11-30' ? '/tickets' : '/tickets?f=late'),
              }))}
            />
          </Card>

          <Card title="Closure and source" sub={`${month ? monthLabel(month) : 'All tickets'}`}>
            <div className="hero-row" style={{ gridTemplateColumns: '1fr 2fr', marginBottom: 0 }}>
              <Hero value={pct(closure)} label={`Closed · ${short(kpiMonth)}`} tone={toneOf(kpiStatus(closure))} />
              <BarList data={ticketsBy(scope, (t) => t.source).map((c) => ({ key: c.key, label: c.label, value: c.count }))} />
            </div>
          </Card>

          <Card title="By contractor" sub="Tickets opened · workers">
            <BarList
              data={stats.byContractor.map((c) => ({
                key: c.key,
                label: c.label,
                value: c.count,
                detail: `${c.workers} worker${c.workers === 1 ? '' : 's'}`,
                onClick: d.byUuid.has(c.key) ? () => navigate(`/contractors/${c.key}`) : undefined,
              }))}
            />
          </Card>
          <Card title="By issue" sub="Tickets opened · workers">
            <BarList
              data={stats.byIssue.map((c) => ({
                key: c.key,
                label: c.label,
                value: c.count,
                detail: `${c.workers} worker${c.workers === 1 ? '' : 's'}`,
              }))}
            />
          </Card>
          <Card title="By category" sub="Tickets opened">
            <BarList data={ticketsBy(scope, (t) => t.category).map((c) => ({ key: c.key, label: c.label, value: c.count }))} />
          </Card>
        </>
      )}

      {view === 'money' && (
        <>
          <div className="hero-row">
            <Hero value={sarShort(money.outstanding)} label="SAR still owed" tone={money.outstanding ? 'bad' : ''} />
            <Hero value={sarShort(money.settled)} label="SAR recovered" />
            <Hero value={sarShort(money.total)} label={`SAR total · ${money.withAmount} ticket${money.withAmount === 1 ? '' : 's'}`} />
          </div>
          <div className="list-foot" style={{ marginTop: 0 }}>
            From tickets only · still owed = open · recovered = closed ·{' '}
            {month ? `tickets opened in ${monthLabel(month)}` : 'all tickets'}
          </div>

          <Card title="Recovered per month" sub={`SAR on tickets closed · 12 months to ${monthLabel(kpiMonth)}`}>
            <MonthBars data={recovered} series={['Recovered']} format={sar} axisFormat={sarShort} />
          </Card>

          <Card title="Still owed by age" sub="Open tickets today · SAR">
            <BarList
              max={5}
              format={sar}
              data={aging
                .filter((r) => r.owed > 0)
                .map((r) => ({ key: r.bucket, label: AGE_LABEL[r.bucket], value: r.owed, detail: `${r.count} ticket${r.count === 1 ? '' : 's'}` }))}
            />
          </Card>

          <Card title="Money by contractor" sub="Total SAR · tickets">
            <BarList
              format={sar}
              data={money.byKey((t) => t.contractorUuid).map((m) => ({
                key: m.key,
                label: d.byUuid.get(m.key)?.name ?? 'No contractor',
                value: m.amount,
                detail: `${m.count} ticket${m.count === 1 ? '' : 's'}`,
                onClick: d.byUuid.has(m.key) ? () => navigate(`/contractors/${m.key}`) : undefined,
              }))}
            />
          </Card>
          <Card title="Money by issue" sub="Total SAR · tickets">
            <BarList
              format={sar}
              data={money.byKey((t) => t.issue).map((m) => ({
                key: m.key,
                label: m.key,
                value: m.amount,
                detail: `${m.count} ticket${m.count === 1 ? '' : 's'}`,
              }))}
            />
          </Card>
          <div className="section-label">Largest amounts</div>
          {money.withAmount === 0 ? (
            <div className="list-foot">No ticket has a money-owed amount in this period.</div>
          ) : (
            <div className="list">
              {scope
                .filter((t) => (t.amountOwed ?? 0) > 0)
                .sort((a, b) => (b.amountOwed ?? 0) - (a.amountOwed ?? 0))
                .slice(0, 10)
                .map((t) => (
                  <TicketRow
                    key={t.uuid}
                    t={t}
                    sub={ticketSub(t, d.byUuid, d.woByUuid)}
                    group={groupCounts.get(t.uuid) ? `${(groupCounts.get(t.uuid) ?? 0) + 1} tickets` : undefined}
                  />
                ))}
            </div>
          )}
        </>
      )}

      {view === 'kpis' && (
        <>
          <div className="hero-row">
            <Hero value={pct(overall.avg)} label="Overall KPI" tone={toneOf(kpiStatus(overall.avg))} />
            <Hero value={overall.bad} label="Critical" tone={overall.bad ? 'bad' : ''} />
            <Hero
              value={`${subjectList.length - missingDocs.length}/${subjectList.length}`}
              label="Submissions in"
              tone={missingDocs.length ? 'warn' : 'good'}
              onClick={() => navigate(`/missing/submission?m=${kpiMonth}`)}
            />
          </div>

          <div className="section-label">Each KPI · {monthLabel(kpiMonth)}</div>
          <div className="list">
            <div className="row">
              <span className={`status-dot ${kpiStatus(overall.avg)}`} />
              <span className="row-main">
                <div className="row-title" style={{ fontWeight: 600 }}>
                  Overall KPI
                </div>
                <div className="row-sub">{countsText(overall)}</div>
              </span>
              <span className="row-trail">{pct(overall.avg)}</span>
            </div>
            {KPI_PARTS.map((p) => {
              const st = itemStats(subjects, p.key)
              return (
                <button key={p.key} className="row" onClick={() => navigate(`/kpis/${p.key}?m=${kpiMonth}`)}>
                  <span className={`status-dot ${kpiStatus(st.avg)}`} />
                  <span className="row-main">
                    <div className="row-title">
                      {p.label}
                      {p.auto && <span className="row-sub" style={{ display: 'inline', marginLeft: 6 }}>auto</span>}
                    </div>
                    <div className="row-sub">{countsText(st)}</div>
                  </span>
                  <span className="row-trail">{pct(st.avg)}</span>
                  <span className="row-chev">
                    <Icon name="chevron-right" size={18} />
                  </span>
                </button>
              )
            })}
          </div>
          <div className="list-foot">Averages over {subjects.length} active work orders / contractors.</div>

          <Card title="Quarterly audit close-out" sub={`${co.findings} finding${co.findings === 1 ? '' : 's'} logged · ${co.audits} audit${co.audits === 1 ? '' : 's'} still open`}>
            <div className="hero-row" style={{ marginBottom: 0 }}>
              <Hero value={co.open} label="Findings open" tone={co.open ? 'warn' : ''} onClick={() => navigate('/closeouts')} />
              <Hero value={co.overdue} label="Overdue" tone={co.overdue ? 'bad' : ''} onClick={() => navigate('/closeouts')} />
              <Hero value={pct(co.pct)} label="Closed out" tone={toneOf(kpiStatus(co.pct))} onClick={() => navigate('/closeouts')} />
            </div>
          </Card>

          <Card title="Overall KPI trend" sub={`Average · 6 months to ${monthLabel(kpiMonth)}`}>
            <MonthBars data={kpiTrend} series={['Overall KPI']} format={(v) => `${v}%`} />
          </Card>

          <Card title="By contractor" sub={`${monthLabel(kpiMonth)} · overall · worst first`}>
            {byContractor.length === 0 ? (
              <div className="note">No KPI data for this month yet.</div>
            ) : (
              <KpiTable rows={byContractor} onOpen={(uuid) => navigate(`/contractors/${uuid}`)} />
            )}
          </Card>
        </>
      )}

      {view === 'workers' && (
        <>
          <div className="hero-row">
            <Hero value={wf.total ? wf.total.toLocaleString('en-US') : '—'} label={`Total workers${wfFrom}`} />
            <Hero value={wf.illegal} label="Illegal / freelance" tone={wf.illegal ? 'bad' : ''} />
            <Hero value={pct(wf.formalPct)} label="Formal" tone={toneOf(kpiStatus(wf.formalPct))} />
          </div>
          <div className="hero-row">
            <Hero value={wf.visaExpiring} label="Visas expiring ≤30 days" tone={wf.visaExpiring ? 'warn' : ''} />
            <Hero value={wf.paidFees} label="Paid recruitment fees" tone={wf.paidFees ? 'bad' : ''} />
            <Hero
              value={wf.missing}
              label={`Not declared · ${short(kpiMonth)}`}
              tone={wf.missing ? 'warn' : 'good'}
              onClick={() => navigate(`/missing/formal?m=${kpiMonth}`)}
            />
          </div>

          <Card title="Workers per month" sub={`Declared · 6 months to ${monthLabel(kpiMonth)}`}>
            <MonthBars data={wfTrend} series={['Workers']} />
          </Card>

          <Card title="By contractor" sub={`${wf.month ? monthLabel(wf.month) : '—'} · workers · illegal`}>
            <BarList
              data={wf.byContractor.map((c) => ({
                key: c.key,
                label: c.label,
                value: c.total,
                detail: `${c.illegal} illegal`,
                onClick: () => navigate(`/contractors/${c.key}`),
              }))}
            />
          </Card>
          <div className="list-foot">Counts only — no names, Iqama or passport numbers.</div>
        </>
      )}

      {view === 'camps' && (
        <>
          <div className="hero-row">
            <Hero value={camps.active} label="Active camps" />
            <Hero value={camps.ok} label="Up to date" tone={camps.ok ? 'good' : ''} />
            <Hero value={camps.expired + camps.never} label="Expired" tone={camps.expired + camps.never ? 'bad' : ''} />
          </div>
          <div className="hero-row">
            <Hero value={camps.due} label="Due soon" tone={camps.due ? 'warn' : ''} />
            <Hero value={audits.count} label={`Inspections · ${short(kpiMonth)}`} />
            <Hero value={pct(audits.avg)} label="Avg audit score" tone={toneOf(kpiStatus(audits.avg))} />
          </div>

          <Card title="Inspections per month" sub={`6 months to ${monthLabel(kpiMonth)}`}>
            <MonthBars data={inspTrend} series={['Inspections']} />
          </Card>

          <div className="section-label">To inspect · {camps.toVisit.length}</div>
          {camps.toVisit.length === 0 ? (
            <div className="list-foot">Every camp is up to date.</div>
          ) : (
            <div className="list">
              {camps.toVisit.map(({ camp, state }) => (
                <button key={camp.uuid} className="row" onClick={() => navigate(`/camps/${camp.uuid}`)}>
                  <span className={`status-dot ${state.status === 'due' ? 'warn' : 'bad'}`} />
                  <span className="row-main">
                    <div className="row-title">{camp.name}</div>
                    <div className="row-sub">
                      {CAMP_STATUS_LABEL[state.status]}
                      {state.daysSince !== null ? ` · last ${state.daysSince}d ago` : ''}
                    </div>
                  </span>
                  <span className="row-chev">
                    <Icon name="chevron-right" size={18} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {exporting && (
        <Modal title={`Export ${monthLabel(kpiMonth)}`} onClose={() => setExporting(false)}>
          <div className="sheet-body">
            <div className="list">
              <button className="row" onClick={() => void doExport('pack')}>
                <span className="row-icon">
                  <Icon name="chart" size={18} />
                </span>
                <span className="row-main">
                  <div className="row-title">KPI pack for slides</div>
                  <div className="row-sub">Excel · summary + one sheet per KPI</div>
                </span>
              </button>
              <button className="row" onClick={() => void doExport('excel')}>
                <span className="row-icon">
                  <Icon name="table" size={18} />
                </span>
                <span className="row-main">
                  <div className="row-title">Full data (Excel)</div>
                  <div className="row-sub">Tickets · KPIs · Manpower · Weekly trend</div>
                </span>
              </button>
              <button className="row" onClick={() => void doExport('word')}>
                <span className="row-icon">
                  <Icon name="file-text" size={18} />
                </span>
                <span className="row-main">
                  <div className="row-title">Word summary</div>
                  <div className="row-sub">One-page monthly summary</div>
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Page>
  )
}

function KpiTable({
  rows,
  onOpen,
}: {
  rows: { c: { uuid: string; name: string }; r: { overall: number | null; status: ReturnType<typeof kpiStatus> } }[]
  onOpen: (uuid: string) => void
}) {
  return (
    <table className="kpi-table">
      <tbody>
        {rows.map(({ c, r }) => (
          <tr key={c.uuid} onClick={() => onOpen(c.uuid)} style={{ cursor: 'pointer' }}>
            <td>{c.name}</td>
            <td className="num">{pct(r.overall)}</td>
            <td className="st">
              <span className={`status-dot ${r.status}`} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {STATUS_LABEL[r.status]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
