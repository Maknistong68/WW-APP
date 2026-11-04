// ---------------------------------------------------------------------------
// A work order's subcontractors: company names only (never workers). Kept on
// the work order (Library › contractor › work order); WPS asks whether all of
// them are included, and tickets suggest names to add.
// ---------------------------------------------------------------------------

const tidy = (s: string) => s.trim().replace(/\s+/g, ' ')
const same = (a: string, b: string) => tidy(a).toLowerCase() === tidy(b).toLowerCase()

/** The list with one more name (trimmed); a name already there, in any capitals, is not added again. */
export function addSubcon(list: string[] | undefined, name: string): string[] {
  const cur = list ?? []
  const n = tidy(name)
  if (!n || cur.some((x) => same(x, n))) return cur
  return [...cur, n]
}

export const removeSubcon = (list: string[] | undefined, name: string): string[] => (list ?? []).filter((x) => x !== name)

/** Names typed on this work order's tickets and cases that are not on its list yet, most used first. */
export function ticketSubcons(workOrderUuid: string, tickets: { workOrderUuid: string; subcontractor: string }[], listed: string[] = []): string[] {
  const seen = new Map<string, { name: string; n: number }>()
  for (const t of tickets) {
    const name = tidy(t.subcontractor ?? '')
    if (t.workOrderUuid !== workOrderUuid || !name || listed.some((x) => same(x, name))) continue
    const key = name.toLowerCase()
    const hit = seen.get(key)
    if (hit) hit.n++
    else seen.set(key, { name, n: 1 })
  }
  return [...seen.values()].sort((a, b) => b.n - a.n).map((x) => x.name)
}
