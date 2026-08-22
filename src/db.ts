import Dexie, { type Table } from 'dexie'
import type { Inspection, LogEntry, Photo, Tombstone } from './types'

export const newUuid = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

class WWDatabase extends Dexie {
  inspections!: Table<Inspection, number>
  photos!: Table<Photo, number>
  logs!: Table<LogEntry, number>
  tombstones!: Table<Tombstone, number>

  constructor() {
    super('ww-app')
    this.version(1).stores({
      inspections: '++id, templateId, status, createdAt',
      photos: '++id, inspectionId, itemId, [inspectionId+itemId]',
    })
    this.version(2)
      .stores({
        inspections: '++id, uuid, templateId, status, createdAt',
        photos: '++id, uuid, inspectionId, itemId, [inspectionId+itemId]',
        logs: '++id, inspectionId, time',
        tombstones: '++id, uuid',
      })
      .upgrade(async (tx) => {
        await tx.table('inspections').toCollection().modify((ins: Inspection) => {
          if (!ins.uuid) ins.uuid = newUuid()
        })
        await tx.table('photos').toCollection().modify((p: Photo) => {
          if (!p.uuid) p.uuid = newUuid()
          if (!p.updatedAt) p.updatedAt = p.createdAt
        })
      })
  }
}

export const db = new WWDatabase()

/** Append an entry to the activity log (fire-and-forget). */
export function logEvent(inspectionId: number | null, event: string, detail = ''): void {
  void db.logs
    .add({ inspectionId, time: new Date().toISOString(), event, detail })
    .catch(() => {})
}

/**
 * Ask the browser to protect IndexedDB from eviction under storage pressure.
 * Safe to call repeatedly; returns whether storage is now persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Backup / restore: one self-contained JSON file with photos base64-embedded,
// so an inspector can save it to Drive/email and re-import on another phone.
// ---------------------------------------------------------------------------

interface BackupPhoto extends Omit<Photo, 'blob'> {
  mime: string
  data: string // base64
}
interface BackupFile {
  app: 'ww-app'
  version: 1
  exportedAt: string
  inspections: Inspection[]
  photos: BackupPhoto[]
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',', 2)[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

const base64ToBlob = (data: string, mime: string): Blob => {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function createBackup(): Promise<{ blob: Blob; fileName: string }> {
  const inspections = await db.inspections.toArray()
  const photos = await db.photos.toArray()
  const backupPhotos: BackupPhoto[] = []
  for (const p of photos) {
    const { blob, ...rest } = p
    backupPhotos.push({ ...rest, mime: blob.type || 'image/jpeg', data: await blobToBase64(blob) })
  }
  const payload: BackupFile = {
    app: 'ww-app',
    version: 1,
    exportedAt: new Date().toISOString(),
    inspections,
    photos: backupPhotos,
  }
  const date = new Date().toISOString().slice(0, 10)
  logEvent(null, 'Backup saved', `${inspections.length} inspections, ${photos.length} photos`)
  return {
    blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }),
    fileName: `WW-App-Backup_${date}.json`,
  }
}

/**
 * Imports a backup file. Inspections/photos whose uuid already exists locally
 * are skipped, so restoring twice never duplicates data.
 */
export async function restoreBackup(file: Blob): Promise<{ inspections: number; photos: number }> {
  const parsed = JSON.parse(await file.text()) as BackupFile
  if (parsed.app !== 'ww-app' || !Array.isArray(parsed.inspections) || !Array.isArray(parsed.photos)) {
    throw new Error('Not a WW App backup file')
  }
  let inspections = 0
  let photos = 0
  await db.transaction('rw', db.inspections, db.photos, async () => {
    const existingIns = new Set(
      (await db.inspections.toArray()).map((i) => i.uuid).filter(Boolean) as string[],
    )
    const existingPhotos = new Set(
      (await db.photos.toArray()).map((p) => p.uuid).filter(Boolean) as string[],
    )
    for (const ins of parsed.inspections) {
      const { id: oldId, ...rest } = ins
      const uuid = rest.uuid ?? newUuid()
      let localId: number
      if (rest.uuid && existingIns.has(rest.uuid)) {
        const existing = await db.inspections.where('uuid').equals(rest.uuid).first()
        localId = existing!.id!
      } else {
        localId = await db.inspections.add({ ...rest, uuid } as Inspection)
        inspections++
      }
      for (const p of parsed.photos.filter((x) => x.inspectionId === oldId)) {
        if (p.uuid && existingPhotos.has(p.uuid)) continue
        const { id: _photoId, mime, data, ...photoRest } = p
        void _photoId
        await db.photos.add({
          ...photoRest,
          uuid: photoRest.uuid ?? newUuid(),
          updatedAt: photoRest.updatedAt ?? photoRest.createdAt,
          inspectionId: localId,
          blob: base64ToBlob(data, mime),
        })
        photos++
      }
    }
  })
  logEvent(null, 'Backup restored', `${inspections} inspections, ${photos} photos added`)
  return { inspections, photos }
}

export async function deleteInspection(id: number): Promise<void> {
  await db.transaction('rw', db.inspections, db.photos, db.tombstones, async () => {
    const ins = await db.inspections.get(id)
    if (ins?.uuid) await db.tombstones.add({ table: 'inspections', uuid: ins.uuid })
    const photoList = await db.photos.where('inspectionId').equals(id).toArray()
    for (const p of photoList) {
      if (p.uuid) await db.tombstones.add({ table: 'photos', uuid: p.uuid })
    }
    await db.photos.where('inspectionId').equals(id).delete()
    await db.inspections.delete(id)
  })
  logEvent(null, 'Inspection deleted')
}

/** Starts a new inspection copying another one's general info (repeat visit). */
export async function duplicateInspection(id: number): Promise<number | null> {
  const src = await db.inspections.get(id)
  if (!src) return null
  const now = new Date().toISOString()
  const newId = await db.inspections.add({
    templateId: src.templateId,
    uuid: newUuid(),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    info: { ...src.info, reviewDate: now.slice(0, 10) },
    responses: {},
    notes: '',
  })
  logEvent(newId, 'Inspection created', `Repeat visit copied from ${src.info.contractorNames || 'inspection'}`)
  return newId
}

/** Resize/compress a captured photo so storage and exports stay manageable. */
export async function compressPhoto(file: File | Blob, maxDim = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    )
    return blob ?? file
  } catch {
    // e.g. unsupported format — store the original rather than losing it
    return file
  }
}
