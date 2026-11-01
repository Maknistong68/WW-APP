import { ageDays, isOpen } from './aging'
import { campState } from './camps'
import { addMonths, dayMonth, localDate, monthLabel, monthOf } from './dates'
import { declarationsDue, dueTone, kpisDue, lastEndedMonth } from './due'
import { closurePct, submissionsComplete } from './kpi'
import { auditPctFor, type AllData } from './kpiData'
import { kpiSubjects, subjectKpi, subjectManpower, type KpiSubject } from './subjects'
import { closeoutState, closeoutTotals, closeouts } from './closeout'
import type { IconName } from '../components/Icon'

// The Home screen: one card per item of the monthly routine. Data-driven so
// more items can be added to TODO_ITEMS without touching the page.
// Monthly items look at the last month that ended (they are due in the month after it).

export interface TodoAlert {
  level: 'bad' | 'warn'
  text: string
}

export interface TodoCard {
  key: string
  title: string
  icon: IconName
  /** Things still to do (0 = done). */
  todo: number
  /** Out of how many (for "3 of 13"); null when not countable. */
  total: number | null
  /** One short line under the title. */
  detail: string
  alert?: TodoAlert
  /** Where tapping the card goes. */
  to: string
}

interface Ctx {
  d: AllData
  /** The last month that ended: its declarations and KPIs are coming due. */
  month: string
  /** The month we're in (ticket closure, this quarter). */
  thisMonth: string
  today: string
  subjects: KpiSubject[]
}

type Item = (c: Ctx) => TodoCard

/** The three months of the quarter that `month` falls in. */
export function quarterMonths(month: string): string[] {
  const q = Math.floor((Number(month.slice(5, 7)) - 1) / 3)
  const first = `${month.slice(0, 4)}-${String(q * 3 + 1).padStart(2, '0')}`
  return [first, addMonths(first, 1), addMonths(first, 2)]
}

/** Items entered per work order each month; their Home tile opens the "still missing" list. */
export type SubjectItemKey = 'submission' | 'accommodation' | 'onboarding' | 'offboarding' | 'formal' | 'meeting' | 'quarterly'

export interface SubjectItem {
  title: string
  /** Which sheet fills it in. */
  sheet: 'kpi' | 'manpower'
  done: (d: AllData, s: KpiSubject, month: string) => boolean
  /** What is entered so far, e.g. "92%" or "WPS · Salary". */
  value: (d: AllData, s: KpiSubject, month: string) => string
}

const kpiOf = (d: AllData, s: KpiSubject, month: string) => subjectKpi(s, d.kpis, month)
const pctText = (v: number | null | undefined) => (v === null || v === undefined ? '' : `${Math.round(v)}%`)

export const SUBJECT_ITEMS: Record<SubjectItemKey, SubjectItem> = {
  submission: {
    title: 'Monthly submission',
    sheet: 'kpi',
    done: (d, s, m) => submissionsComplete(kpiOf(d, s, m)),
    value: (d, s, m) => {
      const k = kpiOf(d, s, m)
      const missing = [!k?.wps && 'WPS', !k?.manpowerDecl && 'Manpower', !k?.salaryDecl && 'Salary'].filter(Boolean)
      return missing.length === 3 ? '' : missing.length ? `Missing ${missing.join(', ')}` : 'All 3 in'
    },
  },
  accommodation: {
    title: 'Accommodation %',
    sheet: 'kpi',
    done: (d, s, m) => kpiOf(d, s, m)?.accommodationPct != null || auditPctFor(s.contractor, d.inspections, m) !== null,
    value: (d, s, m) => {
      const typed = kpiOf(d, s, m)?.accommodationPct
      if (typed != null) return pctText(typed)
      const audit = auditPctFor(s.contractor, d.inspections, m)
      return audit === null ? '' : `${pctText(audit)} from audit`
    },
  },
  onboarding: {
    title: 'Onboarding %',
    sheet: 'kpi',
    done: (d, s, m) => kpiOf(d, s, m)?.onboardingPct != null,
    value: (d, s, m) => pctText(kpiOf(d, s, m)?.onboardingPct),
  },
  offboarding: {
    title: 'Offboarding',
    sheet: 'kpi',
    done: (d, s, m) => {
      const k = kpiOf(d, s, m)
      return !!k && (k.offboardTotal != null || k.legacy?.offboardingPct != null)
    },
    value: (d, s, m) => {
      const k = kpiOf(d, s, m)
      if (k?.offboardTotal != null) return `${k.offboarded ?? 0} of ${k.offboardTotal} on time`
      return pctText(k?.legacy?.offboardingPct)
    },
  },
  formal: {
    title: 'Formal vs illegal workers',
    sheet: 'manpower',
    done: (d, s, m) => {
      const mp = subjectManpower(s, d.manpower, m)
      return (!!mp && mp.totalWorkers > 0) || kpiOf(d, s, m)?.legacy?.formalPct != null
    },
    value: (d, s, m) => {
      const mp = subjectManpower(s, d.manpower, m)
      if (mp && mp.totalWorkers > 0) return `${mp.totalWorkers} workers · ${mp.illegalOrFreelance} illegal`
      return pctText(kpiOf(d, s, m)?.legacy?.formalPct)
    },
  },
  meeting: {
    title: 'Meeting attendance',
    sheet: 'kpi',
    done: (d, s, m) => kpiOf(d, s, m)?.meetingPct != null,
    value: (d, s, m) => pctText(kpiOf(d, s, m)?.meetingPct),
  },
  quarterly: {
    title: 'Quarterly audit',
    sheet: 'kpi',
    done: (d, s, m) => quarterMonths(m).some((q) => kpiOf(d, s, q)?.quarterlyAuditPct != null),
    value: (d, s, m) => {
      const hit = quarterMonths(m).find((q) => kpiOf(d, s, q)?.quarterlyAuditPct != null)
      if (!hit) return ''
      const co = closeoutState(kpiOf(d, s, hit))
      return [pctText(kpiOf(d, s, hit)?.quarterlyAuditPct), monthLabel(hit), co && `${co.closed}/${co.findings} findings closed`]
        .filter(Boolean)
        .join(' · ')
    },
  },
}

export const isSubjectItem = (k: string): k is SubjectItemKey => k in SUBJECT_ITEMS

/** Every active subject for one item and month, the missing ones first. */
export function subjectRows(d: AllData, key: SubjectItemKey, month: string) {
  const item = SUBJECT_ITEMS[key]
  return kpiSubjects(d.contractors, d.workOrders)
    .map((s) => ({ s, done: item.done(d, s, month), value: item.value(d, s, month) }))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.s.label.localeCompare(b.s.label))
}

const missing = (c: Ctx, key: SubjectItemKey, month = c.month) => c.subjects.filter((s) => !SUBJECT_ITEMS[key].done(c.d, s, month)).length

/** Red "N overdue" after the due date, amber "Due 15 Nov" in the week before it. */
function dueAlert(todo: number, due: string, today: string): TodoAlert | undefined {
  if (!todo) return undefined
  const tone = dueTone(due, today)
  if (tone === 'bad') return { level: 'bad', text: `${todo} overdue` }
  if (tone === 'warn') return { level: 'warn', text: `Due ${dayMonth(due)}` }
  return undefined
}

/** "3 of 13 work orders" */
const ofWo = (n: number, total: number) => `${n} of ${total} work order${total === 1 ? '' : 's'}`

const missingLink = (key: SubjectItemKey, month: string) => `/missing/${key}?m=${month}`

const enterItem =
  (key: SubjectItemKey, icon: IconName): Item =>
  (c) => {
    const todo = missing(c, key)
    return {
      key,
      title: SUBJECT_ITEMS[key].title,
      icon,
      todo,
      total: c.subjects.length,
      detail: todo ? `${ofWo(todo, c.subjects.length)} not entered for ${monthLabel(c.month)}` : `All entered for ${monthLabel(c.month)}`,
      alert: dueAlert(todo, kpisDue(c.month), c.today),
      to: missingLink(key, c.month),
    }
  }

export const TODO_ITEMS: Item[] = [
  // 1. Monthly submission
  (c) => {
    const todo = missing(c, 'submission')
    const month = monthLabel(c.month)
    return {
      key: 'submission',
      title: SUBJECT_ITEMS.submission.title,
      icon: 'file-text',
      todo,
      total: c.subjects.length,
      detail: todo ? `${ofWo(todo, c.subjects.length)} missing WPS / manpower / salary for ${month}` : `WPS, manpower and salary all in for ${month}`,
      alert: dueAlert(todo, declarationsDue(c.month), c.today),
      to: missingLink('submission', c.month),
    }
  },
  // 2. Grievance = open tickets
  (c) => {
    const open = c.d.tickets.filter(isOpen)
    const late = open.filter((t) => ageDays(t, c.today) > 30).length
    return {
      key: 'grievance',
      title: 'Grievance · open tickets',
      icon: 'ticket',
      todo: open.length,
      total: null,
      detail: open.length ? `${open.length} open · ${open.reduce((s, t) => s + (t.workers || 0), 0)} workers` : 'No open tickets',
      alert: late ? { level: 'bad', text: `${late} over 30 days` } : undefined,
      to: late ? '/tickets?f=late' : '/tickets',
    }
  },
  // 3. Ticket closure this month
  (c) => {
    const pct = closurePct(c.d.tickets, c.thisMonth)
    const open = c.d.tickets.filter(isOpen).length
    return {
      key: 'closure',
      title: 'Ticket closure',
      icon: 'activity',
      todo: open,
      total: null,
      detail: pct === null ? 'No tickets this month' : `${Math.round(pct)}% closed in ${monthLabel(c.thisMonth)}`,
      alert: pct !== null && pct < 70 ? { level: 'warn', text: `${Math.round(pct)}%` } : undefined,
      to: '/tickets',
    }
  },
  // 4. Camp inspections (every 90 days)
  (c) => {
    const camps = c.d.camps.filter((x) => x.active)
    const states = camps.map((x) => campState(x, c.d.inspections, c.today).status)
    const expired = states.filter((s) => s === 'expired' || s === 'never').length
    const due = states.filter((s) => s === 'due').length
    return {
      key: 'camps',
      title: 'Camp inspections',
      icon: 'tent',
      todo: expired + due,
      total: camps.length,
      detail: camps.length ? `${camps.length - expired - due} of ${camps.length} camps up to date` : 'Add your camps to track inspections',
      alert: expired ? { level: 'bad', text: `${expired} expired` } : due ? { level: 'warn', text: `${due} due soon` } : undefined,
      to: '/camps',
    }
  },
  // 5. Accommodation score (typed, or from this month's audit)
  enterItem('accommodation', 'home'),
  enterItem('onboarding', 'download'),
  enterItem('offboarding', 'upload'),
  enterItem('formal', 'users'),
  enterItem('meeting', 'clipboard'),
  // 10. Quarterly audit: any month of this quarter
  (c) => {
    const months = quarterMonths(c.thisMonth)
    const todo = missing(c, 'quarterly', c.thisMonth)
    const lastMonth = c.thisMonth === months[2]
    return {
      key: 'quarterly',
      title: SUBJECT_ITEMS.quarterly.title,
      icon: 'chart',
      todo,
      total: c.subjects.length,
      detail: todo ? `${ofWo(todo, c.subjects.length)} not done this quarter` : 'Done for this quarter',
      alert: todo && lastMonth ? { level: 'warn', text: 'Quarter ends this month' } : undefined,
      to: missingLink('quarterly', c.thisMonth),
    }
  },
  // 11. Quarterly audit close-out: findings still open, against the due date
  (c) => {
    const list = closeouts(c.subjects, c.d.kpis, c.today)
    const t = closeoutTotals(list)
    return {
      key: 'closeout',
      title: 'Audit close-out',
      icon: 'clock',
      todo: t.audits,
      total: null,
      detail: t.audits ? `${t.open} finding${t.open === 1 ? '' : 's'} open in ${t.audits} audit${t.audits === 1 ? '' : 's'}` : 'All audit findings closed',
      alert: t.overdue
        ? { level: 'bad', text: `${t.overdue} overdue` }
        : t.due
          ? { level: 'warn', text: `${t.due} due soon` }
          : undefined,
      to: '/closeouts',
    }
  },
]

/** All cards, alerts first (red, then amber), then open work, done last. */
export function buildTodo(d: AllData, today = localDate()): TodoCard[] {
  const ctx: Ctx = {
    d,
    today,
    month: lastEndedMonth(today),
    thisMonth: monthOf(today),
    subjects: kpiSubjects(d.contractors, d.workOrders),
  }
  const rank = (c: TodoCard) => (c.alert?.level === 'bad' ? 0 : c.alert?.level === 'warn' ? 1 : c.todo ? 2 : 3)
  return TODO_ITEMS.map((f) => f(ctx)).sort((a, b) => rank(a) - rank(b))
}
