import { useEffect, useState } from 'react'

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

export default function ToastHost() {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    listener = setToast
    return () => {
      listener = null
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.duration ?? 4500)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null
  return (
    <div className="toast" role="status">
      <span className="toast-text">{toast.text}</span>
      {toast.actionLabel && (
        <button
          className="toast-action"
          onClick={() => {
            toast.onAction?.()
            setToast(null)
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
        ✕
      </button>
    </div>
  )
}
