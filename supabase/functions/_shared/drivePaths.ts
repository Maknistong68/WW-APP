// Where a photo goes in the team's Google Drive folder, and its file name.
// Pure (no imports), shared by the Edge Functions and tested by vitest.
//
//   WW Co-pilot photos /
//     RPCO – WO 882 /
//       2026-11-12 Worker Welfare audit /
//         F5 2026-11-12 14.32 3f9a.jpg

export const ROOT_FOLDER = 'WW Co-pilot photos'

export interface DriveInspection {
  templateId: string
  info?: { contractorNames?: string; workOrder?: string; reviewDate?: string; facilityLocation?: string }
}

export interface DrivePhoto {
  uuid: string
  /** A question code, '@facility' for general photos, or null when not placed yet. */
  itemId: string | null
  createdAt: string
}

/** Drive won't take some characters in names; keep names short and tidy. */
export const cleanName = (s: string) =>
  s
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)

/** The two folders under the root: who, then which visit. */
export function photoFolders(ins: DriveInspection): [string, string] {
  const info = ins.info ?? {}
  const audit = ins.templateId === 'welfare_audit'
  const who = cleanName(info.contractorNames || '') || 'No contractor'
  const top = audit && info.workOrder ? `${who} – WO ${cleanName(info.workOrder)}` : who
  const date = info.reviewDate || 'Undated'
  const visit = audit ? `${date} Worker Welfare audit` : `${date} Camp inspection${info.facilityLocation ? ` – ${info.facilityLocation}` : ''}`
  return [cleanName(top), cleanName(visit)]
}

/** "F5 2026-11-12 14.32 3f9a.jpg": what it shows, when (Saudi time), and a short id so names never clash. */
export function photoFileName(p: DrivePhoto): string {
  const at = new Date(new Date(p.createdAt).getTime() + 3 * 3600 * 1000).toISOString()
  const what = p.itemId === '@facility' ? 'General' : p.itemId ? cleanName(p.itemId) : 'Unplaced'
  return `${what} ${at.slice(0, 10)} ${at.slice(11, 13)}.${at.slice(14, 16)} ${p.uuid.replace(/-/g, '').slice(0, 4)}.jpg`
}
