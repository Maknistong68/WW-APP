import Dexie, { type Table } from 'dexie'
import type { Inspection, Photo } from './types'

class WWDatabase extends Dexie {
  inspections!: Table<Inspection, number>
  photos!: Table<Photo, number>

  constructor() {
    super('ww-app')
    this.version(1).stores({
      inspections: '++id, templateId, status, createdAt',
      photos: '++id, inspectionId, itemId, [inspectionId+itemId]',
    })
  }
}

export const db = new WWDatabase()

export async function deleteInspection(id: number): Promise<void> {
  await db.transaction('rw', db.inspections, db.photos, async () => {
    await db.photos.where('inspectionId').equals(id).delete()
    await db.inspections.delete(id)
  })
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
