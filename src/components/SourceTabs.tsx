import { haptic } from '../lib/haptics'
import type { SourceTab } from '../lib/ticketFilter'

const TABS: { key: SourceTab; label: string }[] = [
  { key: 'tickets', label: 'D&C' },
  { key: 'internal', label: 'Cases' },
]

/** D&C | Cases: D&C hotline tickets and the team's own cases kept apart (a One UI sub-tab track). */
export default function SourceTabs({
  value,
  onChange,
  counts,
}: {
  value: SourceTab
  onChange: (tab: SourceTab) => void
  /** A number after each label (e.g. how many are waiting). */
  counts?: Record<SourceTab, number>
}) {
  return (
    <div className="segmented even" role="tablist">
      {TABS.map((k) => (
        <button
          key={k.key}
          role="tab"
          aria-selected={value === k.key}
          className={value === k.key ? 'on' : ''}
          onClick={() => {
            haptic('tick')
            onChange(k.key)
          }}
        >
          {k.label}
          {counts && <b>{counts[k.key]}</b>}
        </button>
      ))}
    </div>
  )
}
