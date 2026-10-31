import { ageDays, isOpen } from './aging'
import { campState } from './camps'
import { addMonths, localDate, monthLabel, monthOf } from './dates'
import { closurePct, submissionsComplete } from './kpi'
import { auditPctFor, type AllData } from './kpiData'
import { kpiSubjects, subjectKpi, subjectManpower, type KpiSubject } from './subjects'
import type { IconName } from '../components/Icon'

// The To-do home: one card per item of the monthly routine. Data-driven so
// more items can be added to TODO_ITEMS without touching the page.

/** Declarations (WPS / manpower / salary) are due by this day of the month. */
export const SUBMISSION_DUE_DAY = 15

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
  month: string
  today: string
  day: number
  subjects: KpiSubject[]
}

type Item = (c: Ctx) => TodoCard

const missing = (subjects: KpiSubject[], has: (s: KpiSubject) => boolean) => subjects.filter((s) => !has(s)).length

/** "3 of 13 work orders" */
const ofWo = (n: number, total: number) => `${n} of ${total} work order${total === 1 ? '' : 's'}`

const enterItem =
  (key: string, title: string, icon: IconName, mode: string, has: (c: Ctx, s: KpiSubject) => boolean): Item =>
  (c) => {
    const todo = missing(c.subjects, (s) => has(c, s))
    return {
      key,
      title,
      icon,
      todo,
      total: c.subjects.length,
      detail: todo ? `${ofWo(todo, c.subjects.length)} not entered for ${monthLabel(c.month)}` : `All entered for ${monthLabel(c.month)}`,
      to: `/kpis/entry?m=${c.month}&mode=${mode}`,
    }
  }

export const TODO_ITEMS: Item[] = [
  // 1. Monthly submission
  (c) => {
    const todo = missing(c.subjects, (s) => submissionsComplete(subjectKpi(s, c.d.kpis, c.month)))
    const late = c.day > SUBMISSION_DUE_DAY
    return {
      key: 'submission',
      title: 'Monthly submission',
      icon: 'file-text',
      todo,
      total: c.subjects.length,
      detail: todo ? `${ofWo(todo, c.subjects.length)} missing WPS / manpower / salary` : 'WPS, manpower and salary all in',
      alert: todo
        ? late
          ? { level: 'bad', text: `${todo} overdue` }
          : { level: 'warn', text: `Due ${SUBMISSION_DUE_DAY}th` }
        : undefined,
      to: `/kpis/entry?m=${c.month}&mode=docs`,
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
    const pct = closurePct(c.d.tickets, c.month)
    const open = c.d.tickets.filter(isOpen).length
    return {
      key: 'closure',
      title: 'Ticket closure',
      icon: 'activity',
      todo: open,
      total: null,
      detail: pct === null ? 'No tickets this month' : `${Math.round(pct)}% closed in ${monthLabel(c.month)}`,
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
  enterItem('accommodation', 'Accommodation %', 'home', 'accommodation', (c, s) => {
    const k = subjectKpi(s, c.d.kpis, c.month)
    return k?.accommodationPct != null || auditPctFor(s.contractor, c.d.inspections, c.month) !== null
  }),
  enterItem('onboarding', 'Onboarding %', 'download', 'onboarding', (c, s) => subjectKpi(s, c.d.kpis, c.month)?.onboardingPct != null),
  enterItem('offboarding', 'Offboarding', 'upload', 'offboarding', (c, s) => {
    const k = subjectKpi(s, c.d.kpis, c.month)
    return !!k && (k.offboardTotal != null || k.legacy?.offboardingPct != null)
  }),
  enterItem('formal', 'Formal vs illegal workers', 'users', 'manpower', (c, s) => {
    const m = subjectManpower(s, c.d.manpower, c.month)
    return (!!m && m.totalWorkers > 0) || subjectKpi(s, c.d.kpis, c.month)?.legacy?.formalPct != null
  }),
  enterItem('meeting', 'Meeting attendance', 'clipboard', 'meeting', (c, s) => subjectKpi(s, c.d.kpis, c.month)?.meetingPct != null),
  // 10. Quarterly audit: any month of this quarter
  (c) => {
    const q = Math.floor((Number(c.month.slice(5, 7)) - 1) / 3)
    const first = `${c.month.slice(0, 4)}-${String(q * 3 + 1).padStart(2, '0')}`
    const months = [first, addMonths(first, 1), addMonths(first, 2)]
    const todo = missing(c.subjects, (s) => months.some((m) => subjectKpi(s, c.d.kpis, m)?.quarterlyAuditPct != null))
    const lastMonth = c.month === months[2]
    return {
      key: 'quarterly',
      title: 'Quarterly audit',
      icon: 'chart',
      todo,
      total: c.subjects.length,
      detail: todo ? `${ofWo(todo, c.subjects.length)} not done this quarter` : 'Done for this quarter',
      alert: todo && lastMonth ? { level: 'warn', text: 'Quarter ends this month' } : undefined,
      to: `/kpis/entry?m=${c.month}&mode=quarterly`,
    }
  },
]

/** All cards, alerts first (red, then amber), then open work, done last. */
export function buildTodo(d: AllData, today = localDate()): TodoCard[] {
  const ctx: Ctx = {
    d,
    today,
    month: monthOf(today),
    day: Number(today.slice(8, 10)),
    subjects: kpiSubjects(d.contractors, d.workOrders),
  }
  const rank = (c: TodoCard) => (c.alert?.level === 'bad' ? 0 : c.alert?.level === 'warn' ? 1 : c.todo ? 2 : 3)
  return TODO_ITEMS.map((f) => f(ctx)).sort((a, b) => rank(a) - rank(b))
}
