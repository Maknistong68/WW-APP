import { useId } from 'react'
import { haptic } from '../lib/haptics'
import type { DocEntry } from '../types'

/**
 * WPS came in: are all the work order's subcontractors on it? Yes / No; on No,
 * tick the ones missing. Used by the Documents panel and Monthly entry (By item).
 */
export default function WpsSubcons({
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
  const answer = entry?.allSubcons
  const missing = entry?.missing ?? []
  // names ticked before but no longer on the list stay visible, so they can be unticked
  const names = [...subcons, ...missing.filter((m) => !subcons.includes(m))]
  return (
    <div className="wps-subcons">
      <div className="doc-ask" id={askId}>
        All subcontractors included?
      </div>
      <div className="segmented fit doc-variant" role="radiogroup" aria-labelledby={askId}>
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={answer === v}
            className={answer === v ? 'on' : ''}
            onClick={() => {
              haptic('tick')
              onEdit({ allSubcons: answer === v ? null : v })
            }}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
      {answer === false &&
        (names.length ? (
          <>
            <div className="doc-ask">Tick the ones missing</div>
            <div className="obs-chips" role="group" aria-label="Missing subcontractors">
              {names.map((n) => {
                const on = missing.includes(n)
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    className={`obs-chip${on ? ' obs-chip-on' : ''}`}
                    onClick={() => onEdit({ missing: on ? missing.filter((x) => x !== n) : [...missing, n] })}
                  >
                    {on ? '✓ ' : ''}
                    {n}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="doc-ask muted">Add this work order’s subcontractors in the Library to tick the missing ones.</div>
        ))}
    </div>
  )
}
