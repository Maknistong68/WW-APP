import { ageDays, isOpen } from './aging'
import { campState } from './camps'
import { closeouts } from './closeout'
import { workforce } from './dashboard'
import { addDays, addMonths, dayMonth, daysDiff, localDate, monthLabel, monthOf, monthRange } from './dates'
import { declarationsDue, dueTone, kpisDue, lastEndedMonth } from './due'
import { SUBMISSION_ITEMS as DOCS, awaitedItems, docState, shortList, submissionCounts } from './submissions'
import { kpisForMonth, type AllData } from './kpiData'
import { kpiSubjects, subjectKpi, subjectPrior, woOf, type KpiSubject } from './subjects'
import { SUBJECT_ITEMS, quarterMonths, type SubjectItemKey } from './todo'
import type { Tone } from './tone'
import type { IconName } from '../components/Icon'
import { nextDue, repeatText, routineGroup } from './routines'
import { shortName } from './names'
import { sourceTab, type SourceTab } from './ticketFilter'
import type { Routine, Ticket } from '../types'
import type { MenuItem } from './hues'
import { MONTHLY_KPIS, entryLink } from './entryItems'

// Home as a task list: everything to do, by name and due date. Urgent things
// (overdue, due within 7 days) get a row each; later ones are grouped per
// month. A month's documents are due the 15th of the next month, its other
// KPIs by the end of the next month (src/lib/due.ts). Gaps are chased from
// TASKS_FROM, for up to MAX_CARRY ended months; older ones fold into one row.

/** The first month the app chases (older imported months had blanks that can't be fixed). */
export const TASKS_FROM = '2026-10'
/** Ended months kept as their own rows. */
export const MAX_CARRY = 3
/** Overdue tickets named one by one before a "more" row. */
export const TICKET_CAP = 5

export type TaskGroup = 'overdue' | 'week' | 'later' | 'done'
export type TaskKind = 'declarations' | 'kpis' | 'ticket' | 'tickets' | 'camp' | 'closeout' | 'quarterly' | 'draft' | 'older' | 'done' | 'routine'

export interface Task {
  key: string
  kind: TaskKind
  group: TaskGroup
  /** Who or what: "RPCO · WO 882", "Project Pioneers" (a ticket's contractor), "Camp 3", "October documents". */
  title: string
  /** What: "Oct: 4 of 11 in · Minutes, Water test +5". */
  detail: string
  /** YYYY-MM-DD, or null when there is no deadline. */
  due: string | null
  /** The chip: "1d late", "due 15 Nov", "Continue". */
  dueText: string
  tone: Tone
  icon: IconName
  /** Where a tap goes when there's nothing to fill in. */
  to: string
  /** How many things it stands for (a grouped row, "3 more"). */
  weight: number
  /** The work order and month to fill in. */
  subject?: { contractorUuid: string; workOrderUuid: string; month: string }
  sheet?: 'kpi' | 'manpower' | 'submission'
  ticketUuid?: string
  /** A ticket row's tab on the Tickets card: D&C (tickets) or Cases (internal). */
  ticketSource?: SourceTab
  campUuid?: string
  inspectionId?: number
  /** A grouped row's own rows (expand in place). */
  members?: Task[]
  /** What it means (the long-press note). */
  help?: string
  /** A routine task (added by the team): tick it off from the row. */
  routine?: Routine
}

export interface WatchItem {
  key: string
  n: number
  text: string
  tone: Tone
  to: string
}

export interface TaskList {
  tasks: Task[]
  counts: Record<TaskGroup, number>
  /** Entered items for the newest month being chased. */
  progress: { month: string; done: number; total: number } | null
  /** Risks without a deadline. */
  watch: WatchItem[]
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const longMonth = (m: string) => MONTH_NAMES[Number(m.slice(5, 7)) - 1]
const shortMonth = (m: string) => monthLabel(m).slice(0, 3)
const s = (n: number) => (n === 1 ? '' : 's')

/** Ended months from TASKS_FROM, newest first, at most MAX_CARRY. */
export function taskMonths(today = localDate()): string[] {
  const out: string[] = []
  for (let m = lastEndedMonth(today); m >= TASKS_FROM && out.length < MAX_CARRY; m = addMonths(m, -1)) out.push(m)
  return out
}

/** Ended months from TASKS_FROM that are older than the carry window. */
function olderMonths(today: string): string[] {
  const recent = taskMonths(today)
  const out: string[] = []
  if (recent.length < MAX_CARRY) return out
  for (let m = addMonths(recent[recent.length - 1], -1); m >= TASKS_FROM; m = addMonths(m, -1)) out.push(m)
  return out
}

const groupFor = (due: string, today: string): TaskGroup => {
  const t = dueTone(due, today)
  return t === 'bad' ? 'overdue' : t === 'warn' ? 'week' : 'later'
}
const toneFor = (g: TaskGroup): Tone => (g === 'overdue' ? 'bad' : g === 'week' ? 'warn' : g === 'done' ? 'good' : 'info')
const chipFor = (g: TaskGroup, due: string, today: string) => (g === 'overdue' ? `${daysDiff(due, today)}d late` : `due ${dayMonth(due)}`)

// The five KPIs chased each month: the same list Monthly entry uses (src/lib/entryItems.ts).
const KPI_ITEMS: { key: SubjectItemKey; name: string }[] = MONTHLY_KPIS.map((i) => ({ key: i.check!, name: i.short }))

const HELP = {
  declarations: 'The 11 monthly documents from every work order: reports, registers, declarations, minutes, camp records, WPS and salary. A month’s are due by the 15th of the next month.',
  kpis: 'Accommodation, onboarding, offboarding, worker counts and meeting attendance. A month’s are due by the end of the next month.',
  ticket: 'Tickets should close within 30 days.',
  camp: 'Every camp is inspected once per cycle (90 days).',
  closeout: 'Findings from the quarterly audit are closed out within 30 days.',
  quarterly: 'One audit score per work order each quarter.',
  draft: 'An inspection that was started but not finished.',
}

function subjectRows(d: AllData, subjects: KpiSubject[], m: string, today: string) {
  const decl: Task[] = []
  const kpis: Task[] = []
  const done: Task[] = []
  let entered = 0
  const declDue = declarationsDue(m)
  const kpiDue = kpisDue(m)
  for (const sub of subjects) {
    const k = subjectKpi(sub, d.kpis, m)
    const prior = subjectPrior(sub, d.kpis, m)
    // Documents the contractor can't provide, or that don't apply, are not chased.
    const declMissing = awaitedItems(k, prior)
    const docCount = submissionCounts(k, prior)
    const notProvided = DOCS.filter((i) => docState(k, i.key, prior) === 'notProvided').map((i) => i.short)
    const kpiMissing = KPI_ITEMS.filter((i) => !SUBJECT_ITEMS[i.key].done(d, sub, m))
    entered += (declMissing.length ? 0 : 1) + (KPI_ITEMS.length - kpiMissing.length)
    const subject = { contractorUuid: sub.contractor.uuid, workOrderUuid: woOf(sub), month: m }
    const to = `/contractors/${sub.contractor.uuid}?m=${m}`
    if (declMissing.length) {
      const g = groupFor(declDue, today)
      decl.push({
        key: `decl:${m}:${sub.key}`,
        kind: 'declarations',
        group: g,
        title: sub.label,
        detail: docCount.in ? `${shortMonth(m)}: ${docCount.in} of ${docCount.required} in · ${shortList(declMissing)}` : `${shortMonth(m)}: nothing in yet`,
        due: declDue,
        dueText: chipFor(g, declDue, today),
        tone: toneFor(g),
        icon: 'file-text',
        to,
        weight: 1,
        subject,
        sheet: 'submission',
        help: HELP.declarations,
      })
    }
    if (kpiMissing.length) {
      const g = groupFor(kpiDue, today)
      const onlyWorkers = kpiMissing.length === 1 && kpiMissing[0].key === 'formal'
      kpis.push({
        key: `kpis:${m}:${sub.key}`,
        kind: 'kpis',
        group: g,
        title: sub.label,
        detail: `${shortMonth(m)}: ${kpiMissing.map((i) => i.name).join(', ')} missing`,
        due: kpiDue,
        dueText: chipFor(g, kpiDue, today),
        tone: toneFor(g),
        icon: 'gauge',
        to,
        weight: 1,
        subject,
        sheet: onlyWorkers ? 'manpower' : 'kpi',
        help: HELP.kpis,
      })
    }
    if (!declMissing.length && !kpiMissing.length) {
      done.push({
        key: `done:${m}:${sub.key}`,
        kind: 'done',
        group: 'done',
        title: sub.label,
        detail: `${shortMonth(m)} all in${notProvided.length ? ` · ${notProvided.join(', ')} not provided` : ''}`,
        due: null,
        dueText: 'Done',
        tone: 'good',
        icon: 'check-circle',
        to,
        weight: 1,
        subject,
      })
    }
  }
  return { decl, kpis, done, entered, total: subjects.length * (1 + KPI_ITEMS.length) }
}

/** Later rows of one kind and month fold into one grouped row; urgent ones stay named. */
function foldLater(rows: Task[], kind: 'declarations' | 'kpis', m: string): Task[] {
  const later = rows.filter((t) => t.group === 'later')
  const rest = rows.filter((t) => t.group !== 'later')
  if (!later.length) return rest
  const n = later.length
  const due = later[0].due!
  return [
    ...rest,
    {
      key: `${kind}:${m}`,
      kind,
      group: 'later',
      title: `${longMonth(m)} ${kind === 'declarations' ? 'documents' : 'KPIs'}`,
      detail: `${n} work order${s(n)} · ${kind === 'declarations' ? `${DOCS.length} documents each` : 'scores, worker counts'}`,
      due,
      dueText: `due ${dayMonth(due)}`,
      tone: 'info',
      icon: kind === 'declarations' ? 'file-text' : 'gauge',
      to: entryLink({ m }),
      weight: n,
      members: later,
      help: HELP[kind],
    },
  ]
}

const weekday = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })

export function buildTasks(d: AllData, today = localDate(), o: { ticketCap?: number; routines?: Routine[] } = {}): TaskList {
  const cap = o.ticketCap ?? TICKET_CAP
  const subjects = kpiSubjects(d.contractors, d.workOrders).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  const tasks: Task[] = []
  const months = taskMonths(today)

  // 1. Declarations and KPIs per work order and month
  let progress: TaskList['progress'] = null
  months.forEach((m, i) => {
    const r = subjectRows(d, subjects, m, today)
    if (i === 0) progress = { month: m, done: r.entered, total: r.total }
    tasks.push(...foldLater(r.decl, 'declarations', m), ...foldLater(r.kpis, 'kpis', m), ...r.done)
  })
  const older = olderMonths(today)
  const olderGaps = older.reduce((n, m) => {
    const r = subjectRows(d, subjects, m, today)
    return n + r.decl.length + r.kpis.length
  }, 0)
  if (olderGaps) {
    tasks.push({
      key: 'older',
      kind: 'older',
      group: 'overdue',
      title: 'Older months',
      detail: `${olderGaps} gap${s(olderGaps)} before ${shortMonth(months[months.length - 1])}`,
      due: null,
      dueText: 'Late',
      tone: 'bad',
      icon: 'file-text',
      to: entryLink({ m: older[0] }),
      weight: 1,
    })
  }

  // 2. Tickets: over 30 days (named, then "more"), and turning 30 within a week; D&C tickets
  // and the team's own cases each on their own (the Tickets card's two tabs, D&C Tickets | Cases).
  // Named by the contractor's short name; the ticket / case number leads the line below.
  const whoOf = (uuid: string) => {
    const name = d.byUuid.get(uuid)?.name
    return name ? shortName(name) : 'No contractor'
  }
  const allOpen = [...d.tickets, ...d.cases].filter((t) => isOpen(t) && !t.parentUuid && t.openedAt)
  const numberOf = new Map(d.tickets.map((t) => [t.uuid, t.ticketNo]))
  // "CASE-0004 → WWCMPL-123": a case that turned into a D&C ticket says which
  const numberLine = (t: (typeof allOpen)[number]) => {
    const no = t.ticketNo || 'No number'
    return t.linkedTicketUuid ? `${no} → ${numberOf.get(t.linkedTicketUuid) ?? 'ticket removed'}` : no
  }
  for (const tab of ['tickets', 'internal'] as const) {
    const open = allOpen.filter((t) => sourceTab(t) === tab)
    const internal = tab === 'internal'
    const late = open.filter((t) => ageDays(t, today) > 30).sort((a, b) => ageDays(b, today) - ageDays(a, today) || a.ticketNo.localeCompare(b.ticketNo))
    const ticketRow = (t: (typeof open)[number], group: TaskGroup, detail: string): Task => ({
      key: `ticket:${t.uuid}`,
      kind: 'ticket',
      group,
      title: whoOf(t.contractorUuid),
      detail: `${numberLine(t)} · ${detail}`,
      due: addDays(t.openedAt, 30),
      dueText: `${ageDays(t, today)}d`,
      tone: toneFor(group),
      icon: 'ticket',
      to: `/tickets/${t.uuid}`,
      weight: 1,
      ticketUuid: t.uuid,
      ticketSource: tab,
      help: HELP.ticket,
    })
    // A combined group shows once, under its main ticket, with how many it holds (the Dashboard counts each).
    const combined = (t: Ticket) => [...d.tickets, ...d.cases].filter((x) => x.parentUuid === t.uuid && isOpen(x)).length
    const plus = (t: Ticket) => {
      const n = combined(t)
      return n ? ` · +${n} combined` : ''
    }
    for (const t of late.slice(0, cap)) {
      const days = ageDays(t, today)
      tasks.push(ticketRow(t, 'overdue', `Open ${days} days · ${t.workers || 0} worker${s(t.workers || 0)}${plus(t)}`))
    }
    if (late.length > cap) {
      const more = late.length - cap
      tasks.push({
        key: internal ? 'tickets:late:internal' : 'tickets:late',
        kind: 'tickets',
        group: 'overdue',
        title: internal ? 'More cases over 30 days' : 'More tickets over 30 days',
        detail: 'Opens the 30+ days list',
        due: addDays(late[cap - 1].openedAt, 30),
        dueText: `${more} more`,
        tone: 'bad',
        icon: 'ticket',
        to: internal ? '/tickets?f=late&tab=internal' : '/tickets?f=late',
        weight: more,
        ticketSource: tab,
      })
    }
    const soon = open.filter((t) => {
      const a = ageDays(t, today)
      return a > 30 - 7 && a <= 30
    })
    for (const t of soon.sort((a, b) => ageDays(b, today) - ageDays(a, today)).slice(0, cap)) {
      tasks.push(ticketRow(t, 'week', `Turns 30 days on ${weekday(addDays(t.openedAt, 31))}`))
    }
  }

  // 3. Camps: expired or never inspected, or due
  for (const camp of d.camps.filter((c) => c.active)) {
    const st = campState(camp, d.inspections, today)
    if (st.status === 'ok') continue
    const due = st.lastDate ? addDays(st.lastDate, camp.cycleDays || 90) : null
    const group: TaskGroup = st.status === 'never' || st.status === 'expired' ? 'overdue' : (st.dueIn ?? 0) <= 7 ? 'week' : 'later'
    tasks.push({
      key: `camp:${camp.uuid}`,
      kind: 'camp',
      group,
      title: camp.name,
      detail:
        st.status === 'never'
          ? 'Never inspected'
          : st.status === 'expired'
            ? `Inspection expired ${-(st.dueIn ?? 0)} day${s(-(st.dueIn ?? 0))} ago`
            : `Inspection due in ${st.dueIn} day${s(st.dueIn ?? 0)}`,
      due,
      dueText: st.status === 'never' ? 'Never' : st.status === 'expired' ? `${-(st.dueIn ?? 0)}d late` : `due ${dayMonth(due!)}`,
      tone: toneFor(group),
      icon: 'tent',
      to: `/camps/${camp.uuid}`,
      weight: 1,
      campUuid: camp.uuid,
      help: HELP.camp,
    })
  }

  // 4. Audit close-outs still open
  for (const co of closeouts(subjects, d.kpis, today)) {
    if (co.status === 'closed') continue
    const group: TaskGroup = co.status === 'overdue' ? 'overdue' : co.status === 'due' ? 'week' : 'later'
    tasks.push({
      key: `closeout:${co.kpi.uuid}`,
      kind: 'closeout',
      group,
      title: co.subject.label,
      detail: `Audit close-out · ${co.closed} of ${co.findings} finding${s(co.findings)} closed`,
      due: co.due || null,
      dueText: group === 'overdue' && co.daysLeft !== null ? `${-co.daysLeft}d late` : co.due ? `due ${dayMonth(co.due)}` : 'Open',
      tone: toneFor(group),
      icon: 'seal',
      to: '/closeouts',
      weight: 1,
      subject: { contractorUuid: co.subject.contractor.uuid, workOrderUuid: woOf(co.subject), month: co.kpi.month },
      sheet: 'kpi',
      help: HELP.closeout,
    })
  }

  // 5. The quarterly audit (this quarter; last quarter's if it was missed)
  const thisMonth = monthOf(today)
  const quarter = quarterMonths(thisMonth)
  const quarterRow = (q: string[], label: string) => {
    const missing = subjects.filter((sub) => !SUBJECT_ITEMS.quarterly.done(d, sub, q[0])).length
    if (!missing) return
    const due = monthRange(q[2]).end
    const group = groupFor(due, today)
    tasks.push({
      key: `quarterly:${q[0]}`,
      kind: 'quarterly',
      group,
      title: label,
      detail: `${missing} work order${s(missing)} not done`,
      due,
      dueText: chipFor(group, due, today),
      tone: toneFor(group),
      icon: 'seal',
      to: entryLink({ by: 'item', item: 'quarterly', m: q[2] <= thisMonth ? q[2] : thisMonth }),
      weight: missing,
      help: HELP.quarterly,
    })
  }
  const lastQuarter = quarterMonths(addMonths(quarter[0], -1))
  if (lastQuarter[2] >= TASKS_FROM) quarterRow(lastQuarter, 'Last quarter’s audit')
  quarterRow(quarter, 'Quarterly audit')

  // 6. Unfinished inspections
  for (const ins of d.inspections.filter((i) => i.status === 'draft' && i.id !== undefined)) {
    const where = ins.info?.facilityLocation || ins.info?.contractorNames || 'Inspection'
    tasks.push({
      key: `draft:${ins.id}`,
      kind: 'draft',
      group: 'later',
      title: 'Draft inspection',
      detail: `${where} · started ${dayMonth((ins.createdAt || ins.info?.reviewDate || today).slice(0, 10))}`,
      due: null,
      dueText: 'Continue',
      tone: 'info',
      icon: 'clipboard',
      to: `/inspection/${ins.id}`,
      weight: 1,
      inspectionId: ins.id,
      help: HELP.draft,
    })
  }

  // 7. Routine tasks the team added (+ → Task)
  for (const r of o.routines ?? []) {
    const due = nextDue(r, today)
    if (!due) continue
    const group = routineGroup(r.repeat, due, today)
    tasks.push({
      key: `routine:${r.uuid}:${due}`,
      kind: 'routine',
      group,
      title: r.title || 'Task',
      detail: [repeatText(r), r.notes.trim().split('\n')[0]].filter(Boolean).join(' · '),
      due,
      dueText: group === 'overdue' ? `${daysDiff(due, today)}d late` : due === today ? 'Today' : `due ${dayMonth(due)}`,
      tone: toneFor(group),
      icon: 'checklist',
      to: '',
      weight: 1,
      routine: r,
      help: r.notes.trim() || undefined,
    })
  }

  // Order: most urgent first in each group (no deadline first under Later).
  const order: TaskGroup[] = ['overdue', 'week', 'later', 'done']
  const sorted = tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const g = order.indexOf(a.t.group) - order.indexOf(b.t.group)
      if (g) return g
      const da = a.t.due ?? ''
      const db = b.t.due ?? ''
      return da < db ? -1 : da > db ? 1 : a.i - b.i
    })
    .map(({ t }) => t)

  const counts: Record<TaskGroup, number> = { overdue: 0, week: 0, later: 0, done: 0 }
  for (const t of sorted) counts[t.group] += t.weight

  // Risks without a deadline, for the month that just ended.
  const lm = lastEndedMonth(today)
  const kpis = kpisForMonth(d, lm)
  const critical = d.contractors.filter((c) => c.active && kpis.get(c.uuid)?.status === 'bad').length
  const wf = workforce(subjects, d.manpower, lm)
  const wfMonth = wf.month ?? lm
  const watch: WatchItem[] = [
    { key: 'kpi', n: critical, text: `Contractor${s(critical)} below 70% KPI`, tone: 'bad' as Tone, to: `/kpis/overall?m=${lm}&s=bad` },
    { key: 'illegal', n: wf.illegal, text: 'Illegal / freelance workers', tone: 'warn' as Tone, to: entryLink({ by: 'item', item: 'workers', m: wfMonth }) },
    { key: 'visa', n: wf.visaExpiring, text: 'Visas expire within 30 days', tone: 'warn' as Tone, to: entryLink({ by: 'item', item: 'workers', m: wfMonth }) },
    { key: 'fees', n: wf.paidFees, text: 'Paid recruitment fees', tone: 'bad' as Tone, to: entryLink({ by: 'item', item: 'workers', m: wfMonth }) },
  ].filter((w) => w.n > 0)

  return { tasks: sorted, counts, progress, watch }
}

// ---- Home cards: the task list split into six areas ------------------------------------

export type TaskArea = 'tickets' | 'submission' | 'kpis' | 'accommodation' | 'audits' | 'tasks'

/** Which card a task belongs to ("done" rows belong to none). */
export const AREA_OF: Record<TaskKind, TaskArea | null> = {
  ticket: 'tickets',
  tickets: 'tickets',
  declarations: 'submission',
  older: 'submission',
  kpis: 'kpis',
  camp: 'accommodation',
  draft: 'accommodation',
  closeout: 'audits',
  quarterly: 'audits',
  routine: 'tasks',
  done: null,
}

export interface AreaDef {
  key: TaskArea
  label: string
  icon: IconName
  hue: MenuItem
  /** What it means (the long-press note). */
  help: string
  /** The app's own screen for it (a shortcut in the long-press pop-up). */
  link?: { label: string; icon: IconName; to: (o: { month: string; tab: SourceTab }) => string }
}

/** The six cards, in grid order. */
export const AREAS: AreaDef[] = [
  { key: 'tickets', label: 'Tickets', icon: 'ticket', hue: 'ticket', help: HELP.ticket, link: { label: 'Open Tickets', icon: 'ticket', to: ({ tab }) => (tab === 'internal' ? '/tickets?tab=internal' : '/tickets') } },
  {
    key: 'submission',
    label: 'Submission',
    icon: 'file-text',
    hue: 'submission',
    help: HELP.declarations,
    link: { label: 'Monthly entry', icon: 'file-text', to: ({ month }) => entryLink({ m: month }) },
  },
  { key: 'kpis', label: 'KPIs', icon: 'gauge', hue: 'kpis', help: HELP.kpis, link: { label: 'Monthly entry', icon: 'gauge', to: ({ month }) => entryLink({ by: 'item', item: 'accommodation', m: month }) } },
  { key: 'accommodation', label: 'Accommodation', icon: 'tent', hue: 'camps', help: HELP.camp, link: { label: 'Open Camps', icon: 'tent', to: () => '/camps' } },
  {
    key: 'audits',
    label: 'Audits',
    icon: 'seal',
    hue: 'closeout',
    help: `${HELP.quarterly} ${HELP.closeout}`,
    link: { label: 'Audit close-outs', icon: 'seal', to: () => '/closeouts' },
  },
  { key: 'tasks', label: 'Tasks', icon: 'checklist', hue: 'task', help: 'The team’s own to-dos, once or repeating.' },
]

export const isArea = (k: string | undefined): k is TaskArea => AREAS.some((a) => a.key === k)

/** One card's tasks, in list order. */
export const tasksIn = (tasks: Task[], area: TaskArea) => tasks.filter((t) => AREA_OF[t.kind] === area)

export interface AreaSummary {
  /** Things late, due this week and due later (grouped rows count each thing). */
  late: number
  week: number
  later: number
  /** The soonest deadline among the later ones. */
  next: string | null
  /** The most urgent names (late, then this week), for the long-press pop-up. */
  names: string[]
  /** Urgent rows beyond `names`. */
  more: number
}

const NAMES_SHOWN = 3

/** Counts per card. */
export function areaSummaries(tasks: Task[]): Record<TaskArea, AreaSummary> {
  const out = {} as Record<TaskArea, AreaSummary>
  for (const a of AREAS) {
    const sum: AreaSummary = { late: 0, week: 0, later: 0, next: null, names: [], more: 0 }
    const late: string[] = []
    const week: string[] = []
    for (const t of tasksIn(tasks, a.key)) {
      if (t.group === 'overdue') {
        sum.late += t.weight
        late.push(t.title)
      } else if (t.group === 'week') {
        sum.week += t.weight
        week.push(t.title)
      } else if (t.group === 'later') {
        sum.later += t.weight
        if (t.due && (!sum.next || t.due < sum.next)) sum.next = t.due
      }
    }
    // late ones before this week's, each in list order
    const urgent = [...late, ...week]
    sum.names = urgent.slice(0, NAMES_SHOWN)
    sum.more = Math.max(0, urgent.length - NAMES_SHOWN)
    out[a.key] = sum
  }
  return out
}

/** The card's status: the most urgent count (shown big) and its word, or just a word. */
export function areaStatus(s: AreaSummary): { n: number | null; word: string; tone: Tone } {
  if (s.late) return { n: s.late, word: 'late', tone: 'bad' }
  if (s.week) return { n: s.week, word: 'this week', tone: 'warn' }
  if (s.later) return s.next ? { n: null, word: `Next ${dayMonth(s.next)}`, tone: 'none' } : { n: s.later, word: 'later', tone: 'none' }
  return { n: null, word: 'All done', tone: 'good' }
}

/**
 * A Home icon tile: the badge holds the most urgent count (late, else this
 * week); the line under the name says what it is, or the next date.
 */
export function areaTile(s: AreaSummary): { badge: number | null; sub: string; tone: Tone } {
  if (s.late) return { badge: s.late, sub: 'Late', tone: 'bad' }
  if (s.week) return { badge: s.week, sub: 'This week', tone: 'warn' }
  if (s.later) return { badge: null, sub: s.next ? dayMonth(s.next) : `${s.later} later`, tone: 'none' }
  return { badge: null, sub: 'Done', tone: 'good' }
}

/** The same as one line of text, e.g. "3 late" (the pop-up's subtitle). */
export function areaLine(s: AreaSummary): { text: string; tone: Tone } {
  const st = areaStatus(s)
  return { text: st.n === null ? st.word : `${st.n} ${st.word}`, tone: st.tone }
}

/** Every row a task list shows, grouped rows' own rows included. */
const leaves = (tasks: Task[]) => tasks.flatMap((t) => (t.members ? t.members : [t])).filter((t) => t.group !== 'done' && t.kind !== 'tickets' && t.kind !== 'older')

/** Tasks that were on the list before and are gone now: finished (they get the done animation). */
export function completedSince(before: Task[], after: Task[]): Task[] {
  const now = new Set(leaves(after).map((t) => t.key))
  return leaves(before).filter((t) => !now.has(t.key))
}
