import { quarterlyAudits } from './audits'
import { DEFAULT_CYCLE_DAYS } from './camps'
import { closeoutTotals, closeouts } from './closeout'
import {
  auditAverage,
  campsSummary,
  inspectionsPerMonth,
  lastMonths,
  missingSubmissions,
  periodStats,
  recoveredPerMonth,
  workersPerMonth,
  workforce,
  type DashView,
} from './dashboard'
import { dayMonth, localDate, monthLabel } from './dates'
import { declarationsDue, dueTone } from './due'
import { kpiStatus, pct } from './kpi'
import { SUBMISSION_ITEMS } from './submissions'
import { itemStats, subjectKpis, type AllData } from './kpiData'
import { moneyStats, owedOf, sarShort } from './money'
import { ageParts, countDomain, partsTone, type Peek, type PeekPart } from './peek'
import { docsSettled, kpiSubjects } from './subjects'
import { closedIn, monthEnd, openOn, openedIn, ticketLink, type ListTab, type TicketQuery } from './ticketFilter'
import { WORDS, closedWithin, openTrend, ticketsOf } from './dashSource'
import { entryLink } from './entryItems'
import { turnedIntoTickets } from './caseLinks'
import { kpiTone, type Tone } from './tone'
import type { IconName } from '../components/Icon'

// The Dashboard's "Focus" strip: two to four big cards, swiped across. Each is
// one figure (a ring, a meter or a split), a line of meaning, one link, and
// what its long-press pop-up shows.

export type FigureKind = 'ring' | 'meter' | 'split'

export interface FocusAction {
  label: string
  icon: IconName
  to: string
}

export interface FocusCard {
  key: string
  title: string
  kind: FigureKind
  /** The big number as written ("42", "78%", "SAR 86K"). */
  value: string
  tone: Tone
  icon: IconName
  /** Ring: the parts of the whole. Split: the two parts under the number. */
  parts?: PeekPart[]
  /** Meter: 0–100 and its target. */
  meter?: { pct: number | null; target?: number }
  /** One line under the figure. */
  line: string
  link: { label: string; to: string }
  peek: Peek & { sub: string; actions: FocusAction[] }
}

export interface FocusOptions {
  /** The picked month, or null for all time (Tickets only). */
  month: string | null
  /** The month the KPI numbers are for (the picked month, or this month on All). */
  kpiMonth: string
  today?: string
  /** Where the Tickets list comes back to. */
  from?: string
  /** Tickets view: D&C tickets (default), cases, or all. */
  src?: ListTab
}

const SPARK_MONTHS = 6

/** Money for one month: recovered on tickets closed in it, still owed on those open at its end. */
function monthMoney(tickets: AllData['tickets'], month: string, end: string) {
  const settledT = tickets.filter((t) => owedOf(t) > 0 && closedIn(t, month))
  const owedT = tickets.filter((t) => owedOf(t) > 0 && openOn(t, end))
  const settled = settledT.reduce((s, t) => s + owedOf(t), 0)
  const outstanding = owedT.reduce((s, t) => s + owedOf(t), 0)
  return { settled, outstanding, total: settled + outstanding, withAmount: settledT.length + owedT.length }
}
const short = (m: string) => monthLabel(m).slice(0, 3)
const n = (v: number, one: string, many = `${one}s`) => `${v.toLocaleString('en-US')} ${v === 1 ? one : many}`
const daysTone = (avg: number | null): Tone => (avg === null ? 'none' : avg <= 10 ? 'good' : avg <= 30 ? 'warn' : 'bad')

function ticketCards(d: AllData, o: Required<FocusOptions>): FocusCard[] {
  const { month, kpiMonth, today, from, src } = o
  // The tab's list (D&C tickets, cases, or both) and its words; links open the list on the same tab.
  const list = ticketsOf(d, src)
  const w = WORDS[src]
  const tab = src === 'tickets' ? undefined : src
  const tix = (q: TicketQuery) => ticketLink({ ...q, tab }, from)
  const stats = periodStats(list, month, d.byUuid, today)
  const opened: TicketQuery = month ? { m: month, in: 'opened' } : {}
  const when = month ? monthLabel(month) : 'All time'
  const end = month ? monthEnd(month, today) : today
  const parts = ageParts(list, end)
  const open = parts.reduce((s, p) => s + p.value, 0)
  const late = parts[2].value
  const monthStats = month ? stats : periodStats(list, kpiMonth, d.byUuid, today)
  const months = lastMonths(kpiMonth, SPARK_MONTHS)
  const trend = openTrend(d, src, today).slice(-12).map((p) => p.open)
  const avg = monthStats.avgDaysToClose
  const dayFacts = [
    { label: 'Closed', value: monthStats.closed.length },
    { label: 'Opened', value: monthStats.opened.length },
    { label: 'Days to close', value: avg === null ? '—' : Math.round(avg), tone: avg === null ? undefined : daysTone(avg) },
  ]
  const openCard: FocusCard = {
    key: 'open',
    title: `Open ${w.Title.toLowerCase()}`,
    kind: 'ring',
    value: String(open),
    tone: partsTone(parts),
    icon: 'ticket',
    parts,
    line: month ? `${n(stats.opened.length, 'opened', 'opened')} · ${stats.closed.length} closed in ${short(month)}` : `${n(open, w.one, w.many)} open today`,
    link: late
      ? { label: `See the ${late} late`, to: tix(month ? { m: month, in: 'lateAtEnd' } : { in: 'lateAtEnd' }) }
      : { label: `Open ${w.many}`, to: tix(month ? { m: month, in: 'openAtEnd' } : { in: 'openAtEnd' }) },
    peek: {
      sub: when,
      facts: dayFacts,
      spark: { values: trend, label: `Open ${w.label}, last 12 weeks`, tone: partsTone(parts), domain: countDomain(trend) },
      partsLabel: `Open ${w.many} by age`,
      actions: [
        { label: `Open ${w.many}`, icon: 'ticket', to: tix(month ? { m: month, in: 'openAtEnd' } : { in: 'openAtEnd' }) },
        { label: 'Over 30 days', icon: 'alert', to: tix(month ? { m: month, in: 'lateAtEnd' } : { in: 'lateAtEnd' }) },
        { label: `Opened${month ? ` in ${short(month)}` : ''}`, icon: 'plus', to: tix(opened) },
        { label: `Closed${month ? ` in ${short(month)}` : ''}`, icon: 'check', to: tix(month ? { m: month, in: 'closed' } : { f: 'closed' }) },
      ],
    },
  }

  // The same number as the Closure KPI page: the average over work orders.
  const closure = itemStats(subjectKpis(d, kpiMonth), 'closure').avg
  const closureSpark = months.map((m) => {
    const v = itemStats(subjectKpis(d, m), 'closure').avg
    return v === null ? null : Math.round(v)
  })
  const closureCard: FocusCard = {
    key: 'closure',
    title: 'Closure',
    kind: 'meter',
    value: pct(closure),
    tone: kpiTone(kpiStatus(closure)),
    icon: 'gauge',
    meter: { pct: closure, target: 90 },
    line: `${monthStats.closed.length} closed · ${monthStats.opened.length} opened in ${short(kpiMonth)} · target 90%`,
    link: { label: `Closed in ${short(kpiMonth)}`, to: tix({ m: kpiMonth, in: 'closed' }) },
    peek: {
      sub: `${monthLabel(kpiMonth)} · average over work orders: closed of those open in the month`,
      facts: dayFacts,
      spark: { values: closureSpark, label: `Closure, last ${SPARK_MONTHS} months`, tone: kpiTone(kpiStatus(closure)), guide: 90 },
      actions: [
        { label: `Closed in ${short(kpiMonth)}`, icon: 'check', to: tix({ m: kpiMonth, in: 'closed' }) },
        { label: `Opened in ${short(kpiMonth)}`, icon: 'plus', to: tix({ m: kpiMonth, in: 'opened' }) },
        { label: 'Closure KPI page', icon: 'gauge', to: `/kpis/closure?m=${kpiMonth}` },
      ],
    },
  }

  // A month: recovered = money on tickets closed in it (as in Over time);
  // still owed = money on tickets open at its end. All: as of today.
  const money = month ? monthMoney(list, month, end) : moneyStats(list)
  const recovered = recoveredPerMonth(list, months).map((r) => r.values[0])
  const moneyCard: FocusCard = {
    key: 'money',
    title: 'Money',
    kind: 'split',
    value: `SAR ${sarShort(money.outstanding)}`,
    tone: money.outstanding ? 'bad' : money.withAmount ? 'good' : 'none',
    icon: 'money',
    parts: [
      { label: 'Recovered', value: money.settled, tone: 'good' },
      { label: 'Still owed', value: money.outstanding, tone: 'bad' },
    ],
    line: `SAR ${sarShort(money.settled)} recovered · ${n(money.withAmount, w.one, w.many)} with money`,
    link: { label: `Owed ${w.many}`, to: tix(month ? { m: month, in: 'openAtEnd', owed: 'open' } : { owed: 'open' }) },
    peek: {
      sub: `${when} · from ${w.many} only`,
      facts: [
        { label: 'Still owed', value: sarShort(money.outstanding), tone: money.outstanding ? 'bad' : undefined },
        { label: 'Recovered', value: sarShort(money.settled), tone: money.settled ? 'good' : undefined },
        { label: 'Total', value: sarShort(money.total) },
      ],
      spark: { values: recovered, label: `SAR recovered per month, last ${SPARK_MONTHS} months`, tone: money.settled ? 'good' : 'none', domain: countDomain(recovered) },
      actions: [
        { label: `Owed ${w.many}`, icon: 'money', to: tix(month ? { m: month, in: 'openAtEnd', owed: 'open' } : { owed: 'open' }) },
        { label: `Recovered ${w.many}`, icon: 'check', to: tix(month ? { m: month, in: 'closed', owed: 'paid' } : { owed: 'paid' }) },
        { label: 'All with money', icon: 'ticket', to: tix({ ...opened, owed: 'any' }) },
      ],
    },
  }
  if (src === 'tickets') return [openCard, closureCard, moneyCard]

  // Cases and All: no Closure KPI (cases aren't scored) — how fast they close instead.
  const fast = closedWithin(list, kpiMonth)
  const fastSpark = months.map((m) => closedWithin(list, m).pct)
  const closed30: FocusCard = {
    key: 'closed30',
    title: 'Closed in 30 days',
    kind: 'meter',
    value: pct(fast.pct),
    tone: fast.pct === null ? 'none' : 'info',
    icon: 'clock',
    meter: { pct: fast.pct },
    line: fast.closed ? `${fast.fast} of ${fast.closed} closed in ${short(kpiMonth)} took 30 days or less` : `None closed in ${short(kpiMonth)} yet`,
    link: { label: `Closed in ${short(kpiMonth)}`, to: tix({ m: kpiMonth, in: 'closed' }) },
    peek: {
      sub: `${monthLabel(kpiMonth)} · ${w.many} closed within 30 days of opening`,
      facts: dayFacts,
      spark: { values: fastSpark, label: `Closed within 30 days, last ${SPARK_MONTHS} months`, tone: 'info' },
      actions: [
        { label: `Closed in ${short(kpiMonth)}`, icon: 'check', to: tix({ m: kpiMonth, in: 'closed' }) },
        { label: `Opened in ${short(kpiMonth)}`, icon: 'plus', to: tix({ m: kpiMonth, in: 'opened' }) },
      ],
    },
  }

  // How many of the team's cases turned into D&C tickets (a list of cases, so it opens on Cases).
  const turned = turnedIntoTickets(d.cases, month)
  const caseList = (q: TicketQuery) => ticketLink({ ...q, tab: 'internal' }, from)
  const turnedSpark = months.map((m) => d.cases.filter((c) => openedIn(c, m) && !!c.linkedTicketUuid).length)
  const linked: FocusCard = {
    key: 'linked',
    title: 'Turned into tickets',
    kind: 'split',
    value: String(turned.linked),
    tone: turned.linked ? 'info' : 'none',
    icon: 'ticket',
    parts: [
      { label: 'Turned into tickets', value: turned.linked, tone: 'info' },
      { label: 'Still cases', value: turned.notLinked, tone: 'none' },
    ],
    line: `${turned.linked} of ${n(turned.total, 'case')}${month ? ` opened in ${short(month)}` : ''} turned into D&C tickets`,
    link: { label: 'See them', to: caseList({ ...opened, link: 'yes' }) },
    peek: {
      sub: `${when} · cases linked to the D&C ticket they became`,
      facts: [
        { label: 'Turned into tickets', value: turned.linked, tone: turned.linked ? 'info' : undefined },
        { label: 'Still cases', value: turned.notLinked },
        { label: 'Share', value: turned.total ? `${Math.round((turned.linked / turned.total) * 100)}%` : '—' },
      ],
      spark: { values: turnedSpark, label: `Cases that turned into tickets, by month opened, last ${SPARK_MONTHS} months`, tone: 'info', domain: countDomain(turnedSpark) },
      actions: [
        { label: 'Turned into tickets', icon: 'ticket', to: caseList({ ...opened, link: 'yes' }) },
        { label: 'Still cases', icon: 'megaphone', to: caseList({ ...opened, link: 'no' }) },
      ],
    },
  }
  return [openCard, linked, closed30, moneyCard]
}

function kpiCards(d: AllData, o: Required<FocusOptions>): FocusCard[] {
  const { kpiMonth, today } = o
  const subjectList = kpiSubjects(d.contractors, d.workOrders)
  const subjects = subjectKpis(d, kpiMonth)
  const overall = itemStats(subjects, 'overall')
  const months = lastMonths(kpiMonth, SPARK_MONTHS)
  const overallSpark = months.map((m) => {
    const v = itemStats(subjectKpis(d, m), 'overall').avg
    return v === null ? null : Math.round(v)
  })
  const overallTone = kpiTone(kpiStatus(overall.avg))
  const overallCard: FocusCard = {
    key: 'overall',
    title: 'Overall KPI',
    kind: 'ring',
    value: pct(overall.avg),
    tone: overallTone,
    icon: 'gauge',
    parts: [
      { label: 'On track', value: overall.good, tone: 'good' },
      { label: 'At risk', value: overall.warn, tone: 'warn' },
      { label: 'Critical', value: overall.bad, tone: 'bad' },
      { label: 'No data', value: overall.none, tone: 'none' },
    ],
    line: `${n(subjects.length, 'work order')} · target 90% · ${monthLabel(kpiMonth)}`,
    link: overall.bad
      ? { label: `See the ${overall.bad} critical`, to: `/kpis/overall?m=${kpiMonth}&s=bad` }
      : { label: 'Overall KPI', to: `/kpis/overall?m=${kpiMonth}` },
    peek: {
      sub: `${monthLabel(kpiMonth)} · average over ${n(subjects.length, 'work order')}`,
      facts: [
        { label: 'Overall', value: pct(overall.avg), tone: overallTone === 'none' ? undefined : overallTone },
        { label: 'Critical', value: overall.bad, tone: overall.bad ? 'bad' : undefined },
        { label: 'On track', value: overall.good, tone: overall.good ? 'good' : undefined },
      ],
      spark: { values: overallSpark, label: `Overall KPI, last ${SPARK_MONTHS} months`, tone: overallTone, guide: 90 },
      actions: [
        { label: 'Overall KPI page', icon: 'gauge', to: `/kpis/overall?m=${kpiMonth}` },
        { label: 'Compare contractors', icon: 'table', to: '/compare' },
        { label: 'Critical only', icon: 'alert', to: `/kpis/overall?m=${kpiMonth}&s=bad` },
      ],
    },
  }

  const missing = missingSubmissions(subjectList, d.kpis, kpiMonth).length
  const total = subjectList.length
  const inCount = total - missing
  const due = declarationsDue(kpiMonth)
  const subTone: Tone = total === 0 ? 'none' : missing ? (dueTone(due, today) ?? 'info') : 'good'
  const subSpark = months.map((m) => (total ? Math.round((subjectList.filter((s) => docsSettled(s, d.kpis, m)).length / total) * 100) : null))
  const submissionsCard: FocusCard = {
    key: 'submissions',
    title: 'Documents',
    kind: 'meter',
    value: `${inCount} of ${total}`,
    tone: subTone,
    icon: 'file-text',
    meter: { pct: total ? (inCount / total) * 100 : null },
    line: `Work orders with all ${SUBMISSION_ITEMS.length} documents for ${short(kpiMonth)} · due ${dayMonth(due)} · ${missing} missing`,
    link: { label: 'Monthly entry', to: entryLink({ m: kpiMonth }) },
    peek: {
      sub: `${monthLabel(kpiMonth)} · due ${dayMonth(due)}`,
      facts: [
        { label: 'In', value: inCount, tone: inCount && !missing ? 'good' : undefined },
        { label: 'Missing', value: missing, tone: missing ? (subTone === 'info' ? 'warn' : subTone) : undefined },
        { label: 'Due', value: dayMonth(due) },
      ],
      spark: { values: subSpark, label: `Work orders with every document in, last ${SPARK_MONTHS} months`, tone: subTone === 'info' ? 'none' : subTone, guide: 100 },
      actions: [
        { label: 'Monthly entry', icon: 'file-text', to: entryLink({ m: kpiMonth }) },
        { label: 'Submission KPI page', icon: 'gauge', to: `/kpis/submission?m=${kpiMonth}` },
      ],
    },
  }

  const co = closeoutTotals(closeouts(subjectList, d.kpis, today))
  const quarters = quarterlyAudits(d, subjectList)
  const latestQ = quarters[0]
  const qSpark = [...quarters].reverse().slice(-SPARK_MONTHS).map((q) => Math.round(q.avg))
  const coTone = kpiTone(kpiStatus(co.pct))
  const auditsCard: FocusCard = {
    key: 'audits',
    title: 'Audits',
    kind: 'meter',
    value: pct(co.pct),
    tone: co.overdue ? 'bad' : coTone,
    icon: 'seal',
    meter: { pct: co.pct },
    line: `${n(co.open, 'finding')} open · ${co.overdue} overdue · ${n(co.findings, 'finding')} logged`,
    link: { label: 'Close-outs', to: '/closeouts' },
    peek: {
      sub: latestQ ? `Latest quarter ${latestQ.label} · ${latestQ.audited} of ${latestQ.total} audited` : 'No quarterly audit scores yet',
      facts: [
        { label: 'Findings open', value: co.open, tone: co.open ? 'warn' : undefined },
        { label: 'Overdue', value: co.overdue, tone: co.overdue ? 'bad' : undefined },
        { label: 'Quarter score', value: latestQ ? pct(latestQ.avg) : '—', tone: latestQ ? kpiTone(kpiStatus(latestQ.avg)) : undefined },
      ],
      spark: qSpark.length ? { values: qSpark, label: `Quarter average, last ${qSpark.length} quarters`, tone: latestQ ? kpiTone(kpiStatus(latestQ.avg)) : 'none', guide: 90 } : undefined,
      actions: [
        { label: 'Close-outs', icon: 'seal', to: '/closeouts' },
        { label: 'Quarterly audits', icon: 'clipboard', to: entryLink({ by: 'item', item: 'quarterly', m: latestQ?.lastMonth ?? kpiMonth }) },
      ],
    },
  }

  const wf = workforce(subjectList, d.manpower, kpiMonth)
  const wfMonth = wf.month ?? kpiMonth
  const wfSpark = workersPerMonth(subjectList, d.manpower, months).map((r) => r.values[0] || null)
  const workersCard: FocusCard = {
    key: 'workers',
    title: 'Workers',
    kind: 'split',
    value: wf.total ? wf.total.toLocaleString('en-US') : '—',
    tone: !wf.total ? 'none' : wf.illegal ? 'bad' : 'good',
    icon: 'users',
    parts: [
      { label: 'Formal', value: wf.total - wf.illegal, tone: 'good' },
      { label: 'Illegal / freelance', value: wf.illegal, tone: 'bad' },
    ],
    line: `${wf.illegal} illegal · ${wf.visaExpiring} visas expiring · ${wf.missing} not declared${wf.month && wf.month !== kpiMonth ? ` · ${short(wf.month)}` : ''}`,
    link: { label: 'Workers', to: entryLink({ by: 'item', item: 'workers', m: wfMonth }) },
    peek: {
      sub: `Counts only · ${monthLabel(wfMonth)}`,
      facts: [
        { label: 'Illegal', value: wf.illegal, tone: wf.illegal ? 'bad' : wf.total ? 'good' : undefined },
        { label: 'Visas ≤30 days', value: wf.visaExpiring, tone: wf.visaExpiring ? 'warn' : undefined },
        { label: 'Paid fees', value: wf.paidFees, tone: wf.paidFees ? 'bad' : undefined },
      ],
      spark: { values: wfSpark, label: `Workers declared, last ${SPARK_MONTHS} months`, tone: wf.total ? 'info' : 'none', domain: countDomain(wfSpark) },
      actions: [
        { label: 'Workers', icon: 'users', to: entryLink({ by: 'item', item: 'workers', m: wfMonth }) },
        { label: 'Not declared', icon: 'alert', to: entryLink({ by: 'item', item: 'workers', m: kpiMonth }) },
      ],
    },
  }
  return [overallCard, submissionsCard, auditsCard, workersCard]
}

function campCards(d: AllData, o: Required<FocusOptions>): FocusCard[] {
  const { kpiMonth, today } = o
  const camps = campsSummary(d.camps, d.inspections, today)
  const months = lastMonths(kpiMonth, SPARK_MONTHS)
  const expired = camps.expired + camps.never
  const toVisit = camps.toVisit.length
  const inspSpark = inspectionsPerMonth(d.inspections, months).map((r) => r.values[0])
  const campsTone: Tone = expired ? 'bad' : camps.due ? 'warn' : camps.active ? 'good' : 'none'
  const campsCard: FocusCard = {
    key: 'camps',
    title: 'Camps',
    kind: 'ring',
    value: String(camps.active),
    tone: campsTone,
    icon: 'tent',
    parts: [
      { label: 'Up to date', value: camps.ok, tone: 'good' },
      { label: 'Due soon', value: camps.due, tone: 'warn' },
      { label: 'Expired', value: expired, tone: 'bad' },
    ],
    line: `${n(camps.active, 'active camp')} · inspected every ${DEFAULT_CYCLE_DAYS} days`,
    link: toVisit ? { label: `See the ${toVisit} to inspect`, to: expired ? '/camps?s=expired' : '/camps?s=due' } : { label: 'Open camps', to: '/camps' },
    peek: {
      sub: 'Today',
      facts: [
        { label: 'Up to date', value: camps.ok, tone: camps.ok ? 'good' : undefined },
        { label: 'Due soon', value: camps.due, tone: camps.due ? 'warn' : undefined },
        { label: 'Expired', value: expired, tone: expired ? 'bad' : undefined },
      ],
      spark: { values: inspSpark, label: `Inspections per month, last ${SPARK_MONTHS} months`, tone: campsTone, domain: countDomain(inspSpark) },
      actions: [
        { label: 'Open camps', icon: 'tent', to: '/camps' },
        { label: 'Expired', icon: 'alert', to: '/camps?s=expired' },
        { label: 'Due soon', icon: 'clock', to: '/camps?s=due' },
      ],
    },
  }

  const audits = auditAverage(d.inspections, kpiMonth)
  const scoreSpark = months.map((m) => {
    const v = auditAverage(d.inspections, m).avg
    return v === null ? null : Math.round(v)
  })
  const scoreTone = kpiTone(kpiStatus(audits.avg))
  const inspectionsCard: FocusCard = {
    key: 'inspections',
    title: 'Inspections',
    kind: 'meter',
    value: pct(audits.avg),
    tone: scoreTone,
    icon: 'clipboard',
    meter: { pct: audits.avg, target: 90 },
    line: `${n(audits.count, 'inspection')} in ${monthLabel(kpiMonth)} · average score · target 90%`,
    link: { label: 'Audits', to: '/audits' },
    peek: {
      sub: monthLabel(kpiMonth),
      facts: [
        { label: 'Inspections', value: audits.count },
        { label: 'Avg score', value: pct(audits.avg), tone: scoreTone === 'none' ? undefined : scoreTone },
        { label: 'Camps', value: camps.active },
      ],
      spark: { values: scoreSpark, label: `Average inspection score, last ${SPARK_MONTHS} months`, tone: scoreTone, guide: 90 },
      actions: [
        { label: 'Open audits', icon: 'clipboard', to: '/audits' },
        { label: 'Open camps', icon: 'tent', to: '/camps' },
      ],
    },
  }
  return [campsCard, inspectionsCard]
}

/** The Focus cards of a view, in strip order. */
export function focusCards(d: AllData, view: DashView, options: FocusOptions): FocusCard[] {
  const o: Required<FocusOptions> = { today: localDate(), from: '/dashboard', src: 'tickets', ...options }
  if (view === 'tickets') return ticketCards(d, o)
  if (view === 'kpis') return kpiCards(d, o)
  return campCards(d, o)
}
