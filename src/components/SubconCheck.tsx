import { useId } from 'react'
import { haptic } from '../lib/haptics'
import { subconTick, subconTicked } from '../lib/submissions'
import type { DocEntry } from '../types'

/**
 * WPS or Salary declaration came in: is every subcontractor of the work order
 * on it? The work order's list (Library) shows at once; tick each one on the
 * document. All ticked = all included; any left unticked is named as missing.
 * Used by the Documents panel and Monthly entry (By item).
 */
export default function SubconCheck({
  entry,
  subcons,
  onEdit,
}: {
  entry: DocEntry | undefined
  /** The work order's subcontractors (Library). */
  subcons: string[]
  onEdit: (change: { allSubcons?: boolean | null; missing?: string[] }) => void
}) {
  const askId = useId()
  // names marked missing before but no longer on the list stay, so they can be ticked off
  const names = [...subcons, ...(entry?.missing ?? []).filter((m) => !subcons.includes(m))]
  if (!names.length) {
    return <div className="doc-ask muted">Add this work order’s subcontractors in the Library (Contractors › work order) to check them here.</div>
  }
  const all = entry?.allSubcons === true
  return (
    <div className="subcon-check">
      <div className="doc-ask" id={askId}>
        All subcontractors included? Tick each one on it.
      </div>
      <div className="obs-chips" role="group" aria-labelledby={askId}>
        {names.map((n) => {
          const on = subconTicked(entry, n)
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              className={`obs-chip${on ? ' obs-chip-on' : ''}`}
              onClick={() => {
                haptic('tick')
                onEdit(subconTick(entry, subcons, n))
              }}
            >
              {on ? '✓ ' : ''}
              {n}
            </button>
          )
        })}
        <button
          type="button"
          className={`obs-chip subcon-all${all ? ' obs-chip-on' : ''}`}
          aria-pressed={all}
          onClick={() => {
            haptic('tick')
            onEdit(all ? { allSubcons: null } : { allSubcons: true })
          }}
        >
          {all ? '✓ All included' : 'All included'}
        </button>
      </div>
    </div>
  )
}
