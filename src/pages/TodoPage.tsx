import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import ItemRow from '../components/ItemRow'
import CardList from '../components/CardList'
import StatCard from '../components/StatCard'
import DoneCheck from '../components/DoneCheck'
import RoutineSheet from '../components/RoutineSheet'
import AreaCard from '../components/AreaCard'
import { TaskGroups, useFinished } from '../components/TaskRow'
import { areaMenu } from '../components/menus'
import { useAuthInfo } from '../lib/auth'
import { dayMonth, localDate } from '../lib/dates'
import { declarationsDue, dueTone, kpisDue, lastEndedMonth } from '../lib/due'
import { haptic } from '../lib/haptics'
import { useAllData } from '../lib/kpiData'
import { useCachedLiveQuery } from '../lib/useCachedQuery'
import { newRoutine } from '../lib/useData'
import { db } from '../db'
import { AREAS, areaSummaries, buildTasks, type TaskGroup } from '../lib/tasks'
import type { Routine } from '../types'

// Home: the date strip, three counters (Overdue / This week / Done) and six
// plain cards, two side by side: Tickets, Submission, KPIs, Accommodation, Audits
// and Tasks. A card says its most urgent thing ("3 late"); tap opens its list
// (/today/:area), hold for a quick look. A counter tapped shows that group's
// named rows from every card.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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
  const [adding, setAdding] = useState<Routine | null>(null)
  // Routine tasks the team added (+ → Task); shown once both have loaded.
  const routines = useCachedLiveQuery('routines', () => db.routines.toArray())
  const list = useMemo(() => (d.loaded && routines ? buildTasks(d, today, { routines }) : null), [d, today, routines])
  const areas = useMemo(() => (list ? areaSummaries(list.tasks) : null), [list])
  // Finished since the last look: check, slide away, buzz, bump Done.
  const { leaving, bump } = useFinished(list?.tasks ?? null, list?.counts.done ?? 0)

  const clear = list ? list.counts.overdue + list.counts.week === 0 : false
  const [burst] = useState(() => burstToday(today))
  const toggle = (g: TaskGroup) => {
    haptic('tick')
    setOnly((o) => (o === g ? null : g))
  }
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

  const shown = only && list ? list.tasks.filter((t) => t.group === only) : []

  return (
    <Page title="Today" subtitle={date}>
      {strip && <div className={`due-strip ${strip.tone}`}>{strip.text}</div>}

      <div className="stats">
        <StatCard icon="alert" tone="bad" value={list ? list.counts.overdue : '–'} label="Overdue" active={only === 'overdue'} onClick={() => toggle('overdue')} />
        <StatCard icon="clock" tone="warn" value={list ? list.counts.week : '–'} label="This week" active={only === 'week'} onClick={() => toggle('week')} />
        <StatCard icon="check-circle" tone="good" value={list ? list.counts.done : '–'} label="Done" active={only === 'done'} bump={bump} onClick={() => toggle('done')} />
      </div>

      {!list || !areas ? (
        <div className="acards">
          {AREAS.map((a) => (
            <div key={a.key} className="skeleton" style={{ height: 112 }} />
          ))}
        </div>
      ) : only ? (
        // A counter tapped: that group's named rows, from every card.
        <div className="tasks">
          {shown.length || leaving.some((t) => t.group === only) ? (
            <TaskGroups tasks={list.tasks} groups={[only]} leaving={leaving} d={d} canEdit={canEdit} />
          ) : (
            <div className="empty-state" style={{ marginTop: 24 }}>
              <Icon name="check-circle" size={44} />
              <b>Nothing here</b>
              {only === 'overdue' ? 'Nothing is late.' : only === 'week' ? 'Nothing due this week.' : 'Nothing done yet this month.'}
            </div>
          )}
          <div className="list-foot" style={{ textAlign: 'center', marginTop: 20 }}>
            {canEdit ? 'Tap or swipe left to do it · hold for more' : 'Tap to open · hold for more'}
          </div>
        </div>
      ) : (
        <div className="tasks">
          {clear && (
            <div className="caught-up">
              <DoneCheck size={64} burst={burst} label="All caught up" />
              <div>
                <b>All caught up</b>
                <span>Nothing overdue or due this week.</span>
              </div>
            </div>
          )}

          <div className="acards stagger">
            {AREAS.map((a) => (
              <AreaCard
                key={a.key}
                a={a}
                s={areas[a.key]}
                onOpen={() => navigate(`/today/${a.key}`)}
                onMore={() =>
                  areaMenu(a, areas[a.key], {
                    month: month ?? lastEndedMonth(today),
                    onAddTask: a.key === 'tasks' && canEdit ? () => setAdding(newRoutine()) : undefined,
                  })
                }
              />
            ))}
          </div>

          {list.watch.length > 0 && (
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

          {list.progress && list.progress.total > 0 && (
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

          <div className="list-foot" style={{ textAlign: 'center', marginTop: 20 }}>
            Tap a card for its list · hold for a quick look
          </div>
        </div>
      )}
      {adding && <RoutineSheet routine={adding} onClose={() => setAdding(null)} />}
    </Page>
  )
}
