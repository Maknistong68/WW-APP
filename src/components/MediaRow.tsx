import type { KeyboardEvent, ReactNode } from 'react'
import Icon from './Icon'
import { useLongPress } from '../lib/useLongPress'

/**
 * Spotify-style row: cover, title, muted subtitle, trailing info and a ⋯
 * button. Tap opens; long-press or ⋯ opens the quick-action sheet.
 */
export default function MediaRow({
  cover,
  title,
  sub,
  trail,
  onOpen,
  onMore,
  selected,
  className = '',
}: {
  cover?: ReactNode
  title: ReactNode
  sub?: ReactNode
  trail?: ReactNode
  onOpen?: () => void
  onMore?: () => void
  selected?: boolean
  className?: string
}) {
  const press = useLongPress(onMore)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen?.()
    }
  }
  return (
    <div
      className={`mrow${onOpen ? ' tappable' : ''}${selected ? ' selected' : ''} ${className}`}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-pressed={selected}
      onClick={onOpen}
      onKeyDown={onOpen ? onKey : undefined}
      {...press}
    >
      {cover}
      <div className="mrow-main">
        <div className="mrow-title">{title}</div>
        {sub && <div className="mrow-sub">{sub}</div>}
      </div>
      {trail}
      {onMore && (
        <button
          className="mrow-more"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation()
            onMore()
          }}
        >
          <Icon name="dots" size={22} strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}
