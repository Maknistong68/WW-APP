import { db } from '../db'
import { OBSERVATIONS } from '../templates/observations'
import { REMARKS } from '../templates/remarks'

// ---------------------------------------------------------------------------
// Quick-pick suggestions for the observation AND the action-plan/remark
// fields: a curated library plus phrases the inspector actually wrote for the
// same question in past inspections. Both feed the tap-to-add chips.
// ---------------------------------------------------------------------------

const MAX_LEARNED_PER_CODE = 5
const MAX_SUGGESTIONS = 8

export interface LearnedSuggestions {
  /** Past observations per question code, most-used first. */
  observations: Map<string, string[]>
  /** Past action-plan/remark phrases per question code, most-used first. */
  remarks: Map<string, string[]>
}

const topPhrases = (counts: Map<string, Map<string, number>>): Map<string, string[]> => {
  const out = new Map<string, string[]>()
  for (const [code, perPhrase] of counts) {
    const top = [...perPhrase.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_LEARNED_PER_CODE)
      .map(([phrase]) => phrase)
    out.set(code, top)
  }
  return out
}

/**
 * Phrases previously written for each question code across all other
 * inspections, most-used first. One table scan — call once per page load,
 * not per render.
 */
export async function learnedSuggestions(
  excludeInspectionId: number,
): Promise<LearnedSuggestions> {
  const obsCounts = new Map<string, Map<string, number>>()
  const remarkCounts = new Map<string, Map<string, number>>()
  const tally = (counts: Map<string, Map<string, number>>, code: string, text: string) => {
    // Chip selections are joined with '; ', so split back into phrases.
    for (const part of text.split(/;\s*/)) {
      const phrase = part.trim()
      if (phrase.length < 4) continue
      let perPhrase = counts.get(code)
      if (!perPhrase) counts.set(code, (perPhrase = new Map()))
      perPhrase.set(phrase, (perPhrase.get(phrase) ?? 0) + 1)
    }
  }
  await db.inspections.each((ins) => {
    if (ins.id === excludeInspectionId) return
    for (const [code, resp] of Object.entries(ins.responses ?? {})) {
      const obs = resp?.observation?.trim()
      if (obs) tally(obsCounts, code, obs)
      const remark = resp?.actionPlan?.trim()
      if (remark) tally(remarkCounts, code, remark)
    }
  })
  return { observations: topPhrases(obsCounts), remarks: topPhrases(remarkCounts) }
}

const combine = (codes: string[], learned: Map<string, string[]>, library: (code: string) => string[]): string[] => {
  const out: string[] = []
  const add = (s: string) => {
    if (out.length < MAX_SUGGESTIONS && !out.includes(s)) out.push(s)
  }
  for (const code of codes) for (const s of learned.get(code) ?? []) add(s)
  for (const code of codes) for (const s of library(code)) add(s)
  return out
}

/**
 * Combined observation chip list for a question (or a walkthrough line's
 * codes): the inspector's own past phrasings first, then the curated library,
 * deduplicated and capped so the chip row stays scannable.
 */
export function suggestionsFor(codes: string[], learned: Map<string, string[]>): string[] {
  return combine(codes, learned, (code) => OBSERVATIONS[code] ?? [])
}

/**
 * Remark/action-plan chip list: past remarks for these codes first, then the
 * generic remark library.
 */
export function remarkSuggestionsFor(codes: string[], learned: Map<string, string[]>): string[] {
  return combine(codes, learned, () => REMARKS)
}
