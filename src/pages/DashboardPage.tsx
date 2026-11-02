import { useEffect, useMemo, useRef, useState } from 'react'
import { useChipScroll } from '../lib/chipScroll'
import { markSeen } from '../lib/onboarding'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import ExploreCard from '../components/dash/ExploreCard'
import FocusStrip from '../components/dash/FocusStrip'
import OverTimeCard from '../components/dash/OverTimeCard'
import { campMenu, contractorMenu, peekMenu } from '../components/menus'
import { showToast } from '../components/Toast'
import { isOpen } from '../lib/aging'
import { CAMP_STATUS_LABEL, campState } from '../lib/camps'
import { dashView, lastMonths, type DashView } from '../lib/dashboard'
import { addMonths, localDate, monthLabel, monthOf } from '../lib/dates'
import { exploreChip, exploreData, type ExploreHold } from '../lib/explore'
import { focusCards, type FocusCard } from '../lib/focus'
import { MENU_HUE } from '../lib/hues'
import { kpisForMonth, useAllData } from '../lib/kpiData'
import { sarShort } from '../lib/money'
import { OVER_TIME_CHIPS, overTimeChip, overTimeSeries, type OverTimeSeries } from '../lib/overTime'
import { ticketLink, type TicketQuery } from '../lib/ticketFilter'
import { campTone } from '../lib/tone'
import { contractorOverall } from '../lib/trends'
import { logEvent } from '../db'

// The Dashboard: three views (Tickets · Accommodation · KPIs), a month row,
// then the same three sections on each: Focus (big cards, swiped across),
// Explore (one breakdown, chips pick which) and Over time (one line, chips
// pick the series). Tap a number for its list; hold it for its pop-up.
// Spec: docs/superpowers/specs/2026-11-02-dashboard-focus-explore-design.md

const VIEWS: { key: DashView; label: string }[] = [
  { key: 'tickets', label: 'Tickets' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'kpis', label: 'KPIs' },
]
/** Views that can show "All" time; the rest are per month. */
const ALL_TIME: DashView[] = ['tickets']

type ExportKind = 'excel' | 'word' | 'pack'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Old links (?v=overview, money, workers, camps) open the view that now holds them.
  const view = dashView(params.get('v'))
  const viewRow = useRef<HTMLDivElement>(null)
  useEffect(() => markSeen('dashboard'), [])
  useChipScroll(viewRow, view, 8)
  const d = useAllData()
  const today = localDate()
  const thisMonth = monthOf()
  // The view, month and chips live in the link, so Back and drill-downs keep them.
  const mParam = params.get('m')
  const picked: string | null = mParam === 'all' ? null : mParam && /^\d{4}-\d{2}$/.test(mParam) ? mParam : thisMonth
  const setLink = (key: 'v' | 'm' | 'x' | 't', value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  const setView = (v: DashView) => {
    const next = new URLSearchParams(params)
    if (v === 'tickets') next.delete('v')
    else next.set('v', v)
    next.delete('x')
    next.delete('t')
    setParams(next, { replace: true })
  }
  const setPicked = (m: string | null) => setLink('m', m === thisMonth ? null : (m ?? 'all'))
  const [exporting, setExporting] = useState(false)
  const allowAll = ALL_TIME.includes(view)
  const month = allowAll ? picked : (picked ?? thisMonth)
  const kpiMonth = picked ?? thisMonth
  const from = `/dashboard?${params.toString()}`
  const xChip = exploreChip(view, params.get('x'))
  const tChip = overTimeChip(view, params.get('t'))
  const setChip = (key: 'x' | 't', value: string, first: string) => setLink(key, value === first ? null : value)

  const focus = useMemo(() => focusCards(d, view, { month, kpiMonth, today, from }), [d, view, month, kpiMonth, today, from])
  const explore = useMemo(() => exploreData(d, view, xChip, { month, kpiMonth, today, from }), [d, view, xChip, month, kpiMonth, today, from])
  const series = useMemo(() => overTimeSeries(d, view, tChip, kpiMonth, today), [d, view, tChip, kpiMonth, today])
  const kpiMap = useMemo(() => kpisForMonth(d, kpiMonth), [d, kpiMonth])

  /** Hold a contractor anywhere: its pop-up with a 6-month trend. */
  const holdContractor = (uuid: string) => {
    const c = d.byUuid.get(uuid)
    if (!c) return
    contractorMenu(c, {
      workOrders: d.workOrders,
      kpi: kpiMap.get(uuid),
      kpiMonth,
      openTickets: d.tickets.filter((t) => t.contractorUuid === uuid && isOpen(t)).length,
      spark: contractorOverall(d, c, lastMonths(kpiMonth, 6)),
    })
  }
  const holdCamp = (uuid: string) => {
    const camp = d.camps.find((c) => c.uuid === uuid)
    if (!camp) return
    const s = campState(camp, d.inspections, today)
    campMenu(camp, { sub: `${CAMP_STATUS_LABEL[s.status]}${s.daysSince !== null ? ` · last ${s.daysSince}d ago` : ''}`, tone: campTone(s.status) })
  }
  const holdFocus = (c: FocusCard) => peekMenu({ title: c.title, sub: c.peek.sub, icon: c.icon, tone: c.tone, peek: c.peek, actions: c.peek.actions })
  const holdExplore = (h: ExploreHold) => {
    if (h.kind === 'contractor') holdContractor(h.uuid)
    else if (h.kind === 'camp') holdCamp(h.uuid)
    else peekMenu({ title: h.title, sub: h.sub, icon: h.icon, tone: h.tone, peek: h.peek, actions: h.actions })
  }
  /** A month tapped on the Over time chart: its tickets, or that month on the Dashboard. */
  const openMonth = (m: string, open: NonNullable<OverTimeSeries['open']>) => {
    if (open === 'month') return setPicked(m)
    const q: TicketQuery = open === 'opened' ? { m, in: 'opened' } : open === 'closed' ? { m, in: 'closed' } : { m, in: 'closed', owed: 'paid' }
    navigate(ticketLink(q, from))
  }

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

  const exploreWhen = view === 'tickets' && !month ? 'All time' : monthLabel(kpiMonth)

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
      <div className="segmented scroll" role="tablist" ref={viewRow}>
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

      <div className="stagger dash" key={view}>
        {d.loaded ? (
          <FocusStrip cards={focus} onHold={holdFocus} format={(c) => (c.key === 'money' ? (v) => `SAR ${sarShort(v)}` : undefined)} />
        ) : (
          <div className="skeleton" role="status" aria-label="Loading" style={{ height: 196, marginBottom: 24 }} />
        )}

        <section aria-label="Explore">
          <h2 className="clist-head">
            Explore <span className="clist-count">{exploreWhen}</span>
          </h2>
          <ExploreCard view={view} chip={xChip} onChip={(k) => setChip('x', k, exploreChip(view, null))} data={explore} d={d} onHold={holdExplore} />
        </section>

        <section aria-label="Over time">
          <h2 className="clist-head">Over time</h2>
          {d.loaded ? (
            <OverTimeCard chips={OVER_TIME_CHIPS[view]} chip={tChip} onChip={(k) => setChip('t', k, overTimeChip(view, null))} series={series} onOpen={openMonth} />
          ) : (
            <div className="skeleton" style={{ height: 280 }} />
          )}
        </section>
      </div>

      {exporting && (
        <Modal title={`Export ${monthLabel(kpiMonth)}`} onClose={() => setExporting(false)}>
          <div className="sheet-body">
            <div className="list">
              <button className="row" onClick={() => void doExport('pack')}>
                <span className={`row-icon h-${MENU_HUE.exportPack}`}>
                  <Icon name="chart" size={20} fill />
                </span>
                <span className="row-main">
                  <div className="row-title">KPI pack for slides</div>
                  <div className="row-sub">Excel · summary + one sheet per KPI</div>
                </span>
              </button>
              <button className="row" onClick={() => void doExport('excel')}>
                <span className={`row-icon h-${MENU_HUE.exportExcel}`}>
                  <Icon name="table" size={20} fill />
                </span>
                <span className="row-main">
                  <div className="row-title">Full data (Excel)</div>
                  <div className="row-sub">Tickets · KPIs · Manpower · Weekly trend</div>
                </span>
              </button>
              <button className="row" onClick={() => void doExport('word')}>
                <span className={`row-icon h-${MENU_HUE.exportWord}`}>
                  <Icon name="file-text" size={20} fill />
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
