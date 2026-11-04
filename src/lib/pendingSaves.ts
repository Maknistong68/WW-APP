import type { ActivityAction, RecordTable } from '../types'

// ---------------------------------------------------------------------------
// A save is kept in localStorage until it is done (src/lib/records.ts
// saveRecord). If the phone's database gets stuck or the app is closed or
// reloaded mid-save, what was typed is still here and is saved on the next
// start (replayPendingSaves) — unless something newer was stored meanwhile.
// ---------------------------------------------------------------------------

const KEY = 'ww.pendingSaves'

export interface PendingSave {
  id: string
  table: RecordTable
  record: { uuid: string; updatedAt: string }
  label: string
  action?: ActivityAction
  /** When the save was asked for. */
  at: string
}

export function readPending(): PendingSave[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? (raw as PendingSave[]) : []
  } catch {
    return []
  }
}

function write(list: PendingSave[]): void {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list))
    else localStorage.removeItem(KEY)
  } catch {
    // storage full or blocked: the save itself still goes ahead
  }
}

/** Keep a save until it is done; a later save of the same record replaces it. Returns its id. */
export function addPending(p: Omit<PendingSave, 'id'>): string {
  const id = `${p.table}:${p.record.uuid}:${p.at}`
  write([...readPending().filter((x) => !(x.table === p.table && x.record.uuid === p.record.uuid)), { ...p, id }])
  return id
}

export function dropPending(id: string): void {
  const list = readPending()
  if (list.some((p) => p.id === id)) write(list.filter((p) => p.id !== id))
}

/** Save it again after a reload only when the stored copy is not newer than the moment it was asked for. */
export const shouldReplay = (p: PendingSave, stored: { updatedAt: string } | undefined): boolean =>
  !stored?.updatedAt || stored.updatedAt < p.at
