import { useEffect, useRef, type ReactNode } from 'react'
import Icon from './Icon'

/**
 * Bottom-sheet modal: closes on backdrop tap and Escape, moves focus into the
 * sheet on open and restores it on close.
 */
export default function Modal({
  title,
  onClose,
  children,
  header,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  /** Extra content rendered inside the header row, after the title. */
  header?: ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement
    sheetRef.current?.querySelector<HTMLElement>('button, input, textarea')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      ;(previousFocus.current as HTMLElement | null)?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <b>{title}</b>
          {header}
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** In-app replacement for window.confirm(), styled as a bottom sheet. */
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
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm-body">
        <p>{message}</p>
        <div className="btn-row">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className={`btn ${destructive ? 'danger' : 'primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
