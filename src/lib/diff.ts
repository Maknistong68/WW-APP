import type { ActivityChange } from '../types'

/** Fields never shown in the activity log. */
const IGNORED = new Set(['uuid', 'updatedAt'])

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Field-level changes between two versions of a record (old may be missing). */
export function diffRecords(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): ActivityChange[] {
  const changes: ActivityChange[] = []
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)])
  for (const field of keys) {
    if (IGNORED.has(field)) continue
    const from = before?.[field]
    const to = after[field]
    if (same(from, to)) continue
    // A brand-new record only logs the fields that carry a value.
    if (!before && (to === '' || to === null || to === undefined || (Array.isArray(to) && to.length === 0))) continue
    changes.push({ field, from: from ?? null, to: to ?? null })
  }
  return changes
}
