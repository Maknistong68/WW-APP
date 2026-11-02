import type { ActivityEntry } from '../types'
import type { Role } from './auth'

// ---------------------------------------------------------------------------
// Who is signed in on this phone, so every change is stamped with a name, and
// how a stamped change reads ("by You", "by Ali Hassan"). Pure: no React, no
// database (records.ts and db.ts use it).
// ---------------------------------------------------------------------------

export interface Actor {
  id: string
  /** Full name, else @username, else the email's first part. */
  name: string
  role: Role
}

/** A teammate as team_members() returns them (names only, no emails). */
export interface TeamMember {
  id: string
  username: string | null
  full_name: string | null
}

let current: Actor | null = null
// Kept apart from the actor: a phone with no cloud account has a role (admin) but nobody to name.
let role: Role | null = null

export function setActor(a: Actor | null): void {
  current = a
}
export const getActor = (): Actor | null => current
export function setRole(r: Role | null): void {
  role = r
}
/** Admin-only menu actions (e.g. Remove ticket) check this. */
export const isAdmin = (): boolean => role === 'admin'

/** "Ali Hassan", else "@ali", else "". */
export function displayName(p: { full_name?: string | null; username?: string | null }): string {
  const full = p.full_name?.trim()
  if (full) return full
  return p.username ? `@${p.username}` : ''
}

/** Who made a change, for a "by …" line: "You", the teammate's current name, the stamped name, or null. */
export function whoName(e: Pick<ActivityEntry, 'by' | 'byName'>, team: TeamMember[], meId: string | null | undefined): string | null {
  if (!e.by) return e.byName?.trim() || null
  if (meId && e.by === meId) return 'You'
  const member = team.find((m) => m.id === e.by)
  const name = member ? displayName(member) : ''
  return name || e.byName?.trim() || null
}

/** The newest entry with this action (e.g. who closed the ticket). */
export function lastAction(entries: ActivityEntry[], action: ActivityEntry['action']): ActivityEntry | undefined {
  let best: ActivityEntry | undefined
  for (const e of entries) if (e.action === action && (!best || e.time > best.time)) best = e
  return best
}
