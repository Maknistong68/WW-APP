import { newer } from './syncRules'

// What one record table's sync does, decided without touching the database
// (tested on its own). Tasks (routines) can be private: only their owner sees
// them, so a task this phone saw on the server that is no longer there was
// made private by its owner (or this person may no longer see it) — it leaves
// this phone instead of being sent back, which the server would refuse.

export interface LocalRecord {
  uuid: string
  updatedAt: string
}

export interface RemoteRow {
  uuid: string
  updated_at: string
  deleted: boolean
}

export interface SyncPlan<T extends LocalRecord> {
  /** Deleted on the server (and not changed here since): remove here. */
  remove: string[]
  /** No longer visible (made private by its owner, or someone else's private task): remove here, quietly. */
  hidden: string[]
  push: T[]
  pull: string[]
  /** The server's rows as seen this time (uuid → version), to remember for next time. */
  seen: Record<string, string>
}

export function planRecordSync<T extends LocalRecord>(o: {
  local: T[]
  remote: RemoteRow[]
  readOnly: boolean
  /** Tasks only: the server's rows as seen last time. */
  seen?: Record<string, string>
  /** Tasks only: someone else's private task (never sent from this phone). */
  foreign?: (r: T) => boolean
}): SyncPlan<T> {
  const remoteMap = new Map(o.remote.map((r) => [r.uuid, r]))
  const seenBefore = o.seen
  const isForeign = (r: T) => !!o.foreign && o.foreign(r)
  const remove: string[] = []
  const hidden: string[] = []
  const push: T[] = []

  for (const l of o.local) {
    const r = remoteMap.get(l.uuid)
    if (r) {
      if (r.deleted) {
        if (!newer(l.updatedAt, r.updated_at)) remove.push(l.uuid)
        continue
      }
      if (!o.readOnly && !isForeign(l) && newer(l.updatedAt, r.updated_at)) push.push(l)
      continue
    }
    // Not on the server (as far as this person can see).
    const was = seenBefore?.[l.uuid]
    if (isForeign(l)) {
      // someone else's private task on a shared phone: gone once it is safely on the server;
      // their own unsent change stays for them
      if (was !== undefined && !newer(l.updatedAt, was)) hidden.push(l.uuid)
      continue
    }
    if (seenBefore && was !== undefined) {
      hidden.push(l.uuid)
      continue
    }
    if (!o.readOnly) push.push(l)
  }

  const localMap = new Map(o.local.map((l) => [l.uuid, l]))
  const pull = o.remote
    .filter((r) => {
      if (r.deleted) return false
      const l = localMap.get(r.uuid)
      return !l || newer(r.updated_at, l.updatedAt)
    })
    .map((r) => r.uuid)

  return { remove, hidden, push, pull, seen: Object.fromEntries(o.remote.map((r) => [r.uuid, r.updated_at])) }
}
