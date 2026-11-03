import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import RoutineSheet from '../components/RoutineSheet'
import SourceTabs from '../components/SourceTabs'
import { TaskGroups, useFinished } from '../components/TaskRow'
import { useAuthInfo } from '../lib/auth'
import { localDate } from '../lib/dates'
import { lastEndedMonth } from '../lib/due'
import { useAllData } from '../lib/kpiData'
import { newRoutine, useRoutines } from '../lib/useData'
import { AREAS, areaSummaries, buildTasks, isArea, tasksIn } from '../lib/tasks'
import { parseSourceTab, type SourceTab } from '../lib/ticketFilter'
import type { Routine } from '../types'

/**
 * One Home card's list (/today/:area): its named rows, Overdue / This week / Later. The Tickets
 * card has two tabs, D&C Tickets | Cases (`?tab=internal`), like the ticket log.
 */
export default function AreaPage() {
  const { area } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = parseSourceTab(params)
  const d = useAllData()
  const navigate = useNavigate()
  const { canEdit, userId } = useAuthInfo()
  const today = localDate()
  const [adding, setAdding] = useState<Routine | null>(null)
  const routines = useRoutines(userId)
  const list = useMemo(() => (d.loaded && routines ? buildTasks(d, today, { routines }) : null), [d, today, routines])
  const inArea = useMemo(() => (list && isArea(area) ? tasksIn(list.tasks, area) : null), [list, area])
  const tabbed = area === 'tickets'
  const tasks = useMemo(() => (inArea && tabbed ? inArea.filter((t) => t.ticketSource === tab) : inArea), [inArea, tabbed, tab])
  // Finished rows are found across the whole card, so switching tabs doesn't count as finishing.
  const { leaving: finished } = useFinished(inArea)
  const leaving = tabbed ? finished.filter((t) => t.ticketSource === tab) : finished

  if (!isArea(area)) return <Navigate to="/" replace />
  const def = AREAS.find((a) => a.key === area)!
  const s = tasks ? areaSummaries(tasks)[area] : null
  const waiting = (k: SourceTab) => (inArea ?? []).filter((t) => t.ticketSource === k).reduce((n, t) => n + t.weight, 0)
  const setTab = (k: SourceTab) => {
    const next = new URLSearchParams(params)
    if (k === 'tickets') next.delete('tab')
    else next.set('tab', k)
    setParams(next, { replace: true })
  }
  const subtitle = s
    ? [s.late && `${s.late} late`, s.week && `${s.week} this week`, s.later && `${s.later} later`].filter(Boolean).join(' · ') || 'All done'
    : undefined
  const month = list?.progress?.month ?? lastEndedMonth(today)

  return (
    <Page
      title={def.label}
      subtitle={subtitle}
      back="/"
      backLabel="Today"
      actions={
        area === 'tasks' && canEdit ? (
          <button className="nav-btn" onClick={() => setAdding(newRoutine())}>
            Add
          </button>
        ) : undefined
      }
    >
      {tabbed && <SourceTabs value={tab} onChange={setTab} counts={inArea ? { tickets: waiting('tickets'), internal: waiting('internal') } : undefined} />}
      {!tasks ? (
        <div className="today-list">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 76 }} />
          ))}
        </div>
      ) : tasks.length === 0 && leaving.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <Icon name="check-circle" size={44} />
          <b>All done</b>
          {area === 'tasks'
            ? canEdit
              ? 'Nothing to do. Tap Add for a new task.'
              : 'Nothing to do.'
            : tabbed && tab === 'internal'
              ? 'No cases waiting.'
              : 'Nothing to do here.'}
        </div>
      ) : (
        <div className="tasks">
          <TaskGroups tasks={tasks} groups={['overdue', 'week', 'later', 'done']} leaving={leaving} d={d} canEdit={canEdit} />
          <div className="list-foot" style={{ textAlign: 'center', marginTop: 20 }}>
            {canEdit ? 'Tap or swipe left to do it · hold for more' : 'Tap to open · hold for more'}
          </div>
        </div>
      )}
      {def.link && (
        <button className="show-more" style={{ marginTop: 12 }} onClick={() => navigate(def.link!.to({ month, tab }))}>
          {def.link.label}
        </button>
      )}
      {adding && <RoutineSheet routine={adding} onClose={() => setAdding(null)} />}
    </Page>
  )
}
