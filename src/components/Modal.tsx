import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import Icon from './Icon'
import { EXIT_MS, reducedMotion } from '../lib/motion'

export interface ModalHandle {
  /** Animate out, then run `then` (default: onClose). */
  close: (then?: () => void) => void
}

/**
 * One UI floating panel: a bottom sheet (handle, title, ×) or a dialog.
 * Closes with an animation on backdrop tap, ×, Escape or a drag down; moves
 * focus in on open and back on close. Call `ref.close()` to animate out from
 * code (a parent that simply stops rendering it closes it instantly).
 */
const Modal = forwardRef<
  ModalHandle,
  {
    title: string
    onClose: () => void
    children: ReactNode
    /** Extra content rendered inside the header row, after the title. */
    header?: ReactNode
    /** 'dialog': no header row; the children carry the title and buttons. */
    variant?: 'sheet' | 'dialog'
  }
>(function Modal({ title, onClose, children, header, variant = 'sheet' }, ref) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const [closing, setClosing] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const pending = useRef<{ timer: number; done: () => void } | null>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)

  const close = useCallback((then?: () => void) => {
    if (pending.current) return
    const done = then ?? (() => onCloseRef.current())
    if (reducedMotion()) return done()
    setClosing(true)
    const timer = window.setTimeout(() => {
      pending.current = null
      done()
    }, EXIT_MS)
    pending.current = { timer, done }
  }, [])
  useImperativeHandle(ref, () => ({ close }), [close])

  useEffect(() => {
    previousFocus.current = document.activeElement
    sheetRef.current?.querySelector<HTMLElement>('button, input, textarea')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // closed by the parent mid-animation: still run what was asked for
      if (pending.current) {
        window.clearTimeout(pending.current.timer)
        const { done } = pending.current
        pending.current = null
        done()
      }
      ;(previousFocus.current as HTMLElement | null)?.focus?.()
    }
  }, [close])

  // Drag the handle / title down to dismiss.
  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return
    drag.current = { y: e.clientY, dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current || !sheetRef.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    sheetRef.current.style.transition = 'none'
    sheetRef.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const onPointerUp = () => {
    if (!drag.current || !sheetRef.current) return
    const far = drag.current.dy > 90
    drag.current = null
    sheetRef.current.style.transition = ''
    sheetRef.current.style.transform = ''
    if (far) close()
  }

  return (
    <div className={`modal-backdrop${closing ? ' closing' : ''}`} onClick={() => close()}>
      <div
        className={`modal${variant === 'dialog' ? ' dialog' : ''}`}
        role={variant === 'dialog' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={title}
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        {variant === 'sheet' && (
          <div
            className="modal-head"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <b>{title}</b>
            {header}
            <button className="icon-btn" aria-label="Close" onClick={() => close()}>
              <Icon name="x" size={22} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
})

export default Modal

/** In-app replacement for window.confirm(): a One UI dialog. */
export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<ModalHandle>(null)
  return (
    <Modal ref={ref} title={title} onClose={onCancel} variant="dialog">
      <div className="dialog-body">
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-text">{message}</p>
      </div>
      <div className="dialog-actions">
        <button className="dialog-btn" onClick={() => ref.current?.close()}>
          Cancel
        </button>
        <button className={`dialog-btn ${destructive ? 'danger' : 'strong'}`} onClick={() => ref.current?.close(onConfirm)}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
