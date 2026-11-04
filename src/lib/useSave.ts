import { useCallback, useRef, useState } from 'react'
import { dbStateText, isDbBlocked, logEvent } from '../db'
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
  const [slow, setSlow] = useState<false | 'slow' | 'stuck'>(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  const run = useCallback(
    async (fn: () => Promise<string | void | undefined>): Promise<boolean> => {
      if (busy.current) return false
      busy.current = true
      setSaving(true)
      setSlow(false)
      setError(null)
      const r = await runSave(what, fn, {
        log: (e, d) => logEvent(null, e, d),
        state: dbStateText,
        onSlow: () => setSlow('slow'),
        onStuck: () => {
          setSlow('stuck')
          // what was typed is kept (src/lib/pendingSaves.ts) and saved after the reload
          if (!isDbBlocked()) showToast({ text: 'This save is stuck. Reload: what you typed is kept.', tone: 'bad', duration: 15000, actionLabel: 'Reload', onAction: reloadApp })
        },
      })
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

  /** What the sheet shows under its title: the problem, or a note when it's slow or stuck. */
  const alert =
    error ??
    (!slow
      ? null
      : isDbBlocked()
        ? 'WW Co-pilot is also open in another tab or window. Close it and the save finishes.'
        : slow === 'stuck'
          ? 'This save is stuck. Tap Reload: what you typed is kept.'
          : 'Still saving…')
  return { saving, alert, run, clear: () => setError(null) }
}
