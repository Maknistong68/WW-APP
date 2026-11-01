import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { saveRecord } from './records'
import { backgroundSync } from './sync'
import { LAYOUT_VERSION, SITES, samePlace, type Layout, type SiteDef } from './site'
import { diffItems, itemActivity, type MapItem } from './mapItems'
import type { MapItemRecord, SitePlace } from '../types'

// The "Live site" map is shared by the whole team: one row per site (the
// site's fixed uuid) plus one row per road / highway / palm group / camp /
// village. Only Admins write it (RLS private.is_admin()); every change goes
// into the activity log.

/** Saved site placements (undefined while loading). */
export function useSitePlaces(): SitePlace[] | undefined {
  return useLiveQuery(() => db.sitePlaces.toArray())
}

/** Saved map items, removed ones included (undefined while loading). */
export function useMapItemRows(): MapItemRecord[] | undefined {
  return useLiveQuery(() => db.mapItems.toArray())
}

const toRow = (i: MapItem, removed = false): MapItemRecord => ({
  uuid: i.uuid,
  updatedAt: '',
  kind: i.kind,
  ...(i.points ? { points: i.points } : {}),
  ...(i.x !== undefined ? { x: i.x, z: i.z, rot: i.rot ?? 0 } : {}),
  removed,
})

/**
 * Save what moved / changed, then sync so the team sees it straight away.
 * Returns how many sites and items changed.
 */
export async function commitLayout(
  base: Layout,
  draft: Layout,
  labelOf: (def: SiteDef) => string,
  baseItems: MapItem[] = [],
  draftItems: MapItem[] = baseItems,
): Promise<number> {
  let changed = 0
  for (const def of SITES) {
    const from = base[def.id]
    const to = draft[def.id]
    if (!to || (from && samePlace(from, to))) continue
    const row: SitePlace = { uuid: def.uuid, updatedAt: '', siteId: def.id, gx: to.gx, gz: to.gz, rot: to.rot, v: LAYOUT_VERSION }
    await saveRecord('sitePlaces', row, `Site layout · ${labelOf(def)}${samePlace(to, def.home) ? ' · back to default' : ''}`)
    changed++
  }
  const d = diffItems(baseItems, draftItems)
  const before = new Map(baseItems.map((i) => [i.uuid, i]))
  for (const i of d.added) {
    await saveRecord('mapItems', toRow(i), itemActivity(i, 'added'))
    changed++
  }
  for (const i of d.changed) {
    await saveRecord('mapItems', toRow(i), itemActivity(i, 'changed', before.get(i.uuid)))
    changed++
  }
  for (const i of d.removed) {
    await saveRecord('mapItems', toRow(i, true), itemActivity(i, 'removed'))
    changed++
  }
  if (changed) backgroundSync()
  return changed
}
