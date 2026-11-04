import type { DocRule, SubmissionKey } from '../types'

// ---------------------------------------------------------------------------
// Monthly documents the Admin switched off for the whole team (Settings ›
// Monthly documents). A switch counts from a month on, so earlier months keep
// their numbers: per document, the latest rule at or before a month decides,
// and no rule means on. Pure, plus a small store the app fills from the shared
// team_settings row (like setActor), so every list and score can ask isDocOn.
// ---------------------------------------------------------------------------

/** The one shared settings row (table teamSettings / team_settings). */
export const TEAM_SETTINGS_UUID = '5e771a65-0000-4000-8000-000000000001'

/** The rule in force for a document in a month (undefined: never switched). */
export function ruleAt(rules: DocRule[], key: SubmissionKey, month: string): DocRule | undefined {
  let at: DocRule | undefined
  for (const r of rules) if (r.key === key && r.from <= month && (!at || r.from >= at.from)) at = r
  return at
}

export const docOn = (rules: DocRule[], key: SubmissionKey, month: string): boolean => !ruleAt(rules, key, month)?.off

/** Switch a document on or off from `from` on. A new decision replaces any for that month or after. */
export function switchDoc(rules: DocRule[], key: SubmissionKey, off: boolean, from: string): DocRule[] {
  const kept = rules.filter((r) => !(r.key === key && r.from >= from))
  const next = docOn(kept, key, from) === !off ? kept : [...kept, { key, off, from }]
  return next.sort((a, b) => a.key.localeCompare(b.key) || a.from.localeCompare(b.from))
}

let current: DocRule[] = []

/** App.tsx keeps this in step with the shared row. */
export function setDocRules(rules: DocRule[] | undefined): void {
  current = rules ?? []
}
export const getDocRules = (): DocRule[] => current

/** Is the document asked for in this month? No month: yes. */
export const isDocOn = (key: SubmissionKey, month?: string): boolean => !month || docOn(current, key, month)
