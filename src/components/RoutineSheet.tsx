import { useRef, useState } from 'react'
import { useSave } from '../lib/useSave'
import SaveButton from './SaveButton'
import Modal, { type ModalHandle } from './Modal'
import { openSheet } from './SheetHost'
import { showToast } from './Toast'
import { haptic } from '../lib/haptics'
import { dayMonth, localDate } from '../lib/dates'
import { removeRecord, saveRecord } from '../lib/records'
import { tryWrite } from '../lib/safeWrite'
import { freshDoneThrough, repeatText } from '../lib/routines'
import { backgroundSync } from '../lib/sync'
import type { Routine, RoutineRepeat } from '../types'

const REPEATS: { key: RoutineRepeat; label: string }[] = [
  { key: 'once', label: 'Once' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

/** Add / edit a routine task (shared with the team, shown on Home). */
export default function RoutineSheet({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const [r, setR] = useState(routine)
  const isNew = !routine.updatedAt
  const sheet = useRef<ModalHandle>(null)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(r.start)
  const day = valid ? Number(r.start.slice(8, 10)) : 0

  const { saving, alert, run } = useSave(routine.title ? `Task ${routine.title}` : 'New task')
  const save = () =>
    run(async () => {
      const title = r.title.trim()
      if (!title) return 'Name the task'
      if (!valid) return 'Pick a date'
      // A new task, or a new schedule, starts fresh: never late on day one.
      const rescheduled = isNew || r.start !== routine.start || r.repeat !== routine.repeat
      const rec = { ...r, title, notes: r.notes.trim(), doneThrough: rescheduled ? freshDoneThrough(r.repeat, localDate()) : r.doneThrough }
      await saveRecord('routines', rec, title)
      backgroundSync()
      showToast({ text: isNew ? 'Task added' : 'Task saved' })
      if (sheet.current) sheet.current.close()
      else onClose()
    })

  const remove = () =>
    openSheet({
      kind: 'confirm',
      title: `Delete “${routine.title || 'Task'}”?`,
      message: 'It disappears for the whole team. The activity log keeps a record.',
      confirmLabel: 'Delete task',
      destructive: true,
      onConfirm: () =>
        void tryWrite(`Delete ${routine.title || 'task'}`, () => removeRecord('routines', routine.uuid, routine.title || 'Task')).then((ok) => {
          if (!ok) return
          showToast({ text: 'Task deleted' })
          backgroundSync()
        }),
    })

  const when = !valid
    ? 'Pick a date.'
    : r.repeat === 'once'
      ? `Due ${dayMonth(r.start)}. Shows on Home a week before.`
      : `${repeatText(r)}, from ${dayMonth(r.start)}.${r.repeat === 'monthly' ? ' Shows on Home a week before.' : ' Shows on Home on the day.'}${
          r.repeat === 'monthly' && day > 28 ? ` Months without day ${day} use their last day.` : ''
        }`

  return (
    <Modal
      ref={sheet}
      title={isNew ? 'New task' : 'Edit task'}
      onClose={onClose}
      alert={alert}
      header={
        <SaveButton saving={saving} onClick={() => void save()}>
          {isNew ? 'Add' : 'Save'}
        </SaveButton>
      }
    >
      <div className="sheet-body">
        <div className="list">
          <label className="row">
            <span className="row-label">Task</span>
            <input value={r.title} autoFocus={isNew} placeholder="e.g. Camp walk" onChange={(e) => setR({ ...r, title: e.target.value })} />
          </label>
        </div>
        <div className="segmented fit" role="tablist" aria-label="Repeats">
          {REPEATS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={r.repeat === x.key}
              className={r.repeat === x.key ? 'on' : ''}
              onClick={() => {
                haptic('tick')
                setR({ ...r, repeat: x.key })
              }}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="list">
          <label className="row">
            <span className="row-label">{r.repeat === 'once' ? 'Due' : 'Starts'}</span>
            <input type="date" value={r.start} onChange={(e) => setR({ ...r, start: e.target.value })} />
          </label>
        </div>
        <div className="list-foot">{when}</div>
        <div className="section-label">Notes</div>
        <div className="list">
          <label className="row">
            <textarea value={r.notes} placeholder="No worker names or ID numbers" onChange={(e) => setR({ ...r, notes: e.target.value })} />
          </label>
        </div>
        {!isNew && (
          <div className="list">
            <button className="row" style={{ color: 'var(--bad)', fontWeight: 600 }} onClick={remove}>
              Delete task
            </button>
          </div>
        )}
        <div className="list-foot">The whole team sees this task. Tap it on Home (or swipe left) when it’s done.</div>
      </div>
    </Modal>
  )
}
