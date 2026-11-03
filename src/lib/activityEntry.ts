import { getActor } from './actor'
import { newUuid } from './uuid'
import type { ActivityAction, ActivityChange, ActivityEntity, ActivityEntry, RecordTable } from '../types'

/** The one place activity entries are made: stamped with the time and who is signed in. */
export function activityEntry(
  entity: ActivityEntity,
  entityUuid: string,
  action: ActivityAction,
  label: string,
  changes: ActivityChange[] = [],
  o: { private?: boolean } = {},
): ActivityEntry {
  const who = getActor()
  return {
    uuid: newUuid(),
    time: new Date().toISOString(),
    entity,
    entityUuid,
    action,
    label,
    changes,
    ...(who ? { by: who.id, byName: who.name } : {}),
    ...(o.private ? { private: true as const } : {}),
  }
}

/** A change to a task only its owner sees: its log entry is private too (as the task is saved). */
export const entryIsPrivate = (table: RecordTable, record: unknown): boolean =>
  table === 'routines' && (record as { visibility?: string } | undefined)?.visibility === 'me'
