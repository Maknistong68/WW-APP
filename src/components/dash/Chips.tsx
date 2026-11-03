import { Fragment, useRef } from 'react'
import { useChipScroll } from '../../lib/chipScroll'
import { haptic } from '../../lib/haptics'

/**
 * A row of filter chips that scrolls sideways; the chosen one is green-tinted and kept in view.
 * A chip with `sep` starts a new group (a hairline before it).
 */
export default function Chips({
  chips,
  value,
  onChange,
  label,
  className = '',
}: {
  chips: { key: string; label: string; sep?: boolean }[]
  value: string
  onChange: (key: string) => void
  label: string
  /** Extra class (e.g. "page-chips" for a row on a page rather than in a card). */
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useChipScroll(ref, value, 18)
  return (
    <div className={`segmented chips ${className}`.trim()} role="group" aria-label={label} ref={ref}>
      {chips.map((c) => (
        <Fragment key={c.key}>
        {c.sep && <span className="chip-sep" aria-hidden="true" />}
        <button
          type="button"
          aria-pressed={c.key === value}
          className={c.key === value ? 'on' : ''}
          onClick={() => {
            if (c.key === value) return
            haptic('tick')
            onChange(c.key)
          }}
        >
          {c.label}
        </button>
        </Fragment>
      ))}
    </div>
  )
}
