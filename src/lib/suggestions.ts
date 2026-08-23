import { db } from '../db'
import { OBSERVATIONS } from '../templates/observations'

// ---------------------------------------------------------------------------
// Observation quick-pick suggestions: a curated per-question library plus
// phrases the inspector actually wrote for the same question in past
// inspections. Both feed the tap-to-add chips above the observation field.
// ---------------------------------------------------------------------------

const MAX_LEARNED_PER_CODE = 5
const MAX_SUGGESTIONS = 8

/**
 * Observations previously written for each question code across all other
 * inspections, most-used first. One table scan — call once per page load,
 * not per render.
 */
export async function learnedSuggestions(
  excludeInspectionId: number,
): Promise<Map<string, string[]>> {
  const counts = new Map<string, Map<string, number>>()
  await db.inspections.each((ins) => {
    if (ins.id === excludeInspectionId) return
    for (const [code, resp] of Object.entries(ins.responses ?? {})) {
      const obs = resp?.observation?.trim()
      if (!obs) continue
      // Chip selections are joined with '; ', so split back into phrases.
      for (const part of obs.split(/;\s*/)) {
        const phrase = part.trim()
        if (phrase.length < 4) continue
        let perPhrase = counts.get(code)
        if (!perPhrase) counts.set(code, (perPhrase = new Map()))
        perPhrase.set(phrase, (perPhrase.get(phrase) ?? 0) + 1)
      }
    }
  })
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
 * Combined chip list for a question (or a walkthrough line's codes):
 * the inspector's own past phrasings first, then the curated library,
 * deduplicated and capped so the chip row stays scannable.
 */
export function suggestionsFor(codes: string[], learned: Map<string, string[]>): string[] {
  const out: string[] = []
  const add = (s: string) => {
    if (out.length < MAX_SUGGESTIONS && !out.includes(s)) out.push(s)
  }
  for (const code of codes) for (const s of learned.get(code) ?? []) add(s)
  for (const code of codes) for (const s of OBSERVATIONS[code] ?? []) add(s)
  return out
}
