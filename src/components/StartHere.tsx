import { useRef, useState } from 'react'
import DoneCheck from './DoneCheck'
import { LeavingCard, TaskCard } from './TaskRow'
import type { AllData } from '../lib/kpiData'
import type { Task } from '../lib/tasks'

/**
 * Home's "Start here": every late or this-week job as a card, side by side.
 * Swipe across to the next one; the heading says which card you're on.
 * Finished ones show their check and fade. With nothing urgent: All caught up.
 */
export default function StartHere({ tasks, leaving, d, canEdit, burst }: { tasks: Task[]; leaving: Task[]; d: AllData; canEdit: boolean; burst: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const out = leaving.filter((t) => t.group === 'overdue' || t.group === 'week')
  const count = tasks.length

  const onScroll = () => {
    const el = track.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    const i = Math.round(el.scrollLeft / (first.offsetWidth + gap)) - out.length
    setAt(Math.min(count - 1, Math.max(0, i)))
  }

  return (
    <section className="hstart" aria-label="Start here">
      <h2 className="clist-head">
        Start here
        {count > 0 && (
          <span className="hstart-pos">
            {Math.min(at, count - 1) + 1} of {count}
          </span>
        )}
      </h2>
      {count === 0 && !out.length ? (
        <div className="caught-up">
          <DoneCheck size={64} burst={burst} label="All caught up" />
          <div>
            <b>All caught up</b>
            <span>Nothing late or due this week.</span>
          </div>
        </div>
      ) : (
        <div className="hstart-track" ref={track} onScroll={onScroll}>
          {out.map((t) => (
            <LeavingCard key={`out-${t.key}`} t={t} />
          ))}
          {tasks.map((t) => (
            <TaskCard key={t.key} t={t} d={d} canEdit={canEdit} />
          ))}
        </div>
      )}
    </section>
  )
}
