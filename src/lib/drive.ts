import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Every photo taken in the app is copied to the team's Google Drive folder.
// The admin connects one Google account once (Settings › Google Drive, Edge
// Function drive-connect); after each sync a phone asks drive-photo to copy
// the photos its person took that aren't on Drive yet. Folder and file names:
// supabase/functions/_shared/drivePaths.ts.
// ---------------------------------------------------------------------------

/** What drive-connect says (status). */
export interface DriveStatus {
  /** The Google sign-in keys are set on the server. */
  ready: boolean
  connected: boolean
  email?: string
  folderUrl?: string
  /** Photos in the cloud not copied to Drive yet. */
  waiting: number
  /** Google refused the saved sign-in (e.g. access removed): connect again. */
  problem?: string
}

/** What drive-photo says after copying. */
export interface DriveCopy {
  connected: boolean
  copied: number
  failed: number
  waiting?: number
  /** photo uuid → its Drive file id */
  done?: Record<string, string>
  problem?: string
}

/** The most photos one call copies (the function's own limit). */
export const DRIVE_BATCH = 25
const KEY = 'ww.drive'
/** When Drive isn't connected, phones ask again after this long. */
export const OFF_RECHECK_MS = 60 * 60 * 1000

interface Cached {
  on: boolean
  at: number
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Cached) : null
  } catch {
    return null
  }
}

/** Remember whether Drive is connected (so phones don't ask every sync when it isn't). */
export function rememberDrive(on: boolean, now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ on, at: now } satisfies Cached))
  } catch {
    // private mode: asks every time
  }
}

/** Last known answer: true / false, or null when never asked. */
export function driveOn(): boolean | null {
  return readCache()?.on ?? null
}

/** Skip asking: Drive was off when asked less than an hour ago. */
export function driveRecentlyOff(now = Date.now(), cached: Cached | null = readCache()): boolean {
  return !!cached && !cached.on && now - cached.at < OFF_RECHECK_MS
}

export interface RemotePhotoLite {
  uuid: string
  user_id?: string
  drive_file_id?: string | null
  deleted: boolean
}

/**
 * The photos this phone asks drive-photo to copy: its person's own photos in
 * the cloud with no Drive copy yet, the ones just uploaded first. (Each person's
 * phone copies their own, so two phones never race for the same photo; the admin's
 * "Copy missing photos now" picks up the rest.)
 */
export function photosToCopy(remote: RemotePhotoLite[], userId: string, justUploaded: string[], max = DRIVE_BATCH): string[] {
  const waiting = new Set(remote.filter((r) => !r.deleted && !r.drive_file_id && (r.user_id === undefined || r.user_id === userId)).map((r) => r.uuid))
  const out: string[] = []
  for (const u of justUploaded) if (!out.includes(u) && (waiting.has(u) || !remote.some((r) => r.uuid === u))) out.push(u)
  for (const u of waiting) if (!out.includes(u)) out.push(u)
  return out.slice(0, max)
}

/** The line under a photo: where its copy is. null = say nothing (Drive isn't used). */
export function photoDriveText(p: { driveFileId?: string; syncedAt?: string }, on: boolean | null): string | null {
  if (p.driveFileId) return 'Saved to Google Drive'
  if (on === false) return null
  if (!p.syncedAt) return 'On this phone. Goes to Google Drive after the next sync.'
  return on ? 'Waiting to copy to Google Drive' : null
}

/** Ask drive-photo to copy these photos. Never throws; answers null when it couldn't ask. */
export async function copyToDrive(c: SupabaseClient, photoUuids: string[]): Promise<DriveCopy | null> {
  if (!photoUuids.length) return null
  try {
    const { data, error } = await c.functions.invoke('drive-photo', { body: { photoUuids } })
    if (error) {
      // not deployed yet: same as not connected
      const status = (error as { context?: Response }).context?.status
      if (status === 404) rememberDrive(false)
      return null
    }
    const copy = data as DriveCopy
    rememberDrive(copy.connected)
    return copy
  } catch {
    return null
  }
}

/** "3 photos" / "1 photo" */
export const photosText = (n: number) => `${n} photo${n === 1 ? '' : 's'}`

/** The Settings card's line under "Google Drive". */
export function driveLine(s: DriveStatus | null): string {
  if (!s) return 'Checking…'
  if (!s.ready) return 'Not set up on the server yet'
  if (!s.connected) return 'Not connected'
  if (s.problem) return 'Google stopped the access. Connect again.'
  return s.waiting ? `${s.email || 'Connected'} · ${photosText(s.waiting)} waiting` : `${s.email || 'Connected'} · all photos copied`
}
