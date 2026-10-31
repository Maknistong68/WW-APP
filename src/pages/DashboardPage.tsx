import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveAs } from 'file-saver'
import Page, { SettingsButton } from '../components/Page'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import { showToast } from '../components/Toast'
import TrendLine from '../components/charts/TrendLine'
import BarList from '../components/charts/BarList'
import { periodStats, weeklyTrend } from '../lib/dashboard'
import { addMonths, monthLabel, monthOf } from '../lib/dates'
import { STATUS_LABEL, pct } from '../lib/kpi'
import { kpisForMonth, useAllData } from '../lib/kpiData'
import { logEvent } from '../db'

export default function DashboardPage() {
  const navigate = useNavigate()
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
  const kpis = useMemo(() => {
    const m = kpisForMonth(d, kpiMonth)
    return d.contractors
      .filter((c) => c.active)
      .map((c) => ({ c, r: m.get(c.uuid)! }))
      .sort((a, b) => (a.r.overall ?? 101) - (b.r.overall ?? 101))
  }, [d, kpiMonth])
  const scored = kpis.filter((k) => k.r.overall !== null)

  const doExport = async (kind: 'excel' | 'word') => {
    setExporting(false)
    try {
      const mod = await import('../export/monthly')
      const { blob, fileName } = kind === 'excel' ? await mod.buildMonthlyExcel(d, kpiMonth) : await mod.buildMonthlyWord(d, kpiMonth)
      saveAs(blob, fileName)
      logEvent(null, 'Monthly export', fileName)
      showToast({ text: `Saved ${fileName}` })
    } catch (err) {
      showToast({ text: `Export failed: ${err instanceof Error ? err.message : String(err)}`, duration: 7000 })
    }
  }

  const avg = stats.avgDaysToClose

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
        <button className={month ? '' : 'on'} onClick={() => setMonth(null)}>
          All
        </button>
      </div>

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
        <div className="chart-title">Open tickets</div>
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
            detail: `${c.workers} worker${c.workers === 1 ? "" : "s"}`,
            onClick: d.byUuid.has(c.key) ? () => navigate(`/contractors/${c.key}`) : undefined,
          }))}
        />
      </div>

      <div className="chart-card">
        <div className="chart-title">By issue</div>
        <div className="chart-sub">Tickets opened · workers</div>
        <BarList
          data={stats.byIssue.map((c) => ({ key: c.key, label: c.label, value: c.count, detail: `${c.workers} worker${c.workers === 1 ? "" : "s"}` }))}
        />
      </div>

      <div className="chart-card">
        <div className="chart-title">Contractor KPIs</div>
        <div className="chart-sub">{monthLabel(kpiMonth)} · worst first</div>
        {scored.length === 0 ? (
          <div className="note">No KPI data for this month yet.</div>
        ) : (
          <table className="kpi-table">
            <tbody>
              {scored.map(({ c, r }) => (
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
        {kpis.length > scored.length && (
          <div className="chart-sub" style={{ marginTop: 8, marginBottom: 0 }}>
            {kpis.length - scored.length} tracked contractor{kpis.length - scored.length === 1 ? '' : 's'} with no data
          </div>
        )}
      </div>

      {exporting && (
        <Modal title={`Export ${monthLabel(kpiMonth)}`} onClose={() => setExporting(false)}>
          <div className="sheet-body">
            <div className="list">
              <button className="row" onClick={() => void doExport('excel')}>
                <span className="row-icon">
                  <Icon name="table" size={18} />
                </span>
                <span className="row-main">
                  <div className="row-title">Excel</div>
                  <div className="row-sub">Tickets · KPIs · Manpower · Weekly trend</div>
                </span>
              </button>
              <button className="row" onClick={() => void doExport('word')}>
                <span className="row-icon">
                  <Icon name="file-text" size={18} />
                </span>
                <span className="row-main">
                  <div className="row-title">Word</div>
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
