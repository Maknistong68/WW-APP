import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { db, logEvent, newUuid } from '../db'
import type { Inspection, Photo } from '../types'

// ---------------------------------------------------------------------------
// Supabase cloud sync (optional). The app stays fully offline-first: IndexedDB
// is the working store, and sync pushes/pulls whole records with
// last-write-wins by updatedAt. Schema: supabase/schema.sql in the repo.
// ---------------------------------------------------------------------------

export interface SyncConfig {
  url: string
  anonKey: string
}

const CONFIG_KEY = 'ww.supabase'
const LAST_SYNC_KEY = 'ww.lastSync'

export function getSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw) as SyncConfig
    return cfg.url && cfg.anonKey ? cfg : null
  } catch {
    return null
  }
}

export function setSyncConfig(cfg: SyncConfig | null): void {
  if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  else localStorage.removeItem(CONFIG_KEY)
  client = null
}

export function lastSyncAt(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY)
}

let client: SupabaseClient | null = null

/** The Supabase SDK is heavy, so it loads only when sync is actually used. */
export async function getClient(): Promise<SupabaseClient | null> {
  if (client) return client
  const cfg = getSyncConfig()
  if (!cfg) return null
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(cfg.url, cfg.anonKey)
  return client
}

export async function getSession(): Promise<Session | null> {
  const c = await getClient()
  if (!c) return null
  const { data } = await c.auth.getSession()
  return data.session
}

export interface SyncResult {
  pushed: number
  pulled: number
  photosUp: number
  photosDown: number
  deleted: number
  failed: number
}

interface RemoteInspectionRow {
  uuid: string
  updated_at: string
  deleted: boolean
}

interface RemotePhotoRow extends RemoteInspectionRow {
  inspection_uuid: string
  item_id: string | null
  caption: string
  created_at: string
}

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

/** Fetch all rows of a table, paging past PostgREST's 1000-row response cap. */
async function selectAll<T>(c: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const PAGE = 1000
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await c.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as unknown as T[]))
    if (!data || data.length < PAGE) return rows
  }
}

let syncing = false

export async function syncNow(): Promise<SyncResult> {
  if (syncing) throw new Error('Sync already running')
  // Claim the lock before the first await: app-open background sync and a
  // manual "Sync now" could otherwise both pass the check and interleave.
  syncing = true
  const result: SyncResult = { pushed: 0, pulled: 0, photosUp: 0, photosDown: 0, deleted: 0, failed: 0 }
  // One bad record must not abort the whole sync (and with it every future
  // sync): per-record errors are collected and reported at the end instead.
  const failures: string[] = []
  const fail = (what: string, err: unknown) => {
    result.failed++
    failures.push(`${what}: ${err instanceof Error ? err.message : String(err)}`)
  }
  try {
    const c = await getClient()
    if (!c) throw new Error('Cloud sync is not set up yet')
    const session = await getSession()
    if (!session) throw new Error('Not signed in')
    if (!navigator.onLine) throw new Error('No internet connection')
    const userId = session.user.id
    // 1. Push tombstones (deletions made on this device). Stamping updated_at
    // gives the deletion a real timestamp, so a copy edited *after* the
    // deletion counts as newer and is resurrected by the push loops below.
    const tombstones = await db.tombstones.toArray()
    for (const t of tombstones) {
      try {
        const table = t.table === 'inspections' ? 'inspections' : 'photos'
        const deletedAt = new Date().toISOString()
        const { error } = await c
          .from(table)
          .update({ deleted: true, updated_at: deletedAt })
          .eq('uuid', t.uuid)
        if (error) throw new Error(error.message)
        if (t.table === 'inspections') {
          await c
            .from('photos')
            .update({ deleted: true, updated_at: deletedAt })
            .eq('inspection_uuid', t.uuid)
        }
        await db.tombstones.delete(t.id!)
      } catch (err) {
        fail('Delete sync', err)
      }
    }

    // 2. Inspections
    const remoteIns = await selectAll<RemoteInspectionRow>(
      c,
      'inspections',
      'uuid, updated_at, deleted',
    )
    const remoteInsMap = new Map(remoteIns.map((r) => [r.uuid, r]))
    const localIns = await db.inspections.toArray()
    const localInsMap = new Map(localIns.filter((i) => i.uuid).map((i) => [i.uuid!, i]))

    // remote deletions → local, unless the local copy was edited after the
    // deletion — the push loop below resurrects those instead
    for (const r of remoteIns) {
      if (!r.deleted || !localInsMap.has(r.uuid)) continue
      const local = localInsMap.get(r.uuid)!
      if (newer(local.updatedAt, r.updated_at)) continue
      await db.photos.where('inspectionId').equals(local.id!).delete()
      await db.inspections.delete(local.id!)
      localInsMap.delete(r.uuid)
      result.deleted++
    }

    // push local-new / local-newer (the upsert's deleted: false also
    // resurrects a remotely-deleted record when the local copy is newer)
    for (const ins of localIns) {
      if (!ins.uuid || !localInsMap.has(ins.uuid)) continue
      const remote = remoteInsMap.get(ins.uuid)
      if (remote && !newer(ins.updatedAt, remote.updated_at)) continue
      try {
        const { id: _localId, ...data } = ins
        void _localId
        const { error } = await c.from('inspections').upsert({
          uuid: ins.uuid,
          user_id: userId,
          data,
          updated_at: ins.updatedAt,
          deleted: false,
        })
        if (error) throw new Error(error.message)
        result.pushed++
      } catch (err) {
        fail(`Push inspection ${ins.uuid}`, err)
      }
    }

    // pull remote-new / remote-newer
    const toPull = remoteIns.filter((r) => {
      if (r.deleted) return false
      const local = localInsMap.get(r.uuid)
      return !local || newer(r.updated_at, local.updatedAt)
    })
    for (const r of toPull) {
      try {
        const { data: full, error } = await c
          .from('inspections')
          .select('data')
          .eq('uuid', r.uuid)
          .single()
        if (error) throw new Error(error.message)
        const ins = full.data as Inspection
        const local = localInsMap.get(r.uuid)
        if (local) {
          await db.inspections.put({ ...ins, id: local.id, uuid: r.uuid })
        } else {
          const newId = await db.inspections.add({ ...ins, id: undefined, uuid: r.uuid })
          localInsMap.set(r.uuid, { ...ins, id: newId, uuid: r.uuid })
        }
        result.pulled++
      } catch (err) {
        fail(`Pull inspection ${r.uuid}`, err)
      }
    }

    // refreshed map: inspection uuid -> local numeric id
    const insIdByUuid = new Map<string, number>()
    for (const ins of await db.inspections.toArray()) {
      if (ins.uuid) insIdByUuid.set(ins.uuid, ins.id!)
    }
    const insUuidById = new Map<number, string>()
    for (const [u, i] of insIdByUuid) insUuidById.set(i, u)

    // 3. Photos
    const remotePhotos = await selectAll<RemotePhotoRow>(
      c,
      'photos',
      'uuid, inspection_uuid, item_id, caption, created_at, updated_at, deleted',
    )
    const remotePhotoMap = new Map(remotePhotos.map((r) => [r.uuid, r]))
    const localPhotos = await db.photos.toArray()
    const localPhotoMap = new Map(localPhotos.filter((p) => p.uuid).map((p) => [p.uuid!, p]))

    // remote deletions → local (same newer-wins rule as inspections)
    for (const r of remotePhotos) {
      if (!r.deleted) continue
      const local = localPhotoMap.get(r.uuid)
      if (!local) continue
      if (newer(local.updatedAt ?? local.createdAt, r.updated_at)) continue
      await db.photos.delete(local.id!)
      localPhotoMap.delete(r.uuid)
      result.deleted++
    }

    const storage = c.storage.from('photos')
    const photoPath = (uuid: string) => `${userId}/${uuid}.jpg`

    // push photos: new blobs + newer metadata
    for (const p of localPhotos) {
      if (!p.uuid || !localPhotoMap.has(p.uuid)) continue
      const insUuid = insUuidById.get(p.inspectionId)
      if (!insUuid) continue
      const remote = remotePhotoMap.get(p.uuid)
      const localUpdated = p.updatedAt ?? p.createdAt
      try {
        if (!remote) {
          const { error: upErr } = await storage.upload(photoPath(p.uuid), p.blob, {
            upsert: true,
            contentType: p.blob.type || 'image/jpeg',
          })
          if (upErr) throw new Error(upErr.message)
          // upsert (not insert) so a retry after a partial earlier run succeeds
          const { error } = await c.from('photos').upsert({
            uuid: p.uuid,
            user_id: userId,
            inspection_uuid: insUuid,
            item_id: p.itemId,
            caption: p.caption,
            created_at: p.createdAt,
            updated_at: localUpdated,
            deleted: false,
          })
          if (error) throw new Error(error.message)
          await db.photos.update(p.id!, { syncedAt: new Date().toISOString() })
          result.photosUp++
        } else if (newer(localUpdated, remote.updated_at)) {
          // deleted: false resurrects a remotely-deleted photo when the local
          // copy is newer; its storage object is still in the bucket
          const { error } = await c
            .from('photos')
            .update({
              item_id: p.itemId,
              caption: p.caption,
              updated_at: localUpdated,
              deleted: false,
            })
            .eq('uuid', p.uuid)
          if (error) throw new Error(error.message)
          result.photosUp++
        }
      } catch (err) {
        fail(`Push photo ${p.uuid}`, err)
      }
    }

    // pull photos: missing locally + newer metadata
    for (const r of remotePhotos) {
      if (r.deleted) continue
      const localId = insIdByUuid.get(r.inspection_uuid)
      if (localId === undefined) continue
      const local = localPhotoMap.get(r.uuid)
      try {
        if (!local) {
          const { data: blobData, error } = await storage.download(photoPath(r.uuid))
          if (error) throw new Error(error.message)
          await db.photos.add({
            uuid: r.uuid,
            inspectionId: localId,
            itemId: r.item_id ?? null,
            caption: r.caption ?? '',
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            syncedAt: new Date().toISOString(),
            blob: blobData,
          })
          result.photosDown++
        } else if (newer(r.updated_at, local.updatedAt ?? local.createdAt)) {
          await db.photos.update(local.id!, {
            itemId: r.item_id ?? null,
            caption: r.caption ?? '',
            updatedAt: r.updated_at,
          })
          result.photosDown++
        }
      } catch (err) {
        fail(`Pull photo ${r.uuid}`, err)
      }
    }

    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    const summary = `up ${result.pushed + result.photosUp}, down ${result.pulled + result.photosDown}, deleted ${result.deleted}`
    if (result.failed > 0) {
      logEvent(
        null,
        'Cloud sync completed with errors',
        `${summary}; ${result.failed} failed — ${failures.slice(0, 3).join('; ')}`,
      )
    } else {
      logEvent(null, 'Cloud sync completed', summary)
    }
    return result
  } catch (err) {
    logEvent(null, 'Cloud sync failed', err instanceof Error ? err.message : String(err))
    throw err
  } finally {
    syncing = false
  }
}

/** Fire-and-forget background sync; never throws. */
export function backgroundSync(onDone?: (r: SyncResult) => void): void {
  if (!getSyncConfig() || !navigator.onLine) return
  void getSession()
    .then((session) => {
      if (!session) return
      return syncNow().then((r) => onDone?.(r))
    })
    .catch(() => {})
}

export { newUuid }
export type { Photo }
