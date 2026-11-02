// ---------------------------------------------------------------------------
// Why a save failed, in plain words. IndexedDB (through Dexie) fails with
// named errors; a full disk usually arrives wrapped in an AbortError whose
// `inner` names the real cause.
// ---------------------------------------------------------------------------

export interface SaveErrorInfo {
  /** What the person reads. */
  text: string
  /** The technical name and message, for the log. */
  detail: string
  /** Reloading the app is the way out. */
  reload?: boolean
}

type Named = { name?: unknown; message?: unknown; inner?: Named | null }

const named = (e: unknown): Named | null => (e && typeof e === 'object' ? (e as Named) : null)

/** The error that matters: Dexie's `inner` cause when there is one. */
function cause(err: unknown): { name: string; message: string } {
  const e = named(err)
  const inner = named(e?.inner)
  const pick = inner?.name ? inner : e
  if (!pick) return { name: 'Error', message: String(err) }
  return { name: String(pick.name ?? 'Error'), message: String(pick.message ?? '') }
}

const UPDATED = new Set(['VersionError', 'DatabaseClosedError', 'OpenFailedError'])
const NO_ANSWER = new Set(['InvalidStateError', 'UnknownError', 'MissingAPIError'])

export function describeSaveError(err: unknown): SaveErrorInfo {
  const { name, message } = cause(err)
  const detail = `${name}: ${message}`
  if (name === 'QuotaExceededError') return { text: 'Phone storage is full. Free up space, then save again.', detail }
  if (UPDATED.has(name)) return { text: 'The app was updated. Reload to save.', detail, reload: true }
  if (NO_ANSWER.has(name)) return { text: 'Phone storage didn’t answer. Reload the app.', detail, reload: true }
  if (name === 'ConstraintError') return { text: 'This already exists.', detail }
  if (name === 'DataCloneError') return { text: 'Could not save this record.', detail }
  return { text: `Could not save: ${message || name}`, detail }
}

/** Errors nobody needs to see: skipped screen transitions, ResizeObserver loops, a refused clipboard. */
export function isNoise(err: unknown): boolean {
  const e = named(err)
  const message = String(e?.message ?? err ?? '')
  if (/ResizeObserver loop/i.test(message)) return true
  if (e?.name === 'NotAllowedError') return true
  return e?.name === 'AbortError' && !named(e.inner)?.name
}

/** Names that only the phone's storage (IndexedDB, Dexie) uses. */
const STORAGE_ONLY = new Set(['QuotaExceededError', 'VersionError', 'DatabaseClosedError', 'OpenFailedError', 'MissingAPIError'])

/**
 * An error nobody caught (the app-wide handler in main.tsx). Storage trouble
 * gets its own words; anything else — even with a shared name such as
 * InvalidStateError from a video or a canvas — is not blamed on storage.
 */
export function unexpectedText(err: unknown): SaveErrorInfo {
  const d = describeSaveError(err)
  const { name, message } = cause(err)
  const fromStorage = STORAGE_ONLY.has(name) || /IDB|IndexedDB|Dexie|database/i.test(message)
  if (fromStorage && !d.text.startsWith('Could not save:')) return d
  return { text: 'Something went wrong. Details in Settings › Sync log.', detail: d.detail }
}
