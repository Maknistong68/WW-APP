import { quarterlyAudits } from './audits'
import { CAMP_STATUS_LABEL, campInspections, campState } from './camps'
import { compareRows, sortRows, type CompareRow } from './compare'
import { lastMonths, openAging, periodStats, ticketsBy, workforce, type DashView } from './dashboard'
import { localDate, monthLabel, shortDate } from './dates'
import { dueMonthFor } from './due'
import { inspectionPct } from './inspectionScore'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct } from './kpi'
import { itemStats, kpisForMonth, subjectKpis, type AllData, type KpiItemKey, type KpiItemStats } from './kpiData'
import { moneyStats, owedOf } from './money'
import { ticketPeek, type Peek } from './peek'
import { kpiSubjects } from './subjects'
import { AGE_LABEL, openedIn, ticketLink, type TicketQuery } from './ticketFilter'
import { campTone, kpiTone, type Tone } from './tone'
import type { IconName } from '../components/Icon'
import type { AgingBucket } from './aging'
import type { Ticket } from '../types'
import type { FocusAction } from './focus'

// The Dashboard's "Explore" card: chips pick one breakdown, and each bar or
// row opens its list on tap and its pop-up on hold.

export interface ExploreChip {
  key: string
  label: string
}

export const EXPLORE_CHIPS: Record<DashView, ExploreChip[]> = {
  tickets: [
    { key: 'contractor', label: 'By contractor' },
    { key: 'issue', label: 'By issue' },
    { key: 'category', label: 'By category' },
    { key: 'source', label: 'D&C vs cases' },
    { key: 'age', label: 'By age' },
    { key: 'money', label: 'Money by contractor' },
    { key: 'owed', label: 'Owed by age' },
    { key: 'largest', label: 'Largest amounts' },
  ],
  kpis: [
    { key: 'each', label: 'Each KPI' },
    { key: 'contractor', label: 'By contractor' },
    { key: 'workers', label: 'Workers' },
    { key: 'quarterly', label: 'Quarterly audits' },
    { key: 'compare', label: 'Compare' },
  ],
  accommodation: [
    { key: 'inspect', label: 'To inspect' },
    { key: 'scores', label: 'Scores by camp' },
    { key: 'contractor', label: 'By contractor' },
  ],
}

/** The chip a link names, or the view's first one. */
export const exploreChip = (view: DashView, key: string | null): string =>
  EXPLORE_CHIPS[view].some((c) => c.key === key) ? (key as string) : EXPLORE_CHIPS[view][0].key

/** What holding an item opens: a record's own pop-up, or a built one. */
export type ExploreHold =
  | { kind: 'contractor'; uuid: string }
  | { kind: 'camp'; uuid: string }
  | { kind: 'peek'; title: string; sub: string; icon: IconName; tone: Tone; peek: Peek; actions: FocusAction[] }

export interface ExploreItem {
  key: string
  label: string
  /** Bar length (count, SAR or %). */
  value: number
  /** The value as written, when it isn't the plain number ("84%"). */
  text?: string
  detail?: string
  tone?: Tone
  /** A small tag after the name ("auto"). */
  tag?: string
  to?: string
  hold?: ExploreHold
}

export interface ExploreData {
  kind: 'bars' | 'rows' | 'tickets' | 'grid'
  items: ExploreItem[]
  format: 'count' | 'sar' | 'pct'
  /** Full-bar value (100 for %); otherwise the largest item. */
  scale?: number
  /** Fold the rest into one "Other" (counts, money) or show them all (%, dates). */
  other: 'sum' | 'none'
  tickets?: Ticket[]
  grid?: { rows: CompareRow[]; months: string[] }
  /** The line under the chips. */
  sub: string
  empty: string
}

export interface ExploreOptions {
  month: string | null
  kpiMonth: string
  today?: string
  from?: string
}

const SPARK_MONTHS = 6
const AGE_TONE: Record<AgingBucket, Tone> = { '0-10': 'good', '11-30': 'warn', '31-60': 'bad', '61-90': 'bad', '90+': 'bad' }
const workersText = (w: number) => `${w.toLocaleString('en-US')} worker${w === 1 ? '' : 's'}`
const ticketsText = (c: number) => `${c} ticket${c === 1 ? '' : 's'}`

/** "3 on track · 1 critical · 9 no data" — zeros left out. */
export const countsText = (s: KpiItemStats) =>
  [s.good && `${s.good} on track`, s.warn && `${s.warn} at risk`, s.bad && `${s.bad} critical`, s.none && `${s.none} no data`]
    .filter(Boolean)
    .join(' · ') || '—'

function ticketData(d: AllData, chip: string, o: Required<ExploreOptions>): ExploreData {
  const { month, kpiMonth, today, from } = o
  const tix = (q: TicketQuery) => ticketLink(q, from)
  const stats = periodStats(d.tickets, month, d.byUuid, today)
  const scope = month ? stats.opened : d.tickets
  const opened: TicketQuery = month ? { m: month, in: 'opened' } : {}
  const months = lastMonths(kpiMonth, SPARK_MONTHS)
  const when = month ? `Opened in ${monthLabel(month)}` : 'All tickets'
  const sub = `${when} · ${ticketsText(scope.length)} · ${workersText(scope.reduce((s, t) => s + (t.workers || 0), 0))}`
  const empty = 'No tickets in this period.'
  const peekOf = (title: string, icon: IconName, tickets: Ticket[], to: string, extra: FocusAction[] = []): ExploreHold => {
    const peek = ticketPeek(tickets, months, today)
    return { kind: 'peek', title, sub: when, icon, tone: peek.spark?.tone ?? 'none', peek, actions: [{ label: 'Open tickets', icon: 'ticket', to }, ...extra] }
  }
  const contractorActions = (uuid: string): FocusAction[] =>
    d.byUuid.has(uuid)
      ? [
          { label: 'Open contractor', icon: 'buildings', to: `/contractors/${uuid}` },
          { label: 'See trends', icon: 'activity', to: `/contractors/${uuid}?tab=trends` },
        ]
      : []

  if (chip === 'contractor') {
    return {
      kind: 'bars',
      format: 'count',
      other: 'sum',
      sub,
      empty,
      items: stats.byContractor.map((c) => {
        const to = tix({ ...opened, c: c.key === '—' ? 'none' : c.key })
        return {
          key: c.key,
          label: c.label,
          value: c.count,
          detail: workersText(c.workers),
          to,
          hold: peekOf(c.label, 'buildings', scope.filter((t) => (t.contractorUuid || '—') === c.key), to, contractorActions(c.key)),
        }
      }),
    }
  }
  if (chip === 'source') {
    // D&C tickets (every other number on this view) next to the team's own cases (src/lib/cases.ts).
    const caseScope = month ? d.cases.filter((t) => openedIn(t, month)) : d.cases
    const dnc = tix({ ...opened, src: 'System' })
    const cases = tix({ ...opened, src: 'Internal' })
    return {
      kind: 'bars',
      format: 'count',
      other: 'none',
      sub: `${when} · D&C hotline tickets next to the team's own cases`,
      empty: 'No tickets or cases in this period.',
      items: [
        { key: 'System', label: 'D&C tickets', value: scope.length, detail: workersText(scope.reduce((s, t) => s + (t.workers || 0), 0)), to: dnc, hold: peekOf('D&C tickets', 'ticket', scope, dnc) },
        { key: 'Internal', label: 'Cases', value: caseScope.length, detail: workersText(caseScope.reduce((s, t) => s + (t.workers || 0), 0)), to: cases, hold: peekOf('Cases', 'ticket', caseScope, cases) },
      ],
    }
  }
  if (chip === 'issue' || chip === 'category') {
    const field = chip === 'issue' ? 'issue' : 'cat'
    const of = (t: Ticket) => (chip === 'issue' ? t.issue : t.category) || '—'
    return {
      kind: 'bars',
      format: 'count',
      other: 'sum',
      sub,
      empty,
      items: ticketsBy(scope, of).map((c) => {
        const to = tix({ ...opened, [field]: c.key })
        return { key: c.key, label: c.label, value: c.count, detail: workersText(c.workers), to, hold: peekOf(c.label, 'ticket', scope.filter((t) => of(t) === c.key), to) }
      }),
    }
  }
  if (chip === 'age' || chip === 'owed') {
    const aging = openAging(d.tickets, today)
    const money = chip === 'owed'
    const rows = money ? aging.filter((r) => r.owed > 0) : aging
    const open = aging.reduce((s, r) => s + r.count, 0)
    return {
      kind: 'bars',
      format: money ? 'sar' : 'count',
      other: 'none',
      sub: money ? `SAR still owed on open tickets today · ${ticketsText(open)} open` : `Open tickets today · ${ticketsText(open)}`,
      empty: money ? 'No open ticket has money owed.' : 'No open tickets.',
      items: rows.map((r) => {
        const to = tix(money ? { age: r.bucket, owed: 'open' } : { age: r.bucket })
        const mine = d.tickets.filter((t) => t.status !== 'Closed' && openAging([t], today).some((x) => x.bucket === r.bucket && x.count))
        return {
          key: r.bucket,
          label: AGE_LABEL[r.bucket],
          value: money ? r.owed : r.count,
          detail: money ? ticketsText(r.count) : workersText(r.workers),
          tone: AGE_TONE[r.bucket],
          to,
          hold: peekOf(AGE_LABEL[r.bucket], 'clock', money ? mine.filter((t) => owedOf(t) > 0) : mine, to),
        }
      }),
    }
  }
  if (chip === 'money') {
    const money = moneyStats(scope)
    return {
      kind: 'bars',
      format: 'sar',
      other: 'sum',
      sub: `${when} · SAR ${Math.round(money.total).toLocaleString('en-US')} on ${ticketsText(money.withAmount)}`,
      empty: 'No ticket has a money-owed amount in this period.',
      items: money.byKey((t) => t.contractorUuid).map((m) => {
        const label = d.byUuid.get(m.key)?.name ?? 'No contractor'
        const to = tix({ ...opened, owed: 'any', c: m.key === '—' ? 'none' : m.key })
        const mine = scope.filter((t) => (t.contractorUuid || '—') === m.key && owedOf(t) > 0)
        return { key: m.key, label, value: m.amount, detail: ticketsText(m.count), to, hold: peekOf(label, 'money', mine, to, contractorActions(m.key)) }
      }),
    }
  }
  // largest amounts: the top 5 ticket rows
  const priced = scope.filter((t) => owedOf(t) > 0).sort((a, b) => owedOf(b) - owedOf(a))
  return {
    kind: 'tickets',
    format: 'sar',
    other: 'none',
    sub: `${when} · the ${Math.min(5, priced.length)} biggest amounts`,
    empty: 'No ticket has a money-owed amount in this period.',
    items: [],
    tickets: priced.slice(0, 5),
  }
}

function kpiData(d: AllData, chip: string, o: Required<ExploreOptions>): ExploreData {
  const { kpiMonth, today } = o
  const subjectList = kpiSubjects(d.contractors, d.workOrders)
  const subjects = subjectKpis(d, kpiMonth)
  const months = lastMonths(kpiMonth, SPARK_MONTHS)
  const sub = `${monthLabel(kpiMonth)} · ${subjects.length} active work order${subjects.length === 1 ? '' : 's'} / contractors`

  if (chip === 'contractor') {
    const kpiMap = kpisForMonth(d, kpiMonth)
    const rows = d.contractors
      .filter((c) => c.active)
      .map((c) => ({ c, r: kpiMap.get(c.uuid)! }))
      .filter(({ r }) => r && r.overall !== null)
      .sort((a, b) => (a.r.overall ?? 101) - (b.r.overall ?? 101))
    return {
      kind: 'bars',
      format: 'pct',
      scale: 100,
      other: 'none',
      sub: `${monthLabel(kpiMonth)} · overall KPI · worst first`,
      empty: 'No KPI data for this month yet.',
      items: rows.map(({ c, r }) => ({
        key: c.uuid,
        label: c.name,
        value: r.overall ?? 0,
        text: pct(r.overall),
        detail: STATUS_LABEL[r.status],
        tone: kpiTone(r.status),
        to: `/contractors/${c.uuid}?m=${kpiMonth}`,
        hold: { kind: 'contractor', uuid: c.uuid },
      })),
    }
  }
  if (chip === 'workers') {
    const wf = workforce(subjectList, d.manpower, kpiMonth)
    return {
      kind: 'bars',
      format: 'count',
      other: 'sum',
      sub: wf.month ? `${monthLabel(wf.month)} · ${wf.total.toLocaleString('en-US')} workers · ${wf.illegal} illegal · ${wf.visaExpiring} visas expiring · ${wf.paidFees} paid fees · counts only` : 'No worker counts declared yet',
      empty: 'No worker counts declared yet.',
      items: wf.byContractor.map((c) => ({
        key: c.key,
        label: c.label,
        value: c.total,
        detail: `${c.illegal} illegal`,
        tone: c.illegal ? 'bad' : undefined,
        to: `/contractors/${c.key}?tab=trends`,
        hold: { kind: 'contractor', uuid: c.key },
      })),
    }
  }
  if (chip === 'quarterly') {
    const quarters = quarterlyAudits(d, subjectList)
    const spark = [...quarters].reverse().slice(-SPARK_MONTHS).map((q) => Math.round(q.avg))
    return {
      kind: 'bars',
      format: 'pct',
      scale: 100,
      other: 'none',
      sub: 'Average score per quarter · newest first · tap for each work order',
      empty: 'No quarterly audit scores yet.',
      items: quarters.map((q) => {
        const tone = kpiTone(kpiStatus(q.avg))
        const findings = q.rows.reduce((s, r) => s + (r.findings ?? 0), 0)
        const closed = q.rows.reduce((s, r) => s + (r.closed ?? 0), 0)
        const to = `/missing/quarterly?m=${q.lastMonth}`
        return {
          key: q.key,
          label: q.label,
          value: q.avg,
          text: pct(q.avg),
          detail: `${STATUS_LABEL[kpiStatus(q.avg)]} · ${q.audited} of ${q.total} audited`,
          tone,
          to,
          hold: {
            kind: 'peek',
            title: q.label,
            sub: `${q.audited} of ${q.total} work orders audited`,
            icon: 'seal',
            tone,
            peek: {
              facts: [
                { label: 'Average', value: pct(q.avg), tone },
                { label: 'Audited', value: `${q.audited} of ${q.total}` },
                { label: 'Findings closed', value: findings ? `${closed} of ${findings}` : '—', tone: findings ? (closed === findings ? 'good' : 'warn') : undefined },
              ],
              spark: { values: spark, label: `Quarter average, last ${spark.length} quarters`, tone, guide: 90 },
            },
            actions: [{ label: 'Open the quarter', icon: 'seal', to }],
          },
        }
      }),
    }
  }
  if (chip === 'compare') {
    const miniMonths = lastMonths(dueMonthFor(kpiMonth, today), SPARK_MONTHS)
    return {
      kind: 'grid',
      format: 'pct',
      scale: 100,
      other: 'none',
      sub: `Overall KPI · the 5 lowest contractors · ${miniMonths.length} months to ${monthLabel(miniMonths[miniMonths.length - 1])}`,
      empty: 'No KPI data yet.',
      items: [],
      grid: { rows: sortRows(compareRows(d, miniMonths, 'overall'), 'worst').slice(0, 5), months: miniMonths },
    }
  }
  // each KPI: the overall row, then one row per item
  const history = months.map((m) => subjectKpis(d, m))
  const row = (key: KpiItemKey, label: string, auto?: boolean): ExploreItem => {
    const st = itemStats(subjects, key)
    const tone = kpiTone(kpiStatus(st.avg))
    const spark = history.map((rows) => {
      const v = itemStats(rows, key).avg
      return v === null ? null : Math.round(v)
    })
    const to = `/kpis/${key}?m=${kpiMonth}`
    return {
      key,
      label,
      value: st.avg ?? 0,
      text: pct(st.avg),
      detail: countsText(st),
      tone,
      tag: auto ? 'auto' : undefined,
      to,
      hold: {
        kind: 'peek',
        title: label,
        sub: `${monthLabel(kpiMonth)} · ${countsText(st)}`,
        icon: 'gauge',
        tone,
        peek: {
          facts: [
            { label: 'On track', value: st.good, tone: st.good ? 'good' : undefined },
            { label: 'At risk', value: st.warn, tone: st.warn ? 'warn' : undefined },
            { label: 'Critical', value: st.bad, tone: st.bad ? 'bad' : undefined },
          ],
          spark: { values: spark, label: `${label}, last ${SPARK_MONTHS} months`, tone, guide: 90 },
        },
        actions: [
          { label: 'Open KPI page', icon: 'gauge', to },
          { label: 'Compare month by month', icon: 'table', to: `/compare?k=${key}` },
        ],
      },
    }
  }
  return {
    kind: 'rows',
    format: 'pct',
    scale: 100,
    other: 'none',
    sub,
    empty: 'No KPI data for this month yet.',
    items: [row('overall', 'Overall KPI'), ...KPI_PARTS.map((p) => row(p.key, p.label, p.auto))],
  }
}

function campData(d: AllData, chip: string, o: Required<ExploreOptions>): ExploreData {
  const { today } = o
  const active = d.camps.filter((c) => c.active).map((camp) => ({ camp, state: campState(camp, d.inspections, today) }))
  const stateText = (s: ReturnType<typeof campState>) => `${CAMP_STATUS_LABEL[s.status]}${s.daysSince !== null ? ` · last ${s.daysSince}d ago` : ''}`

  if (chip === 'scores') {
    const scored = active
      .map(({ camp, state }) => {
        const last = campInspections(camp, d.inspections)
          .filter((i) => i.info?.reviewDate)
          .map((i) => ({ date: i.info.reviewDate, pct: inspectionPct(i) }))
          .find((x) => x.pct !== null)
        return { camp, state, last }
      })
      .filter((x): x is typeof x & { last: { date: string; pct: number } } => !!x.last && x.last.pct !== null)
      .sort((a, b) => a.last.pct - b.last.pct)
    return {
      kind: 'bars',
      format: 'pct',
      scale: 100,
      other: 'none',
      sub: 'Latest inspection score per camp · lowest first',
      empty: 'No scored inspection yet.',
      items: scored.map(({ camp, last }) => ({
        key: camp.uuid,
        label: camp.name,
        value: last.pct,
        text: pct(last.pct),
        detail: `${STATUS_LABEL[kpiStatus(last.pct)]} · ${shortDate(last.date)}`,
        tone: kpiTone(kpiStatus(last.pct)),
        to: `/camps/${camp.uuid}`,
        hold: { kind: 'camp', uuid: camp.uuid },
      })),
    }
  }
  if (chip === 'contractor') {
    const by = new Map<string, { key: string; label: string; count: number; toVisit: number }>()
    for (const { camp, state } of active) {
      const e = by.get(camp.contractorUuid) ?? { key: camp.contractorUuid, label: d.byUuid.get(camp.contractorUuid)?.name ?? 'No contractor', count: 0, toVisit: 0 }
      e.count++
      if (state.status !== 'ok') e.toVisit++
      by.set(camp.contractorUuid, e)
    }
    return {
      kind: 'bars',
      format: 'count',
      other: 'sum',
      sub: `${active.length} active camp${active.length === 1 ? '' : 's'} · by contractor`,
      empty: 'No active camps.',
      items: [...by.values()]
        .sort((a, b) => b.count - a.count || b.toVisit - a.toVisit)
        .map((e) => ({
          key: e.key,
          label: e.label,
          value: e.count,
          detail: e.toVisit ? `${e.toVisit} to inspect` : 'all up to date',
          tone: e.toVisit ? 'warn' : undefined,
          to: d.byUuid.has(e.key) ? `/contractors/${e.key}` : '/camps',
          hold: d.byUuid.has(e.key) ? { kind: 'contractor', uuid: e.key } : undefined,
        })),
    }
  }
  const rank = { never: 0, expired: 1, due: 2, ok: 3 } as const
  const toVisit = active
    .filter((r) => r.state.status !== 'ok')
    .sort((a, b) => rank[a.state.status] - rank[b.state.status] || (b.state.daysSince ?? 1e9) - (a.state.daysSince ?? 1e9))
  return {
    kind: 'rows',
    format: 'count',
    other: 'none',
    sub: `${toVisit.length} of ${active.length} camps · expired and due soon, worst first`,
    empty: 'Every camp is up to date.',
    items: toVisit.map(({ camp, state }) => ({
      key: camp.uuid,
      label: camp.name,
      value: state.daysSince ?? 0,
      detail: stateText(state),
      tone: campTone(state.status),
      to: `/camps/${camp.uuid}`,
      hold: { kind: 'camp', uuid: camp.uuid },
    })),
  }
}

/** What the chosen chip shows. */
export function exploreData(d: AllData, view: DashView, chip: string, options: ExploreOptions): ExploreData {
  const o: Required<ExploreOptions> = { today: localDate(), from: '/dashboard', ...options }
  if (view === 'tickets') return ticketData(d, chip, o)
  if (view === 'kpis') return kpiData(d, chip, o)
  return campData(d, chip, o)
}
