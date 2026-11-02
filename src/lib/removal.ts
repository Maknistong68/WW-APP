import type { ActivityEntry } from '../types'

/** What stops a ticket from being removed: the admin must say why (kept in the activity log). */
export function removalProblem(reason: string): string | null {
  const r = reason.trim()
  if (!r) return 'Say why it is being removed'
  if (r.length < 5) return 'Say why in a few more words'
  return null
}

/** The newest removal of a ticket in the activity log: its reason, time and entry (for who). */
export function removalInfo(entries: ActivityEntry[], uuid: string): { reason: string; time: string; entry: ActivityEntry } | null {
  let best: ActivityEntry | undefined
  for (const e of entries) if (e.entityUuid === uuid && e.action === 'delete' && (!best || e.time > best.time)) best = e
  if (!best) return null
  const reason = best.changes.find((c) => c.field === 'reason')?.to
  return { reason: typeof reason === 'string' ? reason : '', time: best.time, entry: best }
}
