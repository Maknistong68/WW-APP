import type { ActivityEntry } from '../types'

/**
 * The activity entries this phone sends up for the signed-in person: their
 * own unsent changes, and old ones made before "who did it" (no name on them).
 * Another person's unsent changes wait until that person signs in again, so
 * the server never stamps them with the wrong name.
 */
export const mineToSend = (entries: ActivityEntry[], userId: string): ActivityEntry[] =>
  entries.filter((a) => !a.synced && (!a.by || a.by === userId))

/** Someone else's private entries already on the server: they leave a shared phone (their owner pulls them back). */
export const foreignPrivate = (entries: ActivityEntry[], userId: string): ActivityEntry[] =>
  entries.filter((a) => a.private && a.synced && !!a.by && a.by !== userId)
