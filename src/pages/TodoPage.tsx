import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import IconTile from '../components/IconTile'
import ItemRow from '../components/ItemRow'
import CardList from '../components/CardList'
import StatCard from '../components/StatCard'
import StatusChip from '../components/StatusChip'
import SwipeRow from '../components/SwipeRow'
import DoneCheck from '../components/DoneCheck'
import { showActions, type SheetAction } from '../components/ActionSheet'
import { campMenu, inspectionMenu, ticketMenu } from '../components/menus'
import { go, openSheet } from '../components/SheetHost'
import { showToast } from '../components/Toast'
import { useAuthInfo } from '../lib/auth'
import { dayMonth, localDate, monthLabel } from '../lib/dates'
import { declarationsDue, dueTone, kpisDue } from '../lib/due'
import { haptic } from '../lib/haptics'
import { useAllData, type AllData } from '../lib/kpiData'
import { buildTasks, completedSince, type Task, type TaskGroup } from '../lib/tasks'
import type { IconName } from '../components/Icon'

// Home: what I must do, by name and date. Overdue and this week's things are
// named one by one; later ones are grouped per month (tap to open the group).
// Tap does the main thing (fill in, open, start); swipe left does it too;
// hold for more. Finished rows get a check and slide away.

const GROUPS: { key: Exclude<TaskGroup, 'done'>; title: string }[] = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'week', title: 'This week' },
  { key: 'later', title: 'Later' },
]

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The main action of a task for an editor: what tap and swipe do. */
function primaryOf(t: Task, canEdit: boolean): { label: string; icon: IconName; tone: 'good' | 'info' | 'warn' | 'bad'; run: () => void } | null {
  if (!canEdit) return null
  if (t.subject && t.sheet) {
    const subject = t.subject
    return {
      label: t.kind === 'closeout' ? 'Update' : 'Fill in',
      icon: t.kind === 'closeout' ? 'pencil' : 'gauge',
      tone: 'info',
      run: () => openSheet({ kind: t.sheet!, ...subject }),
    }
  }
  if (t.kind === 'ticket' && t.ticketUuid) return { label: 'Close', icon: 'check-circle', tone: 'good', run: () => openSheet({ kind: 'ticketClose', uuid: t.ticketUuid! }) }
  if (t.kind === 'camp' && t.campUuid) return { label: 'Start', icon: 'play', tone: 'info', run: () => go(`/new/accommodation?camp=${t.campUuid}`) }
  return null
}

const copyText = (t: Task) => {
  const text = `${t.title} — ${t.detail} (${t.dueText})`
  void navigator.clipboard?.writeText(text).then(
    () => showToast({ text: 'Copied' }),
    () => showToast({ text }),
  )
}

/** Hold a task: the record's own menu, or what it means and what to do. */
function taskMenu(t: Task, d: AllData) {
  if (t.kind === 'ticket' && t.ticketUuid) {
    const ticket = d.tickets.find((x) => x.uuid === t.ticketUuid)
    if (ticket) return ticketMenu(ticket, { sub: t.detail })
  }
  if (t.kind === 'camp' && t.campUuid) {
    const camp = d.camps.find((x) => x.uuid === t.campUuid)
    if (camp) return campMenu(camp, { sub: t.detail, tone: t.tone })
  }
  if (t.kind === 'draft' && t.inspectionId !== undefined) {
    const ins = d.inspections.find((x) => x.id === t.inspectionId)
    if (ins) return inspectionMenu(ins, { title: t.detail.split(' · ')[0], sub: t.detail, tone: 'info' })
  }
  const actions: SheetAction[] = []
  if (t.subject) {
    const { month } = t.subject
    actions.push(
      { label: `Fill in ${monthLabel(month)}`, icon: 'gauge', edit: true, onSelect: () => openSheet({ kind: 'kpi', ...t.subject! }) },
      { label: `Workers for ${monthLabel(month).slice(0, 3)}`, icon: 'users', edit: true, onSelect: () => openSheet({ kind: 'manpower', ...t.subject! }) },
      { label: 'Open contractor', icon: 'buildings', onSelect: () => go(`/contractors/${t.subject!.contractorUuid}?m=${month}`) },
    )
  } else if (t.to) {
    actions.push({ label: t.members ? 'Open the list' : 'Open', icon: 'arrow-right', onSelect: () => go(t.to) })
  }
  actions.push({ label: 'Copy as text', icon: 'copy', onSelect: () => copyText(t) })
  showActions({
    title: t.title,
    sub: `${t.detail} · ${t.dueText}`,
    cover: <IconTile icon={t.icon} tone={t.tone} size={52} />,
    note: t.help,
    actions,
  })
}

function TaskRow({ t, d, canEdit, expanded, onToggle }: { t: Task; d: AllData; canEdit: boolean; expanded?: boolean; onToggle?: () => void }) {
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

/** A finished task on its way out: its tile is the check, then it slides away. */
function LeavingRow({ t }: { t: Task }) {
  return (
    <div className="task-leaving" aria-hidden="true">
      <ItemRow tile={<DoneCheck size={52} />} title={t.title} sub="Done" />
    </div>
  )
}

/** Once a day the "all caught up" check gets its little burst. */
function burstToday(today: string): boolean {
  try {
    if (sessionStorage.getItem('ww.caughtUp') === today) return false
    sessionStorage.setItem('ww.caughtUp', today)
  } catch {
    // no storage: burst every time is fine
  }
  return true
}

export default function TodoPage() {
  const d = useAllData()
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  const today = localDate()
  const [only, setOnly] = useState<TaskGroup | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const list = useMemo(() => (d.loaded ? buildTasks(d, today) : null), [d, today])

  // Finished since the last look: check, slide away, buzz, bump Done.
  const before = useRef<{ tasks: Task[]; done: number } | null>(null)
  const [leaving, setLeaving] = useState<Task[]>([])
  const [bump, setBump] = useState(false)
  useEffect(() => {
    if (!list) return
    const prev = before.current
    before.current = { tasks: list.tasks, done: list.counts.done }
    if (!prev) return
    const gone = completedSince(prev.tasks, list.tasks)
    if (!gone.length) return
    haptic('success')
    setLeaving(gone)
    setBump(list.counts.done > prev.done)
    const t1 = window.setTimeout(() => setBump(false), 450)
    const t2 = window.setTimeout(() => setLeaving([]), 1000)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [list])

  const clear = list ? list.counts.overdue + list.counts.week === 0 : false
  const [burst] = useState(() => burstToday(today))
  const toggle = (g: TaskGroup) => {
    haptic('tick')
    setOnly((o) => (o === g ? null : g))
  }
  const toggleGroup = (key: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  // The month being chased: when its declarations and KPIs are due.
  const month = list?.progress?.month
  const strip = month
    ? (() => {
        const decl = declarationsDue(month)
        const declLate = dueTone(decl, today) === 'bad' && list!.tasks.some((t) => t.kind === 'declarations' && t.group === 'overdue')
        const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1]
        return {
          tone: declLate ? 'bad' : 'info',
          text: declLate
            ? `${name} declarations overdue · KPIs due ${dayMonth(kpisDue(month))}`
            : `${name}: declarations due ${dayMonth(decl)} · KPIs due ${dayMonth(kpisDue(month))}`,
        }
      })()
    : null

  const groupTasks = (g: TaskGroup) => list?.tasks.filter((t) => t.group === g) ?? []
  const leavingIn = (g: TaskGroup) => leaving.filter((t) => t.group === g)

  return (
    <Page title="Today" subtitle={date}>
      {strip && <div className={`due-strip ${strip.tone}`}>{strip.text}</div>}

      <div className="stats">
        <StatCard icon="alert" tone="bad" value={list ? list.counts.overdue : '–'} label="Overdue" active={only === 'overdue'} onClick={() => toggle('overdue')} />
        <StatCard icon="clock" tone="warn" value={list ? list.counts.week : '–'} label="This week" active={only === 'week'} onClick={() => toggle('week')} />
        <StatCard icon="check-circle" tone="good" value={list ? list.counts.done : '–'} label="Done" active={only === 'done'} bump={bump} onClick={() => toggle('done')} />
      </div>

      {!list ? (
        <div className="today-list" style={{ marginTop: 22 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 76 }} />
          ))}
        </div>
      ) : (
        <div className="tasks">
          {clear && !only && (
            <div className="caught-up">
              <DoneCheck size={64} burst={burst} label="All caught up" />
              <div>
                <b>All caught up</b>
                <span>Nothing overdue or due this week.</span>
              </div>
            </div>
          )}

          {GROUPS.filter((g) => !only || only === g.key).map((g) => {
            const items = groupTasks(g.key)
            const out = leavingIn(g.key)
            if (!items.length && !out.length) {
              return only === g.key ? (
                <div key={g.key} className="empty-state" style={{ marginTop: 24 }}>
                  <Icon name="check-circle" size={44} />
                  <b>Nothing here</b>
                  {g.key === 'overdue' ? 'Nothing is late.' : 'Nothing due this week.'}
                </div>
              ) : null
            }
            return (
              <CardList key={g.key} title={g.title} count={list.counts[g.key]}>
                {out.map((t) => (
                  <LeavingRow key={`out-${t.key}`} t={t} />
                ))}
                {items.flatMap((t) => [
                  <TaskRow key={t.key} t={t} d={d} canEdit={canEdit} expanded={expanded.has(t.key)} onToggle={() => toggleGroup(t.key)} />,
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

          {!only && list.watch.length > 0 && (
            <CardList title="Watch · no deadline">
              {list.watch.map((w) => (
                <ItemRow
                  key={w.key}
                  tile={<span className={`watch-n schip ${w.tone}`}>{w.n}</span>}
                  title={w.text}
                  onOpen={() => navigate(w.to)}
                />
              ))}
            </CardList>
          )}

          {!only && list.progress && list.progress.total > 0 && (
            <div className="progress-card">
              <div className="progress-head">
                <b>{MONTH_NAMES[Number(list.progress.month.slice(5, 7)) - 1]} progress</b>
                <span>
                  {list.progress.done} of {list.progress.total} entered
                </span>
              </div>
              <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={list.progress.total} aria-valuenow={list.progress.done}>
                <div style={{ width: `${(list.progress.done / list.progress.total) * 100}%` }} />
              </div>
            </div>
          )}

          {(only === 'done' || (!only && groupTasks('done').length > 0)) &&
            (only === 'done' || showDone ? (
              <CardList title="Done" count={list.counts.done}>
                {groupTasks('done').map((t) => (
                  <TaskRow key={t.key} t={t} d={d} canEdit={canEdit} />
                ))}
              </CardList>
            ) : (
              <button className="show-more" onClick={() => setShowDone(true)}>
                Show {list.counts.done} done
              </button>
            ))}

          <div className="list-foot" style={{ textAlign: 'center', marginTop: 20 }}>
            {canEdit ? 'Tap or swipe left to do it · hold for more' : 'Tap to open · hold for more'}
          </div>
        </div>
      )}
    </Page>
  )
}
