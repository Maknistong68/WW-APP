import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import RoutineSheet from '../components/RoutineSheet'
import { TaskGroups, useFinished } from '../components/TaskRow'
import { useAuthInfo } from '../lib/auth'
import { localDate } from '../lib/dates'
import { lastEndedMonth } from '../lib/due'
import { useAllData } from '../lib/kpiData'
import { useCachedLiveQuery } from '../lib/useCachedQuery'
import { newRoutine } from '../lib/useData'
import { db } from '../db'
import { AREAS, areaSummaries, buildTasks, isArea, tasksIn } from '../lib/tasks'
import type { Routine } from '../types'

/** One Home card's list (/today/:area): its named rows, Overdue / This week / Later. */
export default function AreaPage() {
  const { area } = useParams()
  const d = useAllData()
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  const today = localDate()
  const [adding, setAdding] = useState<Routine | null>(null)
  const routines = useCachedLiveQuery('routines', () => db.routines.toArray())
  const list = useMemo(() => (d.loaded && routines ? buildTasks(d, today, { routines }) : null), [d, today, routines])
  const tasks = useMemo(() => (list && isArea(area) ? tasksIn(list.tasks, area) : null), [list, area])
  const { leaving } = useFinished(tasks)

  if (!isArea(area)) return <Navigate to="/" replace />
  const def = AREAS.find((a) => a.key === area)!
  const s = list ? areaSummaries(list.tasks)[area] : null
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
          {area === 'tasks' ? (canEdit ? 'Nothing to do. Tap Add for a new task.' : 'Nothing to do.') : 'Nothing to do here.'}
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
        <button className="show-more" style={{ marginTop: 12 }} onClick={() => navigate(def.link!.to(month))}>
          {def.link.label}
        </button>
      )}
      {adding && <RoutineSheet routine={adding} onClose={() => setAdding(null)} />}
    </Page>
  )
}
