import { useRef } from 'react'
import { useChipScroll } from '../../lib/chipScroll'
import { haptic } from '../../lib/haptics'

/** A row of filter chips that scrolls sideways; the chosen one is green-tinted and kept in view. */
export default function Chips({ chips, value, onChange, label }: { chips: { key: string; label: string }[]; value: string; onChange: (key: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useChipScroll(ref, value, 18)
  return (
    <div className="segmented chips" role="group" aria-label={label} ref={ref}>
      {chips.map((c) => (
        <button
          key={c.key}
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
      ))}
    </div>
  )
}
