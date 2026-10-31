import type { Table } from 'dexie'
import { db, newUuid } from '../db'
import { diffRecords } from './diff'
import type { ActivityAction, ActivityChange, ActivityEntity, ActivityEntry, RecordTable } from '../types'

// ---------------------------------------------------------------------------
// The only write path for co-pilot records. Every save/delete stamps
// updatedAt and appends an activity entry in the same transaction, so the
// activity log can never miss a change.
// ---------------------------------------------------------------------------

export const ENTITY_OF: Record<RecordTable, ActivityEntity> = {
  contractors: 'contractor',
  tickets: 'ticket',
  kpiMonths: 'kpi',
  manpower: 'manpower',
  weeklyCounts: 'weekly',
}

type AnyRecord = { uuid: string; updatedAt: string }

function tableOf(name: RecordTable): Table<AnyRecord, string> {
  return db.table(name) as Table<AnyRecord, string>
}

export const nowIso = () => new Date().toISOString()

export function activityEntry(
  entity: ActivityEntity,
  entityUuid: string,
  action: ActivityAction,
  label: string,
  changes: ActivityChange[] = [],
): ActivityEntry {
  return { uuid: newUuid(), time: nowIso(), entity, entityUuid, action, label, changes }
}

/** Fire-and-forget activity entry for things outside the record tables (audits, imports). */
export function logActivity(
  entity: ActivityEntity,
  entityUuid: string,
  action: ActivityAction,
  label: string,
  changes: ActivityChange[] = [],
): void {
  void db.activity.add(activityEntry(entity, entityUuid, action, label, changes)).catch(() => {})
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
  const t = tableOf(table)
  return db.transaction('rw', t, db.activity, async () => {
    const before = (await t.get(record.uuid)) as T | undefined
    const changes = diffRecords(
      before as unknown as Record<string, unknown> | undefined,
      record as unknown as Record<string, unknown>,
    )
    if (before && changes.length === 0) return before
    const saved = { ...record, updatedAt: nowIso() }
    await t.put(saved)
    await db.activity.add(
      activityEntry(ENTITY_OF[table], record.uuid, action ?? (before ? 'edit' : 'add'), label, changes),
    )
    return saved
  })
}

/** Delete a record locally, queue the cloud deletion, and log it. */
export async function removeRecord(table: RecordTable, uuid: string, label: string): Promise<void> {
  const t = tableOf(table)
  await db.transaction('rw', t, db.tombstones, db.activity, async () => {
    await t.delete(uuid)
    await db.tombstones.add({ table, uuid })
    await db.activity.add(activityEntry(ENTITY_OF[table], uuid, 'delete', label))
  })
}
