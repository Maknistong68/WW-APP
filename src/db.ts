import Dexie, { type Table } from 'dexie'
import type {
  ActivityEntry,
  Contractor,
  Inspection,
  KpiMonth,
  LogEntry,
  Manpower,
  Photo,
  Ticket,
  Tombstone,
  WeeklyCount,
  WorkOrder,
  Camp,
} from './types'
import { NORMALIZE } from './lib/normalize'

export const newUuid = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Fallback must still be a valid v4 UUID: these ids go into Postgres `uuid`
  // columns during cloud sync, so a non-UUID shape would make the record
  // permanently unsyncable.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

class WWDatabase extends Dexie {
  inspections!: Table<Inspection, number>
  photos!: Table<Photo, number>
  logs!: Table<LogEntry, number>
  tombstones!: Table<Tombstone, number>
  contractors!: Table<Contractor, string>
  workOrders!: Table<WorkOrder, string>
  camps!: Table<Camp, string>
  tickets!: Table<Ticket, string>
  kpiMonths!: Table<KpiMonth, string>
  manpower!: Table<Manpower, string>
  weeklyCounts!: Table<WeeklyCount, string>
  activity!: Table<ActivityEntry, string>

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
    // v3 added the co-pilot tables; v4 adds work orders, per-work-order KPI
    // keys and the current ticket shape (no upgrader needed for v3 itself).
    this.version(4)
      .stores({
        contractors: 'uuid, name',
        workOrders: 'uuid, contractorUuid',
        tickets: 'uuid, status, contractorUuid, workOrderUuid, openedAt, ticketNo',
        kpiMonths: 'uuid, &[contractorUuid+workOrderUuid+month], month',
        manpower: 'uuid, &[contractorUuid+workOrderUuid+month], month',
        weeklyCounts: 'uuid, weekEnding',
        activity: 'uuid, time, entity, entityUuid',
      })
      .upgrade(async (tx) => {
        for (const name of Object.keys(NORMALIZE)) {
          const table = tx.table(name)
          const rows = (await table.toArray()) as Record<string, unknown>[]
          await table.bulkPut(rows.map((r) => NORMALIZE[name](r)))
        }
      })
    this.version(5).stores({ camps: 'uuid, contractorUuid' })
  }
}

export const db = new WWDatabase()

/** Audit milestones that also go into the co-pilot activity log. */
const AUDIT_ACTIVITY: Record<string, ActivityEntry['action']> = {
  'Inspection created': 'add',
  'Details edited': 'edit',
  'Inspection completed': 'close',
  'Inspection reopened': 'reopen',
}

/** Append an entry to the technical log (fire-and-forget). */
export function logEvent(inspectionId: number | null, event: string, detail = ''): void {
  const time = new Date().toISOString()
  void db.logs.add({ inspectionId, time, event, detail }).catch(() => {})
  const action = AUDIT_ACTIVITY[event]
  if (inspectionId === null || !action) return
  void db.inspections
    .get(inspectionId)
    .then((ins) =>
      db.activity.add({
        uuid: newUuid(),
        time,
        entity: 'audit',
        entityUuid: ins?.uuid ?? String(inspectionId),
        action,
        label: `Audit · ${ins?.info?.contractorNames || ins?.info?.facilityLocation || 'inspection'}`,
        changes: [],
      }),
    )
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
  /** 1 = inspections + photos only; 2 adds the co-pilot records. */
  version: 1 | 2
  exportedAt: string
  inspections: Inspection[]
  photos: BackupPhoto[]
  contractors?: Contractor[]
  workOrders?: WorkOrder[]
  camps?: Camp[]
  tickets?: Ticket[]
  kpiMonths?: KpiMonth[]
  manpower?: Manpower[]
  weeklyCounts?: WeeklyCount[]
  activity?: ActivityEntry[]
}

const RECORD_KEYS = ['contractors', 'workOrders', 'camps', 'tickets', 'kpiMonths', 'manpower', 'weeklyCounts', 'activity'] as const

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
    version: 2,
    exportedAt: new Date().toISOString(),
    inspections,
    photos: backupPhotos,
    contractors: await db.contractors.toArray(),
    workOrders: await db.workOrders.toArray(),
    camps: await db.camps.toArray(),
    tickets: await db.tickets.toArray(),
    kpiMonths: await db.kpiMonths.toArray(),
    manpower: await db.manpower.toArray(),
    weeklyCounts: await db.weeklyCounts.toArray(),
    activity: await db.activity.toArray(),
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
export async function restoreBackup(
  file: Blob,
): Promise<{ inspections: number; photos: number; records: number }> {
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
  // Co-pilot records: keep whichever copy is newer, never duplicate.
  let records = 0
  for (const key of RECORD_KEYS) {
    const rows = (parsed[key] ?? []) as { uuid: string; updatedAt?: string; time?: string }[]
    if (rows.length === 0) continue
    const table = db.table(key)
    await db.transaction('rw', table, async () => {
      for (const row of rows) {
        const existing = (await table.get(row.uuid)) as { updatedAt?: string } | undefined
        if (existing && (key === 'activity' || (existing.updatedAt ?? '') >= (row.updatedAt ?? ''))) continue
        await table.put(NORMALIZE[key] ? NORMALIZE[key](row as Record<string, unknown>) : row)
        records++
      }
    })
  }
  logEvent(null, 'Backup restored', `${inspections} inspections, ${photos} photos, ${records} records added`)
  return { inspections, photos, records }
}

export async function deleteInspection(id: number): Promise<void> {
  await db.transaction('rw', db.inspections, db.photos, db.tombstones, db.activity, async () => {
    const ins = await db.inspections.get(id)
    if (ins?.uuid) await db.tombstones.add({ table: 'inspections', uuid: ins.uuid })
    await db.activity.add({
      uuid: newUuid(),
      time: new Date().toISOString(),
      entity: 'audit',
      entityUuid: ins?.uuid ?? String(id),
      action: 'delete',
      label: `Audit · ${ins?.info?.contractorNames || ins?.info?.facilityLocation || 'inspection'}`,
      changes: [],
    })
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
