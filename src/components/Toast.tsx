import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { EXIT_MS, reducedMotion } from '../lib/motion'

export interface ToastMessage {
  text: string
  actionLabel?: string
  onAction?: () => void
  duration?: number
}

type Listener = (t: ToastMessage) => void
let listener: Listener | null = null

/** Show a toast from anywhere. One at a time; new toasts replace the current. */
export function showToast(t: ToastMessage) {
  listener?.(t)
}

/** One UI toast: a dark rounded pill above the bottom bar that rises in and sinks out. */
export default function ToastHost() {
  const [toast, setToast] = useState<(ToastMessage & { seq: number }) | null>(null)
  const [closing, setClosing] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    listener = (t) => {
      seq.current += 1
      setClosing(false)
      setToast({ ...t, seq: seq.current })
    }
    return () => {
      listener = null
    }
  }, [])

  const dismiss = useCallback(() => {
    if (reducedMotion()) setToast(null)
    else setClosing(true)
  }, [])

  useEffect(() => {
    if (!toast || closing) return
    const timer = window.setTimeout(dismiss, toast.duration ?? 4500)
    return () => window.clearTimeout(timer)
  }, [toast, closing, dismiss])

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => {
      setToast(null)
      setClosing(false)
    }, EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [closing])

  if (!toast) return null
  return (
    // a new message replays the enter animation
    <div key={toast.seq} className={`toast${closing ? ' closing' : ''}`} role="status">
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
