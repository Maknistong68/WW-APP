import { describeSaveError, type SaveErrorInfo } from './saveError'

/** After this long a save is noted as slow (it still may finish). */
export const SLOW_MS = 8000

export type SaveOutcome = { ok: true } | { ok: false; problem?: string; error?: SaveErrorInfo }

/**
 * Run one save. The function returns a sentence when something must be
 * fixed first ("Pick an issue"), nothing when it saved, or throws. Every
 * stop and failure is logged, so a phone that "does nothing" says why.
 */
export async function runSave(
  what: string,
  fn: () => Promise<string | void | undefined>,
  opts: { log: (event: string, detail: string) => void; slowMs?: number; onSlow?: () => void },
): Promise<SaveOutcome> {
  const slowMs = opts.slowMs ?? SLOW_MS
  const timer = setTimeout(() => {
    opts.log('Save slow', `${what}: still waiting after ${slowMs} ms`)
    opts.onSlow?.()
  }, slowMs)
  try {
    const problem = await fn()
    if (typeof problem === 'string' && problem) {
      opts.log('Save stopped', `${what}: ${problem}`)
      return { ok: false, problem }
    }
    return { ok: true }
  } catch (err) {
    const error = describeSaveError(err)
    opts.log('Save failed', `${what}: ${error.detail}`)
    return { ok: false, error }
  } finally {
    clearTimeout(timer)
  }
}
