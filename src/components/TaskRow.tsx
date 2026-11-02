import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import IconTile from './IconTile'
import ItemRow from './ItemRow'
import CardList from './CardList'
import StatusChip from './StatusChip'
import SwipeRow from './SwipeRow'
import DoneCheck from './DoneCheck'
import { showActions, type SheetAction } from './ActionSheet'
import { campMenu, inspectionMenu, markRoutine, routineMenu, ticketMenu } from './menus'
import { go, openSheet } from './SheetHost'
import { copyText } from '../lib/clipboard'
import { showToast } from './Toast'
import { monthLabel } from '../lib/dates'
import { ticketSub } from '../lib/useData'
import { haptic } from '../lib/haptics'
import { useLongPress } from '../lib/useLongPress'
import type { AllData } from '../lib/kpiData'
import { completedSince, type Task, type TaskGroup, type TaskKind } from '../lib/tasks'
import type { IconName } from './Icon'

// The task rows of Home and of each Home card's list. Tap does the main thing
// (fill in, open, start); swipe left does it too; hold for more. Finished rows
// get a check and slide away.

/** The main action of a task for an editor: what tap and swipe do. */
function primaryOf(t: Task, canEdit: boolean): { label: string; icon: IconName; tone: 'good' | 'info' | 'warn' | 'bad'; run: () => void } | null {
  if (!canEdit) return null
  if (t.subject && t.sheet) {
    const subject = t.subject
    return {
      label: t.kind === 'closeout' ? 'Update' : 'Fill in',
      icon: t.kind === 'closeout' ? 'pencil' : t.sheet === 'submission' ? 'file-text' : 'gauge',
      tone: 'info',
      run: () => openSheet({ kind: t.sheet!, ...subject }),
    }
  }
  if (t.kind === 'ticket' && t.ticketUuid) return { label: 'Close', icon: 'check-circle', tone: 'good', run: () => openSheet({ kind: 'ticketClose', uuid: t.ticketUuid! }) }
  if (t.kind === 'camp' && t.campUuid) return { label: 'Start', icon: 'play', tone: 'info', run: () => go(`/new/accommodation?camp=${t.campUuid}`) }
  if (t.kind === 'routine' && t.routine && t.due) {
    const r = t.routine
    const due = t.due
    return { label: 'Done', icon: 'check-circle', tone: 'good', run: () => void markRoutine(r, due) }
  }
  return null
}

const copyTask = (t: Task) => {
  const text = `${t.title} — ${t.detail} (${t.dueText})`
  void copyText(text).then((ok) => showToast({ text: ok ? 'Copied' : text }))
}

/** Hold a task: the record's own menu, or what it means and what to do. */
function taskMenu(t: Task, d: AllData) {
  if (t.kind === 'ticket' && t.ticketUuid) {
    const ticket = d.tickets.find((x) => x.uuid === t.ticketUuid)
    // the pop-up's title is the ticket number; below it the same line as on the Tickets page
    if (ticket) return ticketMenu(ticket, { sub: ticketSub(ticket, d.byUuid, d.woByUuid) })
  }
  if (t.kind === 'camp' && t.campUuid) {
    const camp = d.camps.find((x) => x.uuid === t.campUuid)
    if (camp) return campMenu(camp, { sub: t.detail, tone: t.tone })
  }
  if (t.kind === 'routine' && t.routine && t.due) return routineMenu(t.routine, { due: t.due, sub: `${t.detail} · ${t.dueText}`, tone: t.tone })
  if (t.kind === 'draft' && t.inspectionId !== undefined) {
    const ins = d.inspections.find((x) => x.id === t.inspectionId)
    if (ins) return inspectionMenu(ins, { title: t.detail.split(' · ')[0], sub: t.detail, tone: 'info' })
  }
  const actions: SheetAction[] = []
  if (t.subject) {
    const { month } = t.subject
    actions.push(
      { label: `Documents for ${monthLabel(month).slice(0, 3)}`, icon: 'file-text', edit: true, onSelect: () => openSheet({ kind: 'submission', ...t.subject! }) },
      { label: `Fill in ${monthLabel(month)}`, icon: 'gauge', edit: true, onSelect: () => openSheet({ kind: 'kpi', ...t.subject! }) },
      { label: `Workers for ${monthLabel(month).slice(0, 3)}`, icon: 'users', edit: true, onSelect: () => openSheet({ kind: 'manpower', ...t.subject! }) },
      { label: 'Open contractor', icon: 'buildings', onSelect: () => go(`/contractors/${t.subject!.contractorUuid}?m=${month}`) },
      {
        label: 'See trends',
        icon: 'activity',
        onSelect: () => go(`/contractors/${t.subject!.contractorUuid}?tab=trends${t.subject!.workOrderUuid ? `&wo=${t.subject!.workOrderUuid}` : ''}`),
      },
    )
  } else if (t.to) {
    actions.push({ label: t.members ? 'Open the list' : 'Open', icon: 'arrow-right', onSelect: () => go(t.to) })
  }
  actions.push({ label: 'Copy as text', icon: 'copy', onSelect: () => copyTask(t) })
  showActions({
    title: t.title,
    sub: `${t.detail} · ${t.dueText}`,
    cover: <IconTile icon={t.icon} tone={t.tone} size={52} />,
    note: t.help,
    actions,
  })
}

export function TaskRow({ t, d, canEdit, expanded, onToggle }: { t: Task; d: AllData; canEdit: boolean; expanded?: boolean; onToggle?: () => void }) {
  const navigate = useNavigate()
  const primary = primaryOf(t, canEdit)
  const open = () => {
    if (t.members) return onToggle?.()
    if (primary) return primary.run()
    if (t.to) navigate(t.to)
  }
  const chip = (
    <span className="task-trail">
      <StatusChip tone={t.tone} icon={t.group === 'overdue' ? 'alert' : t.group === 'done' ? 'check' : t.kind === 'draft' ? 'play' : 'clock'}>
        {t.dueText}
      </StatusChip>
      {t.members && <Icon name="chevron-down" size={18} className={`task-caret${expanded ? ' open' : ''}`} />}
    </span>
  )
  const row = (
    <ItemRow
      tile={<IconTile icon={t.icon} tone={t.tone} size={52} />}
      title={t.title}
      sub={t.detail}
      trail={chip}
      onOpen={open}
      onMore={() => taskMenu(t, d)}
    />
  )
  return primary && !t.members ? (
    <SwipeRow actionLabel={primary.label} icon={primary.icon} tone={primary.tone} onAction={primary.run}>
      {row}
    </SwipeRow>
  ) : (
    row
  )
}

/** The card button's longer words for the main action ("Close ticket"); others keep the row's word. */
const CARD_ACTION: Partial<Record<TaskKind, string>> = { ticket: 'Close ticket', camp: 'Start inspection', routine: 'Mark done' }

/**
 * A Home "Start here" card: one job, its status, what it is and one button
 * that does it (Close ticket, Fill in, Start inspection). Viewers get Open.
 * Tap the top to open the record; hold for more.
 */
export function TaskCard({ t, d, canEdit }: { t: Task; d: AllData; canEdit: boolean }) {
  const navigate = useNavigate()
  const primary = t.members ? null : primaryOf(t, canEdit)
  const press = useLongPress(() => taskMenu(t, d))
  const open = () => {
    if (t.to) navigate(t.to)
  }
  const label = primary ? (CARD_ACTION[t.kind] ?? primary.label) : t.kind === 'draft' ? 'Continue' : t.members ? 'Open the list' : 'Open'
  return (
    <article className="hcard" {...press}>
      <button type="button" className="hcard-main" onClick={open}>
        <IconTile icon={t.icon} tone={t.tone} size={52} />
        <span className="hcard-text">
          <StatusChip tone={t.tone} icon={t.group === 'overdue' ? 'alert' : t.kind === 'draft' ? 'play' : 'clock'}>
            {t.dueText}
          </StatusChip>
          <span className="hcard-title">{t.title}</span>
        </span>
      </button>
      <p className="hcard-detail">{t.detail}</p>
      <button type="button" className={`btn block hcard-act${primary ? ' primary' : ''}`} onClick={primary ? primary.run : open}>
        {label}
      </button>
    </article>
  )
}

/** A finished card on its way out: the drawn check, then it fades away. */
export function LeavingCard({ t }: { t: Task }) {
  return (
    <article className="hcard leaving" aria-hidden="true">
      <div className="hcard-main">
        <DoneCheck size={52} />
        <span className="hcard-text">
          <span className="hcard-title">{t.title}</span>
          <span className="hcard-detail">Done</span>
        </span>
      </div>
    </article>
  )
}

/** A finished task on its way out: its tile is the check, then it slides away. */
function LeavingRow({ t }: { t: Task }) {
  return (
    <div className="task-leaving" aria-hidden="true">
      <ItemRow tile={<DoneCheck size={52} />} title={t.title} sub="Done" />
    </div>
  )
}

/** Tasks finished since the last look (they get the check-and-slide), with a success buzz. */
export function useFinished(tasks: Task[] | null) {
  const before = useRef<Task[] | null>(null)
  const [leaving, setLeaving] = useState<Task[]>([])
  useEffect(() => {
    if (!tasks) return
    const prev = before.current
    before.current = tasks
    if (!prev) return
    const gone = completedSince(prev, tasks)
    if (!gone.length) return
    haptic('success')
    setLeaving(gone)
    const t = window.setTimeout(() => setLeaving([]), 1000)
    return () => window.clearTimeout(t)
  }, [tasks])
  return { leaving }
}

const TITLES: Record<TaskGroup, string> = { overdue: 'Overdue', week: 'This week', later: 'Later', done: 'Done' }

/**
 * Tasks in rounded cards, one per group (Overdue, This week, Later, Done), most urgent first.
 * Grouped rows open in place. Empty groups are left out.
 */
export function TaskGroups({
  tasks,
  groups,
  leaving = [],
  d,
  canEdit,
}: {
  tasks: Task[]
  groups: TaskGroup[]
  leaving?: Task[]
  d: AllData
  canEdit: boolean
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  return (
    <>
      {groups.map((g) => {
        const items = tasks.filter((t) => t.group === g)
        const out = leaving.filter((t) => t.group === g)
        if (!items.length && !out.length) return null
        return (
          <CardList key={g} title={TITLES[g]} count={items.reduce((n, t) => n + t.weight, 0)}>
            {out.map((t) => (
              <LeavingRow key={`out-${t.key}`} t={t} />
            ))}
            {items.flatMap((t) => [
              <TaskRow key={t.key} t={t} d={d} canEdit={canEdit} expanded={expanded.has(t.key)} onToggle={() => toggle(t.key)} />,
              ...(t.members && expanded.has(t.key)
                ? t.members.map((m) => (
                    <div key={m.key} className="task-member">
                      <TaskRow t={m} d={d} canEdit={canEdit} />
                    </div>
                  ))
                : []),
            ])}
          </CardList>
        )
      })}
    </>
  )
}
