import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import Icon from './Icon'
import { EXIT_MS, reducedMotion } from '../lib/motion'
import { beginEdit } from '../lib/editing'
import { useBackClose, useFocusTrap } from '../lib/useBackClose'

export interface ModalHandle {
  /** Animate out, then run `then` (default: onClose). */
  close: (then?: () => void) => void
}

/**
 * One UI floating panel: a bottom sheet (handle, title, ×) or a dialog.
 * Closes with an animation on backdrop tap, ×, Escape, the phone's Back or a
 * drag down (asking first if something was changed); keeps focus inside while
 * open and puts it back on close. Call `ref.close()` to animate out from code,
 * without asking (a parent that simply stops rendering it closes it instantly).
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
    /** Why the last save didn't go through. Shown under the title, outside the scrolling body, so it's always in view. */
    alert?: string | null
  }
>(function Modal({ title, onClose, children, header, variant = 'sheet', alert }, ref) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const askRef = useRef<HTMLDivElement>(null)
  const askId = useId()
  // Who had focus before the panel opened (read during render, before any autoFocus inside it).
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  const [closing, setClosing] = useState(false)
  const [asking, setAsking] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const pending = useRef<{ timer: number; done: () => void } | null>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)
  /** Something was typed or picked: ask before throwing it away. */
  const dirty = useRef(false)

  const close = useCallback((then?: () => void) => {
    if (pending.current) return
    setAsking(false)
    const done = then ?? (() => onCloseRef.current())
    if (reducedMotion()) return done()
    setClosing(true)
    const timer = window.setTimeout(() => {
      pending.current = null
      done()
    }, EXIT_MS)
    pending.current = { timer, done }
  }, [])
  // Code (a save, a Cancel button) closes straight away; only the person's own
  // dismiss (scrim, drag, Escape, ×, Back) asks about unsaved changes.
  useImperativeHandle(ref, () => ({ close }), [close])

  /** Returns true when the panel stays open (it asked first). */
  const dismiss = useCallback(() => {
    if (pending.current) return false
    if (dirty.current) {
      setAsking(true)
      return true
    }
    close()
    return false
  }, [close])
  const keepEditing = () => {
    setAsking(false)
    sheetRef.current?.focus({ preventScroll: true })
  }

  const isTop = useBackClose(true, () => {
    if (asking) {
      keepEditing()
      return true
    }
    return dismiss()
  })
  useFocusTrap(sheetRef, !asking, isTop)
  useFocusTrap(askRef, asking, isTop)

  // An app update waits while a panel is open (see lib/appUpdate.ts).
  useEffect(() => beginEdit(), [])

  // Mark the sheet changed on any edit inside it (search boxes don't count).
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const onEdit = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (!t || t.closest('[data-no-dirty], .discard') || (t instanceof HTMLInputElement && t.type === 'search')) return
      dirty.current = true
    }
    el.addEventListener('input', onEdit, true)
    el.addEventListener('change', onEdit, true)
    return () => {
      el.removeEventListener('input', onEdit, true)
      el.removeEventListener('change', onEdit, true)
    }
  }, [])

  // Focus moves in before paint: keep an autoFocus field's focus, else the
  // first field (on a touch phone the panel itself, so the keyboard stays down).
  useLayoutEffect(() => {
    const el = sheetRef.current
    if (el && !el.contains(document.activeElement)) {
      const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
      const pick = touch
        ? el.querySelector<HTMLElement>('[autofocus]')
        : (['[autofocus]', 'input:not([type="hidden"]):not([disabled])', 'textarea:not([disabled])', 'select:not([disabled])', 'button:not([disabled])']
            .map((q) => el.querySelector<HTMLElement>(q))
            .find(Boolean) ?? null)
      ;(pick ?? el).focus({ preventScroll: true })
    }
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [opener])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTop()) return
      if (asking) keepEditing()
      else dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  // Closed by the parent mid-animation: still run what was asked for.
  useEffect(
    () => () => {
      if (pending.current) {
        window.clearTimeout(pending.current.timer)
        const { done } = pending.current
        pending.current = null
        done()
      }
    },
    [],
  )

  useEffect(() => {
    if (asking) askRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }, [asking])

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
    if (far) dismiss()
  }

  return (
    <div className={`modal-backdrop${closing ? ' closing' : ''}`} onClick={() => (asking ? keepEditing() : dismiss())}>
      <div
        className={`modal${variant === 'dialog' ? ' dialog' : ''}`}
        role={variant === 'dialog' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
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
            <button className="icon-btn" aria-label="Dismiss" onClick={() => dismiss()}>
              <Icon name="x" size={22} />
            </button>
          </div>
        )}
        {alert && (
          <div className="sheet-alert" role="alert">
            <Icon name="alert" size={18} />
            <span>{alert}</span>
          </div>
        )}
        {children}
        {asking && (
          <div className="discard" onClick={keepEditing}>
            <div
              ref={askRef}
              className="discard-box"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={askId}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="dialog-title" id={askId}>
                Discard changes?
              </h2>
              <div className="dialog-actions">
                <button className="dialog-btn" onClick={keepEditing}>
                  Keep editing
                </button>
                <button className="dialog-btn danger" onClick={() => close()}>
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
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
