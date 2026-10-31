import type { ActivityEntity, ActivityEntry } from '../types'

export type ActionFilter = 'all' | ActivityEntry['action']
export const ACTIONS: { key: ActionFilter; label: string }[] = [
  { key: 'all', label: 'Any action' },
  { key: 'add', label: 'Added' },
  { key: 'edit', label: 'Edited' },
  { key: 'close', label: 'Closed' },
  { key: 'reopen', label: 'Reopened' },
  { key: 'delete', label: 'Deleted' },
  { key: 'import', label: 'Imported' },
]

export type Period = 'all' | '1' | '7' | '30'
export const PERIODS: { key: Period; label: string }[] = [
  { key: '1', label: 'Today' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: 'all', label: 'All time' },
]

/** Pure filter so it can be unit-tested. */
export function filterActivity(
  entries: ActivityEntry[],
  f: { entity: 'all' | ActivityEntity; action: ActionFilter; period: Period; query: string },
  now = Date.now(),
): ActivityEntry[] {
  const q = f.query.trim().toLowerCase()
  const since = f.period === 'all' ? 0 : now - Number(f.period) * 86400000
  return entries.filter((e) => {
    const entityOk =
      f.entity === 'all' ||
      e.entity === f.entity ||
      (f.entity === 'kpi' && e.entity === 'manpower') ||
      (f.entity === 'contractor' && e.entity === 'workOrder')
    if (!entityOk) return false
    if (f.action !== 'all' && e.action !== f.action) return false
    if (since && Date.parse(e.time) < since) return false
    return !q || e.label.toLowerCase().includes(q) || e.changes.some((c) => String(c.to ?? '').toLowerCase().includes(q))
  })
}


