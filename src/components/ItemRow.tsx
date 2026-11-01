import type { KeyboardEvent, ReactNode } from 'react'
import Icon from './Icon'
import { useLongPress } from '../lib/useLongPress'
import { setAnchor } from '../lib/anchor'

/**
 * A list row inside a CardList: big tile, bold title, muted meta, trailing
 * status and a ⋯ button. Tap opens; long-press or ⋯ opens the quick actions.
 */
export default function ItemRow({
  tile,
  title,
  sub,
  trail,
  onOpen,
  onMore,
  selected,
  wrap = false,
}: {
  tile?: ReactNode
  title: ReactNode
  sub?: ReactNode
  trail?: ReactNode
  onOpen?: () => void
  onMore?: () => void
  selected?: boolean
  /** Let the title wrap to two lines instead of cutting it. */
  wrap?: boolean
}) {
  const press = useLongPress(onMore)
  const onKey = (e: KeyboardEvent) => {
    // keys pressed on the ⋯ button belong to it, not to the row
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen?.()
    }
  }
  return (
    <div
      className={`irow${tile ? ' has-tile' : ''}${onOpen ? ' tappable' : ''}${selected ? ' selected' : ''}${wrap ? ' wrap' : ''}`}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-pressed={selected}
      onClick={onOpen}
      onKeyDown={onOpen ? onKey : undefined}
      {...press}
    >
      {tile}
      <div className="irow-main">
        <div className="irow-title">{title}</div>
        {sub && <div className="irow-sub">{sub}</div>}
      </div>
      {trail}
      {onMore ? (
        <button
          className="irow-more"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation()
            const row = e.currentTarget.closest('.irow')
            if (row) setAnchor(row.getBoundingClientRect())
            onMore()
          }}
        >
          <Icon name="dots" size={22} strokeWidth={2.4} />
        </button>
      ) : onOpen ? (
        <Icon name="chevron-right" size={18} className="irow-chev" />
      ) : null}
    </div>
  )
}
