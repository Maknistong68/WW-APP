import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import { haptic } from '../lib/haptics'

/** Width of the action behind the row (matches .swipe-action in components.css). */
const ACTION_W = 104

/**
 * Row that slides left to reveal one action. Its icon grows as you drag and
 * pops, with a tick, once letting go will open it. Children stay normal
 * buttons (keyboard friendly); the click that ends a swipe, or a tap while the
 * row is open, is swallowed and just closes the row.
 */
export default function SwipeRow({
  children,
  actionLabel,
  onAction,
  icon = 'check-circle',
  tone = 'good',
  disabled = false,
}: {
  children: ReactNode
  actionLabel: string
  onAction: () => void
  icon?: IconName
  tone?: 'good' | 'info' | 'warn' | 'bad'
  disabled?: boolean
}) {
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const suppress = useRef(false)
  const armed = useRef(false)
  const start = useRef<{ x: number; y: number; base: number; moved: boolean; horizontal: boolean | null } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    start.current = { x: e.clientX, y: e.clientY, base: x, moved: false, horizontal: null }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.horizontal = Math.abs(dx) > Math.abs(dy)
      if (s.horizontal) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (!s.horizontal) return
    s.moved = true
    setDragging(true)
    const next = Math.min(0, Math.max(-ACTION_W * 1.4, s.base + dx))
    const isArmed = next < -ACTION_W / 2
    if (isArmed !== armed.current) {
      armed.current = isArmed
      if (isArmed) haptic('tick')
    }
    setX(next)
  }
  const onPointerUp = () => {
    const s = start.current
    start.current = null
    setDragging(false)
    armed.current = false
    if (!s) return
    if (!s.moved) {
      if (x !== 0) {
        suppress.current = true
        setX(0)
      }
      return
    }
    suppress.current = true
    setX(x < -ACTION_W / 2 ? -ACTION_W : 0)
  }

  const grow = Math.min(1, 0.4 + (-x / ACTION_W) * 0.6)
  return (
    <div className="swipe">
      {!disabled && (
        <button
          className={`swipe-action ${tone}${x < -ACTION_W / 2 && dragging ? ' armed' : ''}`}
          style={{ '--grow': grow } as CSSProperties}
          tabIndex={x === 0 ? -1 : 0}
          onClick={() => {
            setX(0)
            onAction()
          }}
        >
          <span className="swipe-icon" aria-hidden="true">
            <Icon name={icon} size={24} />
          </span>
          {actionLabel}
        </button>
      )}
      <div
        className={`swipe-content${dragging ? ' dragging' : ''}`}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (suppress.current) {
            suppress.current = false
            e.stopPropagation()
            e.preventDefault()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
