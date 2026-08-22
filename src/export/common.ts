import { db } from '../db'
import type { Inspection, InspectionTemplate, Photo } from '../types'

export interface PhotoWithSize {
  photo: Photo
  buffer: ArrayBuffer
  width: number
  height: number
}

export async function loadPhotos(inspectionId: number): Promise<Photo[]> {
  return db.photos.where('inspectionId').equals(inspectionId).sortBy('createdAt')
}

export async function withSizes(photos: Photo[]): Promise<PhotoWithSize[]> {
  const out: PhotoWithSize[] = []
  for (const photo of photos) {
    const buffer = await photo.blob.arrayBuffer()
    let width = 800
    let height = 600
    try {
      const bmp = await createImageBitmap(photo.blob)
      width = bmp.width
      height = bmp.height
      bmp.close()
    } catch {
      // keep the fallback aspect ratio
    }
    out.push({ photo, buffer, width, height })
  }
  return out
}

export function itemLabel(template: InspectionTemplate, itemId: string): string {
  for (const section of template.sections) {
    const item = section.items.find((i) => i.id === itemId)
    if (item) return `${section.title} — ${item.text}`
  }
  return 'General'
}

export function exportFileName(template: InspectionTemplate, inspection: Inspection, ext: string): string {
  const parts = [
    template.shortName.replace(/\s+/g, '-'),
    inspection.meta.contractor.replace(/[^\w-]+/g, '-'),
    inspection.meta.date,
  ].filter(Boolean)
  return `${parts.join('_')}.${ext}`
}
