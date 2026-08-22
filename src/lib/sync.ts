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
}

let syncing = false

export async function syncNow(): Promise<SyncResult> {
  if (syncing) throw new Error('Sync already running')
  const c = await getClient()
  if (!c) throw new Error('Cloud sync is not set up yet')
  const session = await getSession()
  if (!session) throw new Error('Not signed in')
  if (!navigator.onLine) throw new Error('No internet connection')
  syncing = true
  const userId = session.user.id
  const result: SyncResult = { pushed: 0, pulled: 0, photosUp: 0, photosDown: 0, deleted: 0 }
  try {
    // 1. Push tombstones (deletions made on this device)
    const tombstones = await db.tombstones.toArray()
    for (const t of tombstones) {
      const table = t.table === 'inspections' ? 'inspections' : 'photos'
      const { error } = await c.from(table).update({ deleted: true }).eq('uuid', t.uuid)
      if (error) throw new Error(`Delete sync failed: ${error.message}`)
      if (t.table === 'inspections') {
        await c.from('photos').update({ deleted: true }).eq('inspection_uuid', t.uuid)
      }
      await db.tombstones.delete(t.id!)
    }

    // 2. Inspections
    const { data: remoteIns, error: insErr } = await c
      .from('inspections')
      .select('uuid, updated_at, deleted')
    if (insErr) throw new Error(insErr.message)
    const remoteInsMap = new Map((remoteIns ?? []).map((r) => [r.uuid as string, r]))
    const localIns = await db.inspections.toArray()
    const localInsMap = new Map(localIns.filter((i) => i.uuid).map((i) => [i.uuid!, i]))

    // remote deletions → local
    for (const r of remoteIns ?? []) {
      if (r.deleted && localInsMap.has(r.uuid)) {
        const local = localInsMap.get(r.uuid)!
        await db.photos.where('inspectionId').equals(local.id!).delete()
        await db.inspections.delete(local.id!)
        localInsMap.delete(r.uuid)
        result.deleted++
      }
    }

    // push local-new / local-newer
    for (const ins of localIns) {
      if (!ins.uuid) continue
      const remote = remoteInsMap.get(ins.uuid)
      if (remote?.deleted) continue
      if (!remote || ins.updatedAt > (remote.updated_at as string)) {
        const { id: _localId, ...data } = ins
        void _localId
        const { error } = await c.from('inspections').upsert({
          uuid: ins.uuid,
          user_id: userId,
          data,
          updated_at: ins.updatedAt,
          deleted: false,
        })
        if (error) throw new Error(`Push failed: ${error.message}`)
        result.pushed++
      }
    }

    // pull remote-new / remote-newer
    const toPull = (remoteIns ?? []).filter((r) => {
      if (r.deleted) return false
      const local = localInsMap.get(r.uuid)
      return !local || (r.updated_at as string) > local.updatedAt
    })
    for (const r of toPull) {
      const { data: full, error } = await c
        .from('inspections')
        .select('data')
        .eq('uuid', r.uuid)
        .single()
      if (error) throw new Error(`Pull failed: ${error.message}`)
      const ins = full.data as Inspection
      const local = localInsMap.get(r.uuid)
      if (local) {
        await db.inspections.put({ ...ins, id: local.id, uuid: r.uuid })
      } else {
        const newId = await db.inspections.add({ ...ins, id: undefined, uuid: r.uuid })
        localInsMap.set(r.uuid, { ...ins, id: newId, uuid: r.uuid })
      }
      result.pulled++
    }

    // refreshed map: inspection uuid -> local numeric id
    const insIdByUuid = new Map<string, number>()
    for (const ins of await db.inspections.toArray()) {
      if (ins.uuid) insIdByUuid.set(ins.uuid, ins.id!)
    }
    const insUuidById = new Map<number, string>()
    for (const [u, i] of insIdByUuid) insUuidById.set(i, u)

    // 3. Photos
    const { data: remotePhotos, error: phErr } = await c
      .from('photos')
      .select('uuid, inspection_uuid, item_id, caption, created_at, updated_at, deleted')
    if (phErr) throw new Error(phErr.message)
    const remotePhotoMap = new Map((remotePhotos ?? []).map((r) => [r.uuid as string, r]))
    const localPhotos = await db.photos.toArray()
    const localPhotoMap = new Map(localPhotos.filter((p) => p.uuid).map((p) => [p.uuid!, p]))

    // remote deletions → local
    for (const r of remotePhotos ?? []) {
      if (r.deleted && localPhotoMap.has(r.uuid)) {
        await db.photos.delete(localPhotoMap.get(r.uuid)!.id!)
        localPhotoMap.delete(r.uuid)
        result.deleted++
      }
    }

    const storage = c.storage.from('photos')
    const photoPath = (uuid: string) => `${userId}/${uuid}.jpg`

    // push photos: new blobs + newer metadata
    for (const p of localPhotos) {
      if (!p.uuid) continue
      const insUuid = insUuidById.get(p.inspectionId)
      if (!insUuid) continue
      const remote = remotePhotoMap.get(p.uuid)
      if (remote?.deleted) continue
      const localUpdated = p.updatedAt ?? p.createdAt
      if (!remote) {
        const { error: upErr } = await storage.upload(photoPath(p.uuid), p.blob, {
          upsert: true,
          contentType: p.blob.type || 'image/jpeg',
        })
        if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`)
        const { error } = await c.from('photos').insert({
          uuid: p.uuid,
          user_id: userId,
          inspection_uuid: insUuid,
          item_id: p.itemId,
          caption: p.caption,
          created_at: p.createdAt,
          updated_at: localUpdated,
          deleted: false,
        })
        if (error) throw new Error(`Photo push failed: ${error.message}`)
        await db.photos.update(p.id!, { syncedAt: new Date().toISOString() })
        result.photosUp++
      } else if (localUpdated > (remote.updated_at as string)) {
        const { error } = await c
          .from('photos')
          .update({ item_id: p.itemId, caption: p.caption, updated_at: localUpdated })
          .eq('uuid', p.uuid)
        if (error) throw new Error(`Photo update failed: ${error.message}`)
        result.photosUp++
      }
    }

    // pull photos: missing locally + newer metadata
    for (const r of remotePhotos ?? []) {
      if (r.deleted) continue
      const localId = insIdByUuid.get(r.inspection_uuid as string)
      if (localId === undefined) continue
      const local = localPhotoMap.get(r.uuid)
      if (!local) {
        const { data: blobData, error } = await storage.download(photoPath(r.uuid))
        if (error) throw new Error(`Photo download failed: ${error.message}`)
        await db.photos.add({
          uuid: r.uuid,
          inspectionId: localId,
          itemId: (r.item_id as string | null) ?? null,
          caption: (r.caption as string) ?? '',
          createdAt: r.created_at as string,
          updatedAt: r.updated_at as string,
          syncedAt: new Date().toISOString(),
          blob: blobData,
        })
        result.photosDown++
      } else if ((r.updated_at as string) > (local.updatedAt ?? local.createdAt)) {
        await db.photos.update(local.id!, {
          itemId: (r.item_id as string | null) ?? null,
          caption: (r.caption as string) ?? '',
          updatedAt: r.updated_at as string,
        })
        result.photosDown++
      }
    }

    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    logEvent(
      null,
      'Cloud sync completed',
      `up ${result.pushed + result.photosUp}, down ${result.pulled + result.photosDown}, deleted ${result.deleted}`,
    )
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
  void getSession().then((session) => {
    if (!session) return
    syncNow()
      .then((r) => onDone?.(r))
      .catch(() => {})
  })
}

export { newUuid }
export type { Photo }
