import { useRef, useState, type ReactNode } from 'react'

const ACTION_W = 96

/**
 * Row that slides left to reveal one action (iOS swipe action). Children
 * stay normal buttons (keyboard friendly); the click that ends a swipe, or a
 * tap while the row is open, is swallowed and just closes the row.
 */
export default function SwipeRow({
  children,
  actionLabel,
  onAction,
  disabled = false,
}: {
  children: ReactNode
  actionLabel: string
  onAction: () => void
  disabled?: boolean
}) {
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const suppress = useRef(false)
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
    setX(Math.min(0, Math.max(-ACTION_W * 1.4, s.base + dx)))
  }
  const onPointerUp = () => {
    const s = start.current
    start.current = null
    setDragging(false)
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

  return (
    <div className="swipe">
      {!disabled && (
        <button
          className="swipe-action"
          tabIndex={x === 0 ? -1 : 0}
          onClick={() => {
            setX(0)
            onAction()
          }}
        >
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
