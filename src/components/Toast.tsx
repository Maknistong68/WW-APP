import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { EXIT_MS, reducedMotion } from '../lib/motion'

export interface ToastMessage {
  text: string
  actionLabel?: string
  onAction?: () => void
  duration?: number
  /** 'bad': something failed. Shown with a warning icon and read out at once. */
  tone?: 'bad'
}

type Listener = (t: ToastMessage) => void
let listener: Listener | null = null

/** Show a toast from anywhere. One at a time; new toasts replace the current (a plain one waits behind an Undo). */
export function showToast(t: ToastMessage) {
  listener?.(t)
}

/** One UI toast: a dark rounded pill above the bottom bar that rises in and sinks out. */
export default function ToastHost() {
  const [toast, setToast] = useState<(ToastMessage & { seq: number }) | null>(null)
  const [closing, setClosing] = useState(false)
  const seq = useRef(0)

  // A plain notice waits while an Undo is on screen, so the Undo window isn't cut short.
  const current = useRef<ToastMessage | null>(null)
  const waiting = useRef<ToastMessage | null>(null)
  current.current = closing ? null : toast

  useEffect(() => {
    listener = (t) => {
      const shown = current.current
      if (shown?.actionLabel && !t.actionLabel && t.tone !== 'bad') {
        waiting.current = t
        return
      }
      seq.current += 1
      setClosing(false)
      setToast({ ...t, seq: seq.current })
    }
    return () => {
      listener = null
    }
  }, [])

  const dismiss = useCallback(() => {
    if (reducedMotion()) {
      const next = waiting.current
      waiting.current = null
      if (next) {
        seq.current += 1
        setToast({ ...next, seq: seq.current })
      } else setToast(null)
    } else setClosing(true)
  }, [])

  useEffect(() => {
    if (!toast || closing) return
    const timer = window.setTimeout(dismiss, toast.duration ?? 4500)
    return () => window.clearTimeout(timer)
  }, [toast, closing, dismiss])

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => {
      const next = waiting.current
      waiting.current = null
      setClosing(false)
      if (next) {
        seq.current += 1
        setToast({ ...next, seq: seq.current })
      } else setToast(null)
    }, EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [closing])

  if (!toast) return null
  return (
    // a new message replays the enter animation
    <div
      key={toast.seq}
      className={`toast${toast.tone === 'bad' ? ' bad' : ''}${closing ? ' closing' : ''}`}
      role={toast.tone === 'bad' ? 'alert' : 'status'}
    >
      {toast.tone === 'bad' && <Icon name="alert" size={20} className="toast-icon" />}
      <span className="toast-text">{toast.text}</span>
      {toast.actionLabel && (
        <button
          className="toast-action"
          onClick={() => {
            toast.onAction?.()
            dismiss()
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button className="toast-close" aria-label="Dismiss" onClick={dismiss}>
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
