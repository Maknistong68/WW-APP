import type { IconName } from './Icon'
import IconTile from './IconTile'
import SplitBar from './charts/SplitBar'
import { showActions, type SheetAction, type SheetFact } from './ActionSheet'
import { go, openSheet } from './SheetHost'
import { showToast } from './Toast'
import { db, deleteInspection, duplicateInspection } from '../db'
import { ageDays, isOpen } from '../lib/aging'
import { dayMonth, localDate, monthLabel, shortDate } from '../lib/dates'
import { lastEndedMonth } from '../lib/due'
import { MENU_HUE } from '../lib/hues'
import { areaLine, type AreaDef, type AreaSummary } from '../lib/tasks'
import { haptic } from '../lib/haptics'
import { kpiStatus, pct, type KpiResult } from '../lib/kpi'
import { campActions, contractorActions, inspectionActions, routineActions, ticketActions, workOrderActions, type MenuAction } from '../lib/menuSpec'
import { sarShort } from '../lib/money'
import type { Peek } from '../lib/peek'
import type { FocusAction } from '../lib/focus'
import { ticketLink } from '../lib/ticketFilter'
import { removeRecord, saveRecord } from '../lib/records'
import { attempt, tryWrite } from '../lib/safeWrite'
import { isAdmin } from '../lib/actor'
import { markSeen } from '../lib/onboarding'
import { copyText } from '../lib/clipboard'
import { backgroundSync } from '../lib/sync'
import { isFollowed, kpiSubjects, type KpiSubject } from '../lib/subjects'
import { kpiTone, ticketTone, type Tone } from '../lib/tone'
import { ticketLabel } from '../lib/useData'
import { isCase, noun } from '../lib/cases'
import type { Camp, Contractor, Inspection, Routine, Ticket, WorkOrder } from '../types'

// One long-press menu per kind of record, the same on every screen. Which
// actions show comes from src/lib/menuSpec.ts (tested); edit actions are
// hidden from viewers by the menu host.

const short = (month: string) => monthLabel(month).slice(0, 3)

/** The month whose KPIs are being filled in now (last month: due this month). */
export const fillMonth = () => lastEndedMonth(localDate())

export function copyTicketNo(t: Ticket) {
  void copyText(t.ticketNo).then((ok) => showToast({ text: ok ? `Copied ${t.ticketNo}` : t.ticketNo }))
}

async function reopenTicket(t: Ticket) {
  const contractors = new Map((await db.contractors.toArray()).map((c) => [c.uuid, c]))
  await saveRecord('tickets', { ...t, status: 'Open', closedAt: '' }, ticketLabel(t, contractors), 'reopen')
  haptic('success')
  showToast({ text: `${t.ticketNo || (isCase(t) ? 'Case' : 'Ticket')} reopened` })
}

/** Long-press / ⋯ on a ticket or case, anywhere (a case's actions say "case"). */
export function ticketMenu(
  t: Ticket,
  o: { sub?: string; members?: number; extra?: SheetAction[]; onDeleted?: () => void } = {},
) {
  const open = isOpen(t)
  const days = ageDays(t)
  const tone = ticketTone(t)
  const kind = noun(t)
  const name = t.ticketNo || (kind === 'case' ? 'Case' : 'Ticket')
  const map: Record<string, SheetAction> = {
    close: { label: `Close ${kind}`, icon: 'check-circle', onSelect: () => openSheet({ kind: 'ticketClose', uuid: t.uuid }), edit: true },
    closeGroup: {
      label: `Close all ${(o.members ?? 0) + 1} together`,
      icon: 'check-circle',
      onSelect: () => openSheet({ kind: 'ticketClose', uuid: t.uuid }),
      edit: true,
    },
    reopen: { label: `Reopen ${kind}`, icon: 'undo', onSelect: () => void tryWrite(`Reopen ${t.ticketNo}`, () => reopenTicket(t)), edit: true },
    edit: { label: 'Edit', icon: 'pencil', onSelect: () => openSheet({ kind: 'ticketEdit', uuid: t.uuid }), edit: true },
    contractor: { label: 'Open contractor', icon: 'buildings', onSelect: () => go(`/contractors/${t.contractorUuid}`) },
    main: { label: `Open main ${kind}`, icon: 'arrow-right', onSelect: () => go(`/tickets/${t.parentUuid}`) },
    copy: { label: 'Copy number', icon: 'copy', onSelect: () => copyTicketNo(t) },
    delete: {
      label: `Remove ${kind}`,
      icon: 'trash',
      danger: true,
      edit: true,
      onSelect: () => openSheet({ kind: 'ticketDelete', uuid: t.uuid, after: o.onDeleted }),
    },
  }
  const ids = ticketActions(t, { members: o.members, admin: isAdmin() })
  markSeen('hold')
  const actions = ids.filter((a) => a !== 'delete').map((a) => map[a])
  const facts: SheetFact[] = [
    open
      ? { label: 'Open', value: `${days} day${days === 1 ? '' : 's'}`, tone: tone === 'none' || tone === 'info' ? undefined : tone }
      : { label: 'Closed', value: shortDate(t.closedAt) },
    { label: 'Workers', value: t.workers || 0 },
    { label: 'SAR owed', value: t.amountOwed ? sarShort(t.amountOwed) : '–' },
  ]
  showActions({
    title: name,
    sub: o.sub ?? t.issue,
    cover: <IconTile icon={open ? 'ticket' : 'check'} tone={tone} size={52} />,
    facts,
    actions: [...actions, ...(o.extra ?? []), ...(ids.includes('delete') ? [map.delete] : [])],
  })
}

/**
 * Long-press on a contractor: its trends and tickets, fill in a work order's
 * month, edit, and turn it off or on. A contractor that is on but has every
 * work order off is not scored: the menu offers to turn a work order back on.
 */
export function contractorMenu(
  c: Contractor,
  o: { workOrders: WorkOrder[]; kpi?: KpiResult; kpiMonth: string; openTickets?: number; spark?: (number | null)[] },
) {
  const month = fillMonth()
  const followed = isFollowed(c, o.workOrders)
  const subjects = kpiSubjects([c], o.workOrders)
  const wos = o.workOrders.filter((w) => w.contractorUuid === c.uuid)
  const tone: Tone = followed ? kpiTone(o.kpi?.status ?? 'none') : 'none'
  const known = (o.spark ?? []).filter((v): v is number => v !== null)
  const last = known.length ? known[known.length - 1] : null
  const setActive = (active: boolean) =>
    void tryWrite(c.name, () => saveRecord('contractors', { ...c, active }, c.name)).then((ok) => {
      if (!ok) return
      haptic('success')
      const stillOff = active && !isFollowed({ ...c, active }, o.workOrders)
      showToast({ text: stillOff ? `${c.name} turned on · turn on a work order to score it` : `${c.name} turned ${active ? 'on' : 'off'}` })
    })
  const woOn = (w: WorkOrder) =>
    void tryWrite(`WO ${w.number}`, () => saveRecord('workOrders', { ...w, active: true }, `${c.name} · WO ${w.number}`)).then((ok) => {
      if (!ok) return
      haptic('success')
      showToast({ text: `WO ${w.number} turned on` })
    })
  const expand: Record<MenuAction, SheetAction[]> = {
    trends: [{ label: 'See trends', icon: 'activity', onSelect: () => go(`/contractors/${c.uuid}?tab=trends`) }],
    tickets: [{ label: 'Open tickets', icon: 'ticket', onSelect: () => go(ticketLink({ c: c.uuid, f: 'open' }, `/contractors/${c.uuid}`)) }],
    fill: subjects.slice(0, 4).map((s) => ({
      label: `Fill in ${short(month)}${s.workOrder ? ` · WO ${s.workOrder.number}` : ''}`,
      icon: 'gauge' as const,
      edit: true,
      onSelect: () => openSheet({ kind: 'kpi', contractorUuid: c.uuid, workOrderUuid: s.workOrder?.uuid ?? '', month }),
    })),
    // Documents: straight from here for one work order; with several, each work order's own menu has it.
    docs: subjects.length === 1 ? [{
      label: `Documents for ${short(month)}`,
      icon: 'file-text' as const,
      edit: true,
      onSelect: () => openSheet({ kind: 'submission', contractorUuid: c.uuid, workOrderUuid: subjects[0].workOrder?.uuid ?? '', month }),
    }] : [],
    edit: [{ label: 'Edit details', icon: 'pencil', edit: true, onSelect: () => openSheet({ kind: 'contractorEdit', uuid: c.uuid }) }],
    turnOff: [
      {
        label: 'Turn off',
        icon: 'minus-circle',
        edit: true,
        onSelect: () =>
          openSheet({
            kind: 'confirm',
            title: `Turn off ${c.name}?`,
            message: 'It stops counting in KPIs and on Home. Its history stays, and you can turn it back on.',
            confirmLabel: 'Turn off',
            destructive: true,
            onConfirm: () => setActive(false),
          }),
      },
    ],
    turnOn: [{ label: 'Turn on', icon: 'check-circle', edit: true, onSelect: () => setActive(true) }],
    turnOnWo: wos.slice(0, 3).map((w) => ({ label: `Turn on WO ${w.number}`, icon: 'check-circle' as const, edit: true, onSelect: () => woOn(w) })),
  } as Record<MenuAction, SheetAction[]>
  showActions({
    title: c.name,
    sub: !c.active ? 'Inactive' : !followed ? 'All work orders off' : `${subjects.length} work order${subjects.length === 1 ? '' : 's'}`,
    cover: <IconTile text={c.name} tone={tone} size={52} />,
    spark: o.spark ? { values: o.spark, label: 'Overall KPI, last 6 months', tone: kpiTone(kpiStatus(last)), guide: 90 } : undefined,
    facts: [
      { label: `KPI ${short(o.kpiMonth)}`, value: pct(followed ? (o.kpi?.overall ?? null) : null), tone: tone === 'none' || tone === 'info' ? undefined : tone },
      ...(o.openTickets !== undefined ? [{ label: 'Open tickets', value: o.openTickets }] : []),
    ],
    actions: contractorActions(c, followed).flatMap((a) => expand[a] ?? []),
  })
}

/** Long-press on a work order: fill in its month, workers, its tickets and trends, its contractor, turn it off or on. */
export function workOrderMenu(s: KpiSubject & { workOrder: NonNullable<KpiSubject['workOrder']> }, o: { month?: string; sub?: string } = {}) {
  const month = o.month ?? fillMonth()
  const wo = s.workOrder
  const toggle = (active: boolean) =>
    void tryWrite(`WO ${wo.number}`, () => saveRecord('workOrders', { ...wo, active }, s.label)).then((ok) => {
      if (!ok) return
      haptic('success')
      showToast({ text: `WO ${wo.number} turned ${active ? 'on' : 'off'}` })
    })
  const map: Partial<Record<MenuAction, SheetAction>> = {
    fill: {
      label: `Fill in ${monthLabel(month)}`,
      icon: 'gauge',
      edit: true,
      onSelect: () => openSheet({ kind: 'kpi', contractorUuid: s.contractor.uuid, workOrderUuid: wo.uuid, month }),
    },
    docs: {
      label: `Documents for ${short(month)}`,
      icon: 'file-text',
      edit: true,
      onSelect: () => openSheet({ kind: 'submission', contractorUuid: s.contractor.uuid, workOrderUuid: wo.uuid, month }),
    },
    manpower: {
      label: `Workers for ${short(month)}`,
      icon: 'users',
      edit: true,
      onSelect: () => openSheet({ kind: 'manpower', contractorUuid: s.contractor.uuid, workOrderUuid: wo.uuid, month }),
    },
    tickets: {
      label: 'Open tickets',
      icon: 'ticket',
      onSelect: () => go(ticketLink({ c: s.contractor.uuid, wo: wo.uuid, f: 'open' }, `/contractors/${s.contractor.uuid}`)),
    },
    trends: { label: 'See trends', icon: 'activity', onSelect: () => go(`/contractors/${s.contractor.uuid}?tab=trends&wo=${wo.uuid}`) },
    contractor: { label: 'Open contractor', icon: 'buildings', onSelect: () => go(`/contractors/${s.contractor.uuid}`) },
    turnOff: {
      label: 'Turn off',
      icon: 'minus-circle',
      edit: true,
      onSelect: () =>
        openSheet({
          kind: 'confirm',
          title: `Turn off WO ${wo.number}?`,
          message: 'It stops counting in KPIs and on Home. Its history stays, and you can turn it back on.',
          confirmLabel: 'Turn off',
          destructive: true,
          onConfirm: () => toggle(false),
        }),
    },
    turnOn: { label: 'Turn on', icon: 'check-circle', edit: true, onSelect: () => toggle(true) },
  }
  showActions({
    title: s.label,
    sub: o.sub ?? (wo.active ? `Work order · ${wo.label || 'active'}` : 'Turned off'),
    cover: <IconTile text={s.contractor.name} tone={wo.active ? 'info' : 'none'} size={52} />,
    actions: workOrderActions(wo).map((a) => map[a]).filter((a): a is SheetAction => !!a),
  })
}

/** Long-press on a camp: start an inspection, its contractor, edit. */
export function campMenu(camp: Camp, o: { sub: string; tone: Tone }) {
  const map: Partial<Record<MenuAction, SheetAction>> = {
    inspect: { label: 'Start inspection', icon: 'play', edit: true, onSelect: () => go(`/new/accommodation?camp=${camp.uuid}`) },
    contractor: { label: 'Open contractor', icon: 'buildings', onSelect: () => go(`/contractors/${camp.contractorUuid}`) },
    edit: { label: 'Edit camp', icon: 'pencil', edit: true, onSelect: () => openSheet({ kind: 'campEdit', uuid: camp.uuid }) },
  }
  showActions({
    title: camp.name,
    sub: o.sub,
    cover: <IconTile icon="tent" tone={o.tone} size={52} />,
    actions: campActions(camp).map((a) => map[a]).filter((a): a is SheetAction => !!a),
  })
}

/** Long-press on an inspection: repeat the visit, delete. */
export function inspectionMenu(ins: Inspection, o: { title: string; sub: string; tone: Tone }) {
  const id = ins.id
  if (id === undefined) return
  const map: Partial<Record<MenuAction, SheetAction>> = {
    repeat: {
      label: 'Repeat visit',
      icon: 'copy',
      edit: true,
      onSelect: () =>
        void attempt('Repeat inspection', () => duplicateInspection(id)).then((newId) => {
          if (!newId) return
          showToast({ text: 'New inspection started with the same details' })
          go(`/inspection/${newId}`)
        }),
    },
    delete: {
      label: 'Delete inspection',
      icon: 'trash',
      danger: true,
      edit: true,
      onSelect: () =>
        openSheet({
          kind: 'confirm',
          title: `Delete “${o.title}”?`,
          message: 'This permanently deletes the inspection and all its photos. Save a backup first if you might need it again.',
          confirmLabel: 'Delete inspection',
          destructive: true,
          onConfirm: () => void tryWrite('Delete inspection', () => deleteInspection(id)).then((ok) => ok && showToast({ text: 'Inspection deleted' })),
        }),
    },
  }
  showActions({
    title: o.title,
    sub: o.sub,
    cover: <IconTile icon="clipboard" tone={o.tone} size={52} />,
    actions: inspectionActions().map((a) => map[a]).filter((a): a is SheetAction => !!a),
  })
}

/**
 * Tick off a routine task for one date (or skip it), with Undo. Reads the task
 * fresh so a teammate's change isn't overwritten, then syncs so the team sees it.
 */
export const markRoutine = (r: Routine, due: string, skip = false) =>
  tryWrite(`Task ${r.title || ''}`.trim(), () => markRoutineNow(r, due, skip))

async function markRoutineNow(r: Routine, due: string, skip: boolean) {
  const cur = await db.routines.get(r.uuid)
  if (!cur) return
  const prev = cur.doneThrough
  const title = cur.title || 'Task'
  await saveRecord('routines', { ...cur, doneThrough: due }, skip ? `${title} · skipped ${dayMonth(due)}` : `${title} · ${dayMonth(due)}`, skip ? 'edit' : 'close')
  backgroundSync()
  showToast({
    text: skip ? `${title} skipped` : `${title} done`,
    actionLabel: 'Undo',
    onAction: () =>
      void tryWrite(`Undo ${title}`, async () => {
        const now = await db.routines.get(r.uuid)
        if (!now) return
        await saveRecord('routines', { ...now, doneThrough: prev }, `${title} · ${dayMonth(due)}`, 'reopen')
        backgroundSync()
      }),
  })
}

/** Long-press on a routine task: done, skip this time, edit, delete. */
export function routineMenu(r: Routine, o: { due: string; sub: string; tone: Tone }) {
  const title = r.title || 'Task'
  const map: Partial<Record<MenuAction, SheetAction>> = {
    done: { label: 'Done', icon: 'check-circle', edit: true, onSelect: () => void markRoutine(r, o.due) },
    skip: { label: 'Skip this time', icon: 'arrow-right', edit: true, onSelect: () => void markRoutine(r, o.due, true) },
    edit: { label: 'Edit task', icon: 'pencil', edit: true, onSelect: () => openSheet({ kind: 'routineEdit', uuid: r.uuid }) },
    delete: {
      label: 'Delete task',
      icon: 'trash',
      danger: true,
      edit: true,
      onSelect: () =>
        openSheet({
          kind: 'confirm',
          title: `Delete “${title}”?`,
          message: 'It disappears for the whole team. The activity log keeps a record.',
          confirmLabel: 'Delete task',
          destructive: true,
          onConfirm: () =>
            void tryWrite(`Delete ${title}`, () => removeRecord('routines', r.uuid, title)).then((ok) => {
              if (!ok) return
              showToast({ text: 'Task deleted' })
              backgroundSync()
            }),
        }),
    },
  }
  showActions({
    title,
    sub: o.sub,
    cover: <IconTile icon="checklist" tone={o.tone} size={52} />,
    note: r.notes.trim() || undefined,
    actions: routineActions(r).map((a) => map[a]).filter((a): a is SheetAction => !!a),
  })
}

/**
 * Hold a Home card: how many are late / this week / later, the most urgent names
 * (or what the card means), a shortcut to the app's own screen for it, and on
 * Tasks "Add task". A tap already opens the card's list, so there is no Open.
 */
export function areaMenu(a: AreaDef, s: AreaSummary, o: { month: string; onAddTask?: () => void }) {
  const actions: SheetAction[] = []
  if (a.link) {
    const link = a.link
    actions.push({ label: link.label, icon: link.icon, onSelect: () => go(link.to({ month: o.month, tab: 'tickets' })) })
  }
  if (o.onAddTask) actions.push({ label: 'Add task', icon: 'plus', edit: true, onSelect: o.onAddTask })
  showActions({
    title: a.label,
    sub: areaLine(s).text,
    cover: <IconTile icon={a.icon} hue={MENU_HUE[a.hue]} size={52} />,
    facts: [
      { label: 'Late', value: s.late, tone: s.late ? 'bad' : undefined },
      { label: 'This week', value: s.week, tone: s.week ? 'warn' : undefined },
      { label: 'Later', value: s.later },
    ],
    note: s.names.length ? `${s.names.join(', ')}${s.more ? ` +${s.more} more` : ''}` : a.help,
    actions,
  })
}

/**
 * Long-press on a Dashboard figure, bar or row: its key numbers, a trend,
 * the open tickets by age when it is about tickets, and where to go next.
 */
export function peekMenu(o: { title: string; sub?: string; icon: IconName; tone: Tone; peek: Peek; actions: FocusAction[] }) {
  showActions({
    title: o.title,
    sub: o.sub,
    cover: <IconTile icon={o.icon} tone={o.tone} size={52} />,
    facts: o.peek.facts,
    spark: o.peek.spark,
    figure: o.peek.parts ? <SplitBar parts={o.peek.parts} label="Open tickets by age" /> : undefined,
    actions: o.actions.map((a) => ({ label: a.label, icon: a.icon, onSelect: () => go(a.to) })),
  })
}
