import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { saveRecord } from './records'
import { backgroundSync } from './sync'
import { SITES, samePlace, type Layout, type SiteDef } from './site'
import type { SitePlace } from '../types'

// The "Live site" layout is shared by the whole team: one row per site (the
// site's fixed uuid), synced like every other record. Only Admins and Editors
// write it (RLS private.can_edit()); every move goes into the activity log.

/** Saved placements (undefined while loading). */
export function useSitePlaces(): SitePlace[] | undefined {
  return useLiveQuery(() => db.sitePlaces.toArray())
}

/** Save the sites that moved, then sync so the team sees it straight away. Returns how many changed. */
export async function commitLayout(base: Layout, draft: Layout, labelOf: (def: SiteDef) => string): Promise<number> {
  let changed = 0
  for (const def of SITES) {
    const from = base[def.id]
    const to = draft[def.id]
    if (!to || (from && samePlace(from, to))) continue
    const row: SitePlace = { uuid: def.uuid, updatedAt: '', siteId: def.id, gx: to.gx, gz: to.gz, rot: to.rot }
    await saveRecord('sitePlaces', row, `Site layout · ${labelOf(def)}${samePlace(to, def.home) ? ' · back to default' : ''}`)
    changed++
  }
  if (changed) backgroundSync()
  return changed
}
