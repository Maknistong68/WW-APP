import { getActor } from './actor'
import { newUuid } from './uuid'
import type { ActivityAction, ActivityChange, ActivityEntity, ActivityEntry } from '../types'

/** The one place activity entries are made: stamped with the time and who is signed in. */
export function activityEntry(
  entity: ActivityEntity,
  entityUuid: string,
  action: ActivityAction,
  label: string,
  changes: ActivityChange[] = [],
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
  }
}
