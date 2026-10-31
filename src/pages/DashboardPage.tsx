import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import Page, { SettingsButton } from '../components/Page'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import { showToast } from '../components/Toast'
import TrendLine from '../components/charts/TrendLine'
import BarList from '../components/charts/BarList'
import { TicketRow, ticketSub } from './TicketsPage'
import { periodStats, weeklyTrend } from '../lib/dashboard'
import { addMonths, monthLabel, monthOf } from '../lib/dates'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct } from '../lib/kpi'
import { itemStats, kpisForMonth, subjectKpis, useAllData } from '../lib/kpiData'
import { moneyStats, sar, sarShort } from '../lib/money'
import { logEvent } from '../db'

type View = 'overview' | 'money' | 'kpis'
const VIEWS: { key: View; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'money', label: 'Money' },
  { key: 'kpis', label: 'KPIs' },
]

type ExportKind = 'excel' | 'word' | 'pack'

/** "3 on track · 1 critical · 9 no data" — zeros left out. */
const countsText = (s: { good: number; warn: number; bad: number; none: number }) =>
  [
    s.good && `${s.good} on track`,
    s.warn && `${s.warn} at risk`,
    s.bad && `${s.bad} critical`,
    s.none && `${s.none} no data`,
  ]
    .filter(Boolean)
    .join(' · ') || '—'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = (params.get('v') as View) || 'overview'
  const d = useAllData()
  const thisMonth = monthOf()
  const [month, setMonth] = useState<string | null>(thisMonth)
  const [exporting, setExporting] = useState(false)
  const kpiMonth = month ?? thisMonth

  const stats = useMemo(() => periodStats(d.tickets, month, d.byUuid), [d, month])
  const trend = useMemo(
    () => weeklyTrend(d.weekly, d.tickets).map((p) => ({ date: p.date, value: p.open })),
    [d.weekly, d.tickets],
  )
  const money = useMemo(() => moneyStats(month ? stats.opened : d.tickets), [d.tickets, month, stats.opened])
  const subjects = useMemo(() => subjectKpis(d, kpiMonth), [d, kpiMonth])
  const byContractor = useMemo(() => {
    const m = kpisForMonth(d, kpiMonth)
    return d.contractors
      .filter((c) => c.active)
      .map((c) => ({ c, r: m.get(c.uuid)! }))
      .filter(({ r }) => r.overall !== null)
      .sort((a, b) => (a.r.overall ?? 101) - (b.r.overall ?? 101))
  }, [d, kpiMonth])

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
  const overall = itemStats(subjects, 'overall')

  return (
    <Page
      title="Dashboard"
      actions={
        <>
          <button className="nav-btn" aria-label="Export" onClick={() => setExporting(true)}>
            <Icon name="download" size={24} />
          </button>
          <SettingsButton />
        </>
      }
    >
      <div className="segmented">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={view === v.key ? 'on' : ''}
            onClick={() => setParams(v.key === 'overview' ? {} : { v: v.key }, { replace: true })}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="segmented" style={{ gridTemplateColumns: '44px 1fr 44px 64px', gridAutoFlow: 'unset', display: 'grid' }}>
        <button aria-label="Previous month" onClick={() => setMonth(addMonths(month ?? thisMonth, -1))}>
          ‹
        </button>
        <button className={month ? 'on' : ''} onClick={() => setMonth(month ?? thisMonth)}>
          {monthLabel(month ?? thisMonth)}
        </button>
        <button
          aria-label="Next month"
          disabled={(month ?? thisMonth) >= thisMonth}
          onClick={() => setMonth(addMonths(month ?? thisMonth, 1))}
        >
          ›
        </button>
        <button className={month ? '' : 'on'} disabled={view === 'kpis'} onClick={() => setMonth(null)}>
          All
        </button>
      </div>

      {view === 'overview' && (
        <>
          <div className="hero-row">
            <div className="hero">
              <div className="hero-num">{stats.openAtEnd}</div>
              <div className="hero-label">Open{month && month < thisMonth ? ' at month end' : ''}</div>
            </div>
            <div className="hero">
              <div className="hero-num">{stats.opened.length}</div>
              <div className="hero-label">Opened</div>
            </div>
            <div className="hero">
              <div className="hero-num">{stats.closed.length}</div>
              <div className="hero-label">Closed</div>
            </div>
          </div>
          <div className="hero-row">
            <div className="hero">
              <div className={`hero-num${stats.over30AtEnd ? ' bad' : ''}`}>{stats.over30AtEnd}</div>
              <div className="hero-label">Over 30 days</div>
            </div>
            <div className="hero">
              <div className="hero-num">{stats.workersOpened.toLocaleString()}</div>
              <div className="hero-label">Workers affected</div>
            </div>
            <div className="hero">
              <div className={`hero-num${avg === null ? '' : avg <= 10 ? ' good' : avg <= 30 ? ' warn' : ' bad'}`}>
                {avg === null ? '—' : Math.round(avg)}
              </div>
              <div className="hero-label">Avg days to close</div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-title">Open system tickets</div>
            <div className="chart-sub">Per week · {trend.length} weeks</div>
            <TrendLine data={trend} unit="open" />
          </div>

          <div className="chart-card">
            <div className="chart-title">By contractor</div>
            <div className="chart-sub">Tickets opened · workers</div>
            <BarList
              data={stats.byContractor.map((c) => ({
                key: c.key,
                label: c.label,
                value: c.count,
                detail: `${c.workers} worker${c.workers === 1 ? '' : 's'}`,
                onClick: d.byUuid.has(c.key) ? () => navigate(`/contractors/${c.key}`) : undefined,
              }))}
            />
          </div>

          <div className="chart-card">
            <div className="chart-title">By issue</div>
            <div className="chart-sub">Tickets opened · workers</div>
            <BarList
              data={stats.byIssue.map((c) => ({
                key: c.key,
                label: c.label,
                value: c.count,
                detail: `${c.workers} worker${c.workers === 1 ? '' : 's'}`,
              }))}
            />
          </div>
        </>
      )}

      {view === 'money' && (
        <>
          <div className="hero-row">
            <div className="hero">
              <div className={`hero-num${money.outstanding ? ' bad' : ''}`}>{sarShort(money.outstanding)}</div>
              <div className="hero-label">SAR owed · open</div>
            </div>
            <div className="hero">
              <div className="hero-num">{sarShort(money.settled)}</div>
              <div className="hero-label">SAR on closed</div>
            </div>
            <div className="hero">
              <div className="hero-num">{sarShort(money.total)}</div>
              <div className="hero-label">
                SAR involved · {money.withAmount} ticket{money.withAmount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className="list-foot" style={{ marginTop: 0 }}>
            {month ? `Tickets opened in ${monthLabel(month)}` : 'All tickets'} with a money-owed amount.
          </div>

          <div className="chart-card">
            <div className="chart-title">Owed by contractor</div>
            <div className="chart-sub">SAR · tickets</div>
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
          </div>
          <div className="chart-card">
            <div className="chart-title">Owed by issue</div>
            <div className="chart-sub">SAR · tickets</div>
            <BarList
              format={sar}
              data={money.byKey((t) => t.issue).map((m) => ({
                key: m.key,
                label: m.key,
                value: m.amount,
                detail: `${m.count} ticket${m.count === 1 ? '' : 's'}`,
              }))}
            />
          </div>
          <div className="section-label">Largest amounts</div>
          {money.withAmount === 0 ? (
            <div className="list-foot">No ticket has a money-owed amount yet — add it when you log or edit a ticket.</div>
          ) : (
            <div className="list">
              {(month ? stats.opened : d.tickets)
                .filter((t) => (t.amountOwed ?? 0) > 0)
                .sort((a, b) => (b.amountOwed ?? 0) - (a.amountOwed ?? 0))
                .slice(0, 10)
                .map((t) => (
                  <TicketRow key={t.uuid} t={t} sub={ticketSub(t, d.byUuid, d.woByUuid)} />
                ))}
            </div>
          )}
        </>
      )}

      {view === 'kpis' && (
        <>
          <button className="btn primary block" style={{ marginBottom: 4 }} onClick={() => navigate(`/kpis/entry?m=${kpiMonth}`)}>
            <Icon name="pencil" size={18} /> Enter KPIs for all work orders
          </button>
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

          <div className="chart-card">
            <div className="chart-title">By contractor</div>
            <div className="chart-sub">{monthLabel(kpiMonth)} · overall · worst first</div>
            {byContractor.length === 0 ? (
              <div className="note">No KPI data for this month yet.</div>
            ) : (
              <table className="kpi-table">
                <tbody>
                  {byContractor.map(({ c, r }) => (
                    <tr key={c.uuid} onClick={() => navigate(`/contractors/${c.uuid}`)} style={{ cursor: 'pointer' }}>
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
            )}
          </div>
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
