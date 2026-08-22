import { db } from '../db'
import { FACILITY_PHOTOS, type Inspection, type InspectionTemplate, type Photo } from '../types'

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

export const questionPhotos = (photos: Photo[]): Photo[] =>
  photos.filter((p) => p.itemId !== null && p.itemId !== FACILITY_PHOTOS)

export const facilityPhotos = (photos: Photo[]): Photo[] =>
  photos.filter((p) => p.itemId === FACILITY_PHOTOS)

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function parseDate(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d.getTime()) ? new Date() : d
}

export function monthYear(iso: string): string {
  const d = parseDate(iso)
  return `${MONTHS[d.getMonth()]}_${d.getFullYear()}`
}

export function longDate(iso: string): string {
  const d = parseDate(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

const safe = (s: string) => s.trim().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'Camp'

export function excelFileName(inspection: Inspection): string {
  return `${safe(inspection.info.contractorNames || inspection.info.facilityManagement)}_Workers_Camp_Welfare_Inspection_Report_${monthYear(inspection.info.reviewDate)}.xlsx`
}

export function wordFileName(inspection: Inspection): string {
  return `${safe(inspection.info.contractorNames || inspection.info.facilityManagement)}_Workers_Camp_NonCompliance.docx`
}

export function findQuestion(template: InspectionTemplate, code: string) {
  for (const section of template.sections) {
    const q = section.questions.find((x) => x.code === code)
    if (q) return { section, question: q }
  }
  return null
}
