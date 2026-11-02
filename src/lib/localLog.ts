// A copy of the last technical log lines in localStorage. If the phone's
// database itself is what broke, Settings can still show what happened.

export interface LocalLogEntry {
  time: string
  event: string
  detail: string
}

const KEY = 'ww.lastErrors'
const MAX = 20

/** Newest first, at most `max` items. */
export function pushRing<T>(list: T[], item: T, max = MAX): T[] {
  return [item, ...list].slice(0, max)
}

export function readLocalLog(): LocalLogEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? (raw as LocalLogEntry[]) : []
  } catch {
    return []
  }
}

export function writeLocalLog(entry: LocalLogEntry): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pushRing(readLocalLog(), entry)))
  } catch {
    // private mode or full: nothing more we can do
  }
}
