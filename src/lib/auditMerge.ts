import { isWelfareAudit } from './inspectionKinds'
import { newer } from './syncRules'
import type { Inspection, QuestionResponse } from '../types'

// ---------------------------------------------------------------------------
// A Worker Welfare audit can be worked on from two devices at once (laptop and
// phone). Each answer carries its own time (`QuestionResponse.at`), so two
// copies are put together question by question instead of the newer copy
// wiping out the other's answers. The rest (form, notes, status) comes from the
// newer copy. A finished audit (scores only, `logged`) always wins whole, so
// the other device's old answers never come back after Finish.
// ---------------------------------------------------------------------------

/** Should these two copies be merged (rather than the newer one replacing the other)? */
export const mergesAnswers = (a: Inspection, b: Inspection) => isWelfareAudit(a) && isWelfareAudit(b)

const answerTime = (r: QuestionResponse | undefined) => r?.at ?? ''

/** The two copies put together: per question the newest answer, the rest from the newer copy. */
export function mergeAudit(a: Inspection, b: Inspection): Inspection {
  const [older, newest] = newer(b.updatedAt, a.updatedAt) ? [a, b] : [b, a]
  if (a.logged || b.logged) {
    if (a.logged && b.logged) return newest
    return a.logged ? a : b
  }
  const responses: Record<string, QuestionResponse> = {}
  for (const code of new Set([...Object.keys(older.responses), ...Object.keys(newest.responses)])) {
    const o = older.responses[code]
    const n = newest.responses[code]
    // a tie (or no times) keeps the newer copy's answer
    responses[code] = !n || (o && answerTime(o) > answerTime(n)) ? o! : n
  }
  return { ...newest, responses }
}

/** The parts two devices can differ in (not the local id or the save time). */
const content = (i: Inspection) => JSON.stringify([i.status, i.info, i.notes, i.logged ?? null, i.campUuid ?? null, sorted(i.responses)])
const sorted = (r: Record<string, QuestionResponse>) => Object.keys(r).sort().map((k) => [k, r[k]])

export const sameContent = (a: Inspection, b: Inspection) => content(a) === content(b)

export interface AuditSyncPlan {
  /** What both copies become. */
  merged: Inspection
  /** The cloud copy is missing something: send `merged`. */
  push: boolean
  /** This device's copy is missing something: store `merged`. */
  store: boolean
}

/**
 * Sync between this device's copy and the cloud's. When the merge has something
 * neither had alone, it gets a save time after both, so the other device picks it up.
 */
export function planAuditSync(local: Inspection, remote: Inspection): AuditSyncPlan {
  const merged = mergeAudit(local, remote)
  const likeRemote = sameContent(merged, remote)
  const likeLocal = sameContent(merged, local)
  if (likeRemote) return { merged: { ...remote, id: local.id, uuid: local.uuid }, push: false, store: !likeLocal || local.updatedAt !== remote.updatedAt }
  if (likeLocal && newer(local.updatedAt, remote.updatedAt)) return { merged: local, push: true, store: false }
  const after = Math.max(Date.parse(local.updatedAt) || 0, Date.parse(remote.updatedAt) || 0) + 1
  return { merged: { ...merged, id: local.id, uuid: local.uuid, updatedAt: new Date(after).toISOString() }, push: true, store: true }
}

/** The answers that changed between two copies of `responses` get the time of the change. */
export function stampAnswers(prev: Record<string, QuestionResponse>, next: Record<string, QuestionResponse>, at: string): Record<string, QuestionResponse> {
  let out = next
  for (const code of Object.keys(next)) {
    if (next[code] !== prev[code] && next[code].at === prev[code]?.at) {
      if (out === next) out = { ...next }
      out[code] = { ...next[code], at }
    }
  }
  return out
}
