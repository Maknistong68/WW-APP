import { logEvent } from '../db'
import { showToast } from '../components/Toast'
import { describeSaveError } from './saveError'

/**
 * A write outside a sheet (a menu action, a swipe, Undo). On failure the
 * reason shows in a red toast and goes to the log; the result is undefined.
 */
export async function attempt<T>(what: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (err) {
    const e = describeSaveError(err)
    logEvent(null, 'Save failed', `${what}: ${e.detail}`)
    showToast({
      text: e.text,
      tone: 'bad',
      duration: 8000,
      ...(e.reload ? { actionLabel: 'Reload', onAction: () => window.location.reload() } : {}),
    })
    return undefined
  }
}

/** Like attempt, for writes with no result: true when it worked. */
export async function tryWrite(what: string, fn: () => Promise<unknown>): Promise<boolean> {
  let ok = false
  await attempt(what, async () => {
    await fn()
    ok = true
  })
  return ok
}
