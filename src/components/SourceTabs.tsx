import { haptic } from '../lib/haptics'
import type { ListTab, SourceTab } from '../lib/ticketFilter'

const TABS: { key: ListTab; label: string }[] = [
  { key: 'tickets', label: 'D&C Tickets' },
  { key: 'internal', label: 'Cases' },
  { key: 'all', label: 'All' },
]

/**
 * D&C Tickets | Cases: D&C hotline tickets and the team's own cases kept apart
 * (a One UI sub-tab track). With `all`, a third tab shows both together.
 */
export default function SourceTabs<T extends SourceTab | ListTab>({
  value,
  onChange,
  counts,
  all = false,
}: {
  value: T
  onChange: (tab: T) => void
  /** A number after each label (e.g. how many are waiting). */
  counts?: Partial<Record<ListTab, number>>
  /** Show the All tab too. */
  all?: boolean
}) {
  return (
    <div className="segmented even" role="tablist">
      {TABS.filter((k) => all || k.key !== 'all').map((k) => (
        <button
          key={k.key}
          role="tab"
          aria-selected={value === k.key}
          className={value === k.key ? 'on' : ''}
          onClick={() => {
            haptic('tick')
            onChange(k.key as T)
          }}
        >
          {k.label}
          {counts && counts[k.key] !== undefined && <b>{counts[k.key]}</b>}
        </button>
      ))}
    </div>
  )
}
