import type { ReactNode } from 'react'
import Icon from './Icon'
import { useLongPress } from '../lib/useLongPress'

/** Big rounded card: tile, title, one reason line, a big count and ›. Hold for more. */
export default function BigCard({
  tile,
  title,
  sub,
  count,
  countTone,
  onOpen,
  onMore,
  label,
}: {
  tile: ReactNode
  title: ReactNode
  sub?: ReactNode
  count?: ReactNode
  countTone?: string
  onOpen?: () => void
  onMore?: () => void
  /** Accessible name. */
  label?: string
}) {
  const press = useLongPress(onMore)
  return (
    <button className="bcard" aria-label={label} onClick={onOpen} {...press}>
      {tile}
      <span className="bcard-main">
        <span className="bcard-title">{title}</span>
        {sub && <span className="bcard-sub">{sub}</span>}
      </span>
      {count !== undefined && <span className={`bcard-count ${countTone ?? ''}`}>{count}</span>}
      <Icon name="chevron-right" size={20} className="bcard-chev" />
    </button>
  )
}
