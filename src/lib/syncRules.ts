// Pure sync rules (no database), so they can be tested on their own.

/**
 * True when `a` is a strictly later instant than `b`. Timestamps must be
 * compared as parsed dates: local values are `...Z` ISO strings while
 * PostgREST serializes timestamptz as `...+00:00`, so lexicographic
 * comparison mis-orders identical instants.
 */
export function newer(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = a ? Date.parse(a) : NaN
  const tb = b ? Date.parse(b) : NaN
  if (Number.isNaN(ta)) return false
  if (Number.isNaN(tb)) return true
  return ta > tb
}

/**
 * Two people scored the same work order and month offline: two rows, two
 * uuids. Keep one, the same one on every phone (newer wins, then the lower
 * uuid), and queue the other's removal. Returns true when the pulled row is
 * the keeper and may be stored.
 */
export function monthTwinKeepsPulled(pulled: { uuid: string; updatedAt: string }, local: { uuid: string; updatedAt: string }): boolean {
  if (newer(pulled.updatedAt, local.updatedAt)) return true
  if (newer(local.updatedAt, pulled.updatedAt)) return false
  return pulled.uuid < local.uuid
}
