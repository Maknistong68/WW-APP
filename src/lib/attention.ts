import { ageDays, isOpen } from './aging'
import { closeoutTotals, closeouts } from './closeout'
import { campsSummary, missingSubmissions, openAging, workforce } from './dashboard'
import { localDate, monthOf } from './dates'
import { kpisForMonth, type AllData } from './kpiData'
import { sar } from './money'
import { kpiSubjects, subjectManpower } from './subjects'
import { SUBMISSION_DUE_DAY } from './todo'

/** One "needs attention" line, shared by the 2D Overview and the 3D tour. */
export interface Attention {
  key: string
  tone: 'bad' | 'warn'
  text: string
  /** Where tapping it goes in the app. */
  to: string
  /** What the 3D camera flies to. */
  focus?: { kind: 'contractor' | 'camp'; uuid: string }
}

/** Uuid with the highest score, or undefined when nobody scores above zero. */
function top<T>(items: T[], score: (x: T) => number, id: (x: T) => string): string | undefined {
  let best: T | undefined
  let bestScore = 0
  for (const x of items) {
    const s = score(x)
    if (s > bestScore) {
      best = x
      bestScore = s
    }
  }
  return best ? id(best) : undefined
}

/** The worst problems for a month, red first, at most `limit`. */
export function buildAttention(d: AllData, month: string, today = localDate(), limit = 6): Attention[] {
  const isNow = month === monthOf(today)
  const subjects = kpiSubjects(d.contractors, d.workOrders)
  const aging = openAging(d.tickets, today)
  const late = aging.slice(2)
  const lateCount = late.reduce((s, r) => s + r.count, 0)
  const lateOwed = late.reduce((s, r) => s + r.owed, 0)
  const kpis = kpisForMonth(d, month)
  const rated = d.contractors.filter((c) => c.active).map((c) => ({ c, r: kpis.get(c.uuid) })).filter((x) => x.r && x.r.overall !== null)
  const critical = rated.filter(({ r }) => r!.status === 'bad')
  const camps = campsSummary(d.camps, d.inspections, today)
  const campsLate = camps.expired + camps.never
  const missingDocs = missingSubmissions(subjects, d.kpis, month)
  const docsLate = isNow ? Number(today.slice(8, 10)) > SUBMISSION_DUE_DAY : month < monthOf(today)
  const wf = workforce(subjects, d.manpower, month)
  const coList = closeouts(subjects, d.kpis, today)
  const co = closeoutTotals(coList)
  const lateTickets = d.tickets.filter((t) => isOpen(t) && ageDays(t, today) > 30)
  const byContractor = (pick: (t: (typeof lateTickets)[number]) => number) => {
    const m = new Map<string, number>()
    for (const t of lateTickets) if (t.contractorUuid) m.set(t.contractorUuid, (m.get(t.contractorUuid) ?? 0) + pick(t))
    return top([...m.entries()], ([, v]) => v, ([k]) => k)
  }
  const visaBy = new Map<string, number>()
  if (wf.month)
    for (const s of subjects) {
      const m = subjectManpower(s, d.manpower, wf.month)
      if (m?.visaExpiring30d) visaBy.set(s.contractor.uuid, (visaBy.get(s.contractor.uuid) ?? 0) + m.visaExpiring30d)
    }
  const contractor = (uuid: string | undefined) => (uuid ? { kind: 'contractor' as const, uuid } : undefined)
  const camp = (uuid: string | undefined) => (uuid ? { kind: 'camp' as const, uuid } : undefined)
  const s = (n: number) => (n === 1 ? '' : 's')

  const out: Attention[] = []
  if (lateCount)
    out.push({ key: 'late', tone: 'bad', text: `${lateCount} ticket${s(lateCount)} open over 30 days`, to: '/tickets?f=late', focus: contractor(byContractor(() => 1)) })
  if (lateOwed)
    out.push({ key: 'owed', tone: 'bad', text: `${sar(lateOwed)} owed, over 30 days`, to: '/dashboard?v=money', focus: contractor(byContractor((t) => t.amountOwed ?? 0)) })
  if (critical.length)
    out.push({
      key: 'kpi',
      tone: 'bad',
      text: `${critical.length} contractor${s(critical.length)} below 70% KPI`,
      to: '/dashboard?v=kpis',
      focus: contractor(top(critical, ({ r }) => 101 - (r!.overall ?? 0), ({ c }) => c.uuid)),
    })
  const coFocus = coList.find((c) => c.status === 'overdue') ?? coList.find((c) => c.status === 'due')
  if (co.overdue)
    out.push({ key: 'closeout', tone: 'bad', text: `${co.overdue} audit close-out${s(co.overdue)} overdue`, to: '/closeouts', focus: contractor(coFocus?.subject.contractor.uuid) })
  else if (co.due)
    out.push({ key: 'closeout', tone: 'warn', text: `${co.due} audit close-out${s(co.due)} due soon`, to: '/closeouts', focus: contractor(coFocus?.subject.contractor.uuid) })
  if (campsLate) {
    const first = camps.toVisit.find((v) => v.state.status === 'expired' || v.state.status === 'never')
    out.push({ key: 'camps', tone: 'bad', text: `${campsLate} camp${s(campsLate)} overdue for inspection`, to: '/camps', focus: camp(first?.camp.uuid) })
  }
  if (missingDocs.length)
    out.push({
      key: 'docs',
      tone: docsLate ? 'bad' : 'warn',
      text: `${missingDocs.length} missing WPS / MP / salary${docsLate ? '' : ` · due ${SUBMISSION_DUE_DAY}th`}`,
      to: `/missing/submission?m=${month}`,
      focus: contractor(missingDocs[0]?.contractor.uuid),
    })
  if (camps.due) {
    const first = camps.toVisit.find((v) => v.state.status === 'due')
    out.push({ key: 'due', tone: 'warn', text: `${camps.due} camp${s(camps.due)} due for inspection soon`, to: '/camps', focus: camp(first?.camp.uuid) })
  }
  if (wf.illegal)
    out.push({
      key: 'illegal',
      tone: 'warn',
      text: `${wf.illegal} illegal / freelance worker${s(wf.illegal)}`,
      to: '/dashboard?v=workers',
      focus: contractor(top(wf.byContractor, (c) => c.illegal, (c) => c.key)),
    })
  if (wf.visaExpiring)
    out.push({
      key: 'visa',
      tone: 'warn',
      text: `${wf.visaExpiring} visa${s(wf.visaExpiring)} expiring within 30 days`,
      to: '/dashboard?v=workers',
      focus: contractor(top([...visaBy.entries()], ([, v]) => v, ([k]) => k)),
    })
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1)).slice(0, limit)
}
