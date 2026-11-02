import { useCallback, useRef, useState } from 'react'
import { logEvent } from '../db'
import { showToast } from '../components/Toast'
import { haptic } from './haptics'
import { runSave } from './saveRun'

export const reloadApp = () => window.location.reload()

/**
 * Save from a sheet. `run(fn)`: fn returns a sentence when something must be
 * fixed first, nothing when it saved, or throws. The reason shows in the
 * sheet (`error`) and, for real failures, in a red toast with Reload when that
 * is the way out. A second tap while saving does nothing.
 */
export function useSave(what: string) {
  const [saving, setSaving] = useState(false)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  const run = useCallback(
    async (fn: () => Promise<string | void | undefined>): Promise<boolean> => {
      if (busy.current) return false
      busy.current = true
      setSaving(true)
      setSlow(false)
      setError(null)
      const r = await runSave(what, fn, { log: (e, d) => logEvent(null, e, d), onSlow: () => setSlow(true) })
      busy.current = false
      setSaving(false)
      setSlow(false)
      if (r.ok) return true
      haptic('warn')
      if (r.problem) setError(r.problem)
      if (r.error) {
        setError(r.error.text)
        showToast({
          text: r.error.text,
          tone: 'bad',
          duration: 8000,
          ...(r.error.reload ? { actionLabel: 'Reload', onAction: reloadApp } : {}),
        })
      }
      return false
    },
    [what],
  )

  /** What the sheet shows under its title: the problem, or a note when it's slow. */
  const alert = error ?? (slow ? 'Still saving… keep the app open.' : null)
  return { saving, alert, run, clear: () => setError(null) }
}
