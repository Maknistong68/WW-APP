import type { Table } from 'dexie'
import { db, logEvent } from '../db'
import { activityEntry, entryIsPrivate } from './activityEntry'

export { activityEntry }
import { diffRecords } from './diff'
import { addPending, dropPending, readPending, shouldReplay } from './pendingSaves'
import type { ActivityAction, ActivityChange, ActivityEntity, RecordTable } from '../types'

// ---------------------------------------------------------------------------
// The only write path for co-pilot records. Every save/delete stamps
// updatedAt and appends an activity entry in the same transaction, so the
// activity log can never miss a change.
// ---------------------------------------------------------------------------

export const ENTITY_OF: Record<RecordTable, ActivityEntity> = {
  contractors: 'contractor',
  workOrders: 'workOrder',
  camps: 'camp',
  tickets: 'ticket',
  kpiMonths: 'kpi',
  manpower: 'manpower',
  weeklyCounts: 'weekly',
  sitePlaces: 'site',
  mapItems: 'map',
  routines: 'routine',
  teamSettings: 'settings',
}

type AnyRecord = { uuid: string; updatedAt: string }

function tableOf(name: RecordTable): Table<AnyRecord, string> {
  return db.table(name) as Table<AnyRecord, string>
}

export const nowIso = () => new Date().toISOString()

/** Fire-and-forget activity entry for things outside the record tables (audits, imports). */
export function logActivity(
  entity: ActivityEntity,
  entityUuid: string,
  action: ActivityAction,
  label: string,
  changes: ActivityChange[] = [],
): void {
  void db.activity.add(activityEntry(entity, entityUuid, action, label, changes)).catch((err: unknown) => {
    const detail = `${label}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`
    logEvent(null, 'Activity log failed', detail)
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('ww-notice', { detail: { text: 'This change could not be added to the activity log.', reload: false } }))
  })
}

/**
 * Insert or update a record. `action` defaults to add/edit; pass 'close' or
 * 'reopen' for ticket state changes. Returns the saved record. No-op edits
 * (nothing changed) are not written or logged.
 */
export async function saveRecord<T extends AnyRecord>(
  table: RecordTable,
  record: T,
  label: string,
  action?: ActivityAction,
): Promise<T> {
  // Kept until done: if the phone's database is stuck or the app closes mid-save, it is saved on the next start.
  const pending = addPending({ table, record, label, action, at: nowIso() })
  try {
    return await writeRecord(table, record, label, action)
  } finally {
    dropPending(pending)
  }
}

/** The stored copy of a record: by uuid, or for KPI / manpower the same work order and month. */
async function storedOf<T extends AnyRecord>(t: Table<AnyRecord, string>, table: RecordTable, record: T): Promise<T | undefined> {
  const own = (await t.get(record.uuid)) as T | undefined
  if (own || (table !== 'kpiMonths' && table !== 'manpower')) return own
  const r = record as unknown as { contractorUuid: string; workOrderUuid: string; month: string }
  return (await t.where('[contractorUuid+workOrderUuid+month]').equals([r.contractorUuid, r.workOrderUuid, r.month]).first()) as T | undefined
}

/**
 * Saves left over from before (the app was closed, reloaded or stuck mid-save):
 * each is saved now, unless something newer was stored meanwhile. Returns how many.
 */
let replayed = false
export async function replayPendingSaves(): Promise<number> {
  // once per start: a second call (React may run an effect twice) finds nothing to do
  if (replayed) return 0
  replayed = true
  let n = 0
  for (const p of readPending()) {
    try {
      const stored = await storedOf(tableOf(p.table), p.table, p.record)
      if (shouldReplay(p, stored)) {
        await writeRecord(p.table, p.record, p.label, p.action)
        n++
        logEvent(null, 'Unsaved change saved', `${p.label} (from ${p.at})`)
      }
      dropPending(p.id)
    } catch (err) {
      logEvent(null, 'Unsaved change failed', `${p.label}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`)
    }
  }
  return n
}

async function writeRecord<T extends AnyRecord>(table: RecordTable, record: T, label: string, action?: ActivityAction): Promise<T> {
  const t = tableOf(table)
  return db.transaction('rw', t, db.activity, async () => {
    // One KPI / manpower row per work order and month (a unique index): if a
    // teammate's row for the same month synced in while this sheet was open,
    // update that row instead of failing on the duplicate.
    const before = await storedOf(t, table, record)
    if (before && before.uuid !== record.uuid) record = { ...record, uuid: before.uuid }
    const changes = diffRecords(
      before as unknown as Record<string, unknown> | undefined,
      record as unknown as Record<string, unknown>,
    )
    if (before && changes.length === 0) return before
    const saved = { ...record, updatedAt: nowIso() }
    await t.put(saved)
    // a task only its owner sees: so is its log entry (as the task is now saved)
    await db.activity.add(
      activityEntry(ENTITY_OF[table], record.uuid, action ?? (before ? 'edit' : 'add'), label, changes, { private: entryIsPrivate(table, saved) }),
    )
    return saved
  })
}

/**
 * Remove a ticket or case (the admin only, with a reason): it leaves this
 * phone at once, the server marks it removed for everyone, and the activity
 * log keeps who, when and why. It can be restored (Removed tickets).
 */
export async function removeTicket(uuid: string, reason: string, label: string): Promise<void> {
  await db.transaction('rw', db.tickets, db.tombstones, db.activity, async () => {
    await db.tickets.delete(uuid)
    await db.tombstones.add({ table: 'tickets', uuid })
    await db.activity.add(activityEntry('ticket', uuid, 'delete', label, [{ field: 'reason', from: null, to: reason.trim() }]))
  })
}

/** Delete a record locally, queue the cloud deletion, and log it. */
export async function removeRecord(table: RecordTable, uuid: string, label: string): Promise<void> {
  const t = tableOf(table)
  await db.transaction('rw', t, db.tombstones, db.activity, async () => {
    const was = await t.get(uuid)
    await t.delete(uuid)
    await db.tombstones.add({ table, uuid })
    await db.activity.add(activityEntry(ENTITY_OF[table], uuid, 'delete', label, [], { private: entryIsPrivate(table, was) }))
  })
}
