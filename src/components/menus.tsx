import IconTile from './IconTile'
import { showActions, type SheetAction, type SheetFact } from './ActionSheet'
import { go, openSheet } from './SheetHost'
import { showToast } from './Toast'
import { db, deleteInspection, duplicateInspection } from '../db'
import { ageDays, isOpen } from '../lib/aging'
import { localDate, monthLabel, shortDate } from '../lib/dates'
import { lastEndedMonth } from '../lib/due'
import { haptic } from '../lib/haptics'
import { kpiStatus, pct, type KpiResult } from '../lib/kpi'
import { campActions, inspectionActions, ticketActions, workOrderActions, type MenuAction } from '../lib/menuSpec'
import { sarShort } from '../lib/money'
import { saveRecord } from '../lib/records'
import type { KpiSubject } from '../lib/subjects'
import { kpiTone, ticketTone, type Tone } from '../lib/tone'
import { ticketLabel } from '../lib/useData'
import type { Camp, Contractor, Inspection, Ticket } from '../types'

// One long-press menu per kind of record, the same on every screen. Which
// actions show comes from src/lib/menuSpec.ts (tested); edit actions are
// hidden from viewers by the menu host.

const short = (month: string) => monthLabel(month).slice(0, 3)

/** The month whose KPIs are being filled in now (last month: due this month). */
export const fillMonth = () => lastEndedMonth(localDate())

export function copyTicketNo(t: Ticket) {
  void navigator.clipboard?.writeText(t.ticketNo).then(
    () => showToast({ text: `Copied ${t.ticketNo}` }),
    () => showToast({ text: t.ticketNo }),
  )
}

async function reopenTicket(t: Ticket) {
  const contractors = new Map((await db.contractors.toArray()).map((c) => [c.uuid, c]))
  await saveRecord('tickets', { ...t, status: 'Open', closedAt: '' }, ticketLabel(t, contractors), 'reopen')
  haptic('success')
  showToast({ text: `${t.ticketNo || 'Ticket'} reopened` })
}

/** Long-press / ⋯ on a ticket, anywhere. */
export function ticketMenu(
  t: Ticket,
  o: { sub?: string; members?: number; extra?: SheetAction[]; onDeleted?: () => void } = {},
) {
  const open = isOpen(t)
  const days = ageDays(t)
  const tone = ticketTone(t)
  const name = t.ticketNo || 'Ticket'
  const map: Record<string, SheetAction> = {
    close: { label: 'Close ticket', icon: 'check-circle', onSelect: () => openSheet({ kind: 'ticketClose', uuid: t.uuid }), edit: true },
    closeGroup: {
      label: `Close all ${(o.members ?? 0) + 1} together`,
      icon: 'check-circle',
      onSelect: () => openSheet({ kind: 'ticketClose', uuid: t.uuid }),
      edit: true,
    },
    reopen: { label: 'Reopen ticket', icon: 'undo', onSelect: () => void reopenTicket(t), edit: true },
    edit: { label: 'Edit', icon: 'pencil', onSelect: () => openSheet({ kind: 'ticketEdit', uuid: t.uuid }), edit: true },
    contractor: { label: 'Open contractor', icon: 'buildings', onSelect: () => go(`/contractors/${t.contractorUuid}`) },
    main: { label: 'Open main ticket', icon: 'arrow-right', onSelect: () => go(`/tickets/${t.parentUuid}`) },
    copy: { label: 'Copy number', icon: 'copy', onSelect: () => copyTicketNo(t) },
    delete: {
      label: 'Delete ticket',
      icon: 'trash',
      danger: true,
      edit: true,
      onSelect: () => openSheet({ kind: 'ticketDelete', uuid: t.uuid, after: o.onDeleted }),
    },
  }
  const ids = ticketActions(t, { members: o.members })
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

/** Long-press on a contractor: fill in a work order's month, edit. */
export function contractorMenu(
  c: Contractor,
  o: { subjects: KpiSubject[]; kpi?: KpiResult; kpiMonth: string; openTickets?: number; spark?: (number | null)[] },
) {
  const month = fillMonth()
  const tone: Tone = c.active ? kpiTone(o.kpi?.status ?? 'none') : 'none'
  const known = (o.spark ?? []).filter((v): v is number => v !== null)
  const last = known.length ? known[known.length - 1] : null
  showActions({
    title: c.name,
    sub: c.active ? `${o.subjects.length} work order${o.subjects.length === 1 ? '' : 's'}` : 'Inactive',
    cover: <IconTile text={c.name} tone={tone} size={52} />,
    spark: o.spark ? { values: o.spark, label: 'Overall KPI, last 6 months', tone: kpiTone(kpiStatus(last)), guide: 90 } : undefined,
    facts: [
      { label: `KPI ${short(o.kpiMonth)}`, value: pct(o.kpi?.overall ?? null), tone: tone === 'none' || tone === 'info' ? undefined : tone },
      ...(o.openTickets !== undefined ? [{ label: 'Open tickets', value: o.openTickets }] : []),
    ],
    actions: [
      ...o.subjects.slice(0, 4).map((s) => ({
        label: `Fill in ${short(month)}${s.workOrder ? ` · WO ${s.workOrder.number}` : ''}`,
        icon: 'gauge' as const,
        edit: true,
        onSelect: () => openSheet({ kind: 'kpi', contractorUuid: c.uuid, workOrderUuid: s.workOrder?.uuid ?? '', month }),
      })),
      { label: 'Edit details', icon: 'pencil', edit: true, onSelect: () => openSheet({ kind: 'contractorEdit', uuid: c.uuid }) },
    ],
  })
}

/** Long-press on a work order: fill in its month, workers, its contractor, turn it off or on. */
export function workOrderMenu(s: KpiSubject & { workOrder: NonNullable<KpiSubject['workOrder']> }, o: { month?: string; sub?: string } = {}) {
  const month = o.month ?? fillMonth()
  const wo = s.workOrder
  const toggle = (active: boolean) =>
    void saveRecord('workOrders', { ...wo, active }, s.label).then(() => {
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
    manpower: {
      label: `Workers for ${short(month)}`,
      icon: 'users',
      edit: true,
      onSelect: () => openSheet({ kind: 'manpower', contractorUuid: s.contractor.uuid, workOrderUuid: wo.uuid, month }),
    },
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
        void duplicateInspection(id).then((newId) => {
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
          onConfirm: () => void deleteInspection(id).then(() => showToast({ text: 'Inspection deleted' })),
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
