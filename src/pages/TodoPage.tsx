import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import ItemRow from '../components/ItemRow'
import CardList from '../components/CardList'
import RoutineSheet from '../components/RoutineSheet'
import AreaCard from '../components/AreaCard'
import StartHere from '../components/StartHere'
import HomeEditor from '../components/HomeEditor'
import GetStarted from '../components/GetStarted'
import UseAppNote from '../components/UseAppNote'
import { useFinished } from '../components/TaskRow'
import { areaMenu } from '../components/menus'
import { useAuthInfo } from '../lib/auth'
import { localDate } from '../lib/dates'
import { lastEndedMonth } from '../lib/due'
import { haptic } from '../lib/haptics'
import { DEFAULT_ORDER, greeting, loadOrder, moveSection, saveOrder, type HomeSection } from '../lib/homeLayout'
import { useAllData } from '../lib/kpiData'
import { useCachedLiveQuery } from '../lib/useCachedQuery'
import { newRoutine } from '../lib/useData'
import { db } from '../db'
import { AREAS, areaSummaries, buildTasks } from '../lib/tasks'
import type { Routine } from '../types'

// Home ("Good morning"): sections in each person's own order (Edit Home).
// - Start here: every late or this-week job as a card with its button, side by side.
// - All areas: the six areas as app icons with a badge for what's urgent, or the next date.
//   Tap opens the area's list (/today/:area); hold for a quick look.
// - Watch: things with no deadline. Month progress: how much is entered.

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
  const [adding, setAdding] = useState<Routine | null>(null)
  const [order, setOrder] = useState<HomeSection[]>(loadOrder)
  const [editing, setEditing] = useState(false)
  // Routine tasks the team added (+ → Task); shown once both have loaded.
  const routines = useCachedLiveQuery('routines', () => db.routines.toArray())
  const list = useMemo(() => (d.loaded && routines ? buildTasks(d, today, { routines }) : null), [d, today, routines])
  const areas = useMemo(() => (list ? areaSummaries(list.tasks) : null), [list])
  const urgent = useMemo(() => (list ? list.tasks.filter((t) => t.group === 'overdue' || t.group === 'week') : []), [list])
  // Finished since the last look: check, fade, buzz.
  const { leaving } = useFinished(list?.tasks ?? null)
  const [burst] = useState(() => burstToday(today))
  const now = new Date()
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const month = list?.progress?.month

  const move = (key: HomeSection, by: -1 | 1) => {
    haptic('tick')
    setOrder((o) => {
      const next = moveSection(o, key, by)
      saveOrder(next)
      return next
    })
  }
  const reset = () => {
    haptic('tick')
    setOrder(DEFAULT_ORDER)
    saveOrder(DEFAULT_ORDER)
  }

  const section = (key: HomeSection): ReactNode => {
    if (!list || !areas) return null
    switch (key) {
      case 'start':
        return <StartHere tasks={urgent} leaving={leaving} d={d} canEdit={canEdit} burst={burst} />
      case 'areas':
        return (
          <section className="hareas" aria-label="All areas">
            <h2 className="clist-head">All areas</h2>
            <div className="hgrid">
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
          </section>
        )
      case 'watch':
        return list.watch.length ? (
          <CardList title="Watch">
            {list.watch.map((w) => (
              <ItemRow key={w.key} tile={<span className={`watch-n schip ${w.tone}`}>{w.n}</span>} title={w.text} onOpen={() => navigate(w.to)} />
            ))}
          </CardList>
        ) : null
      case 'progress':
        return list.progress && list.progress.total > 0 ? (
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
        ) : null
    }
  }

  return (
    <Page title={greeting(now.getHours())} subtitle={date}>
      {!list || !areas ? (
        <div className="home">
          <div className="skeleton" style={{ height: 196, marginTop: 30 }} />
          <div className="skeleton" style={{ height: 236, marginTop: 48 }} />
        </div>
      ) : editing ? (
        <HomeEditor order={order} onMove={move} onReset={reset} onDone={() => setEditing(false)} />
      ) : (
        <div className="home stagger">
          <UseAppNote />
          <GetStarted />
          {order.map((key) => {
            const body = section(key)
            return body ? (
              <div key={key} className="home-sec">
                {body}
              </div>
            ) : null
          })}
          <div className="home-foot">
            <button type="button" className="btn home-edit-btn" onClick={() => setEditing(true)}>
              <Icon name="move" size={20} />
              Edit Home
            </button>
          </div>
        </div>
      )}
      {adding && <RoutineSheet routine={adding} onClose={() => setAdding(null)} />}
    </Page>
  )
}
