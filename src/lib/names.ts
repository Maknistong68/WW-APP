// Contractor name matching: the same company is spelled many ways
// ("Alfahd Trading Industry & Contracting Co", "Al Fahad", "Al Fahad-882").

const NOISE = new Set([
  'co', 'company', 'contracting', 'contractors', 'contractor', 'trading', 'industry', 'industrial', 'est',
  'establishment', 'llc', 'ltd', 'limited', 'group', 'jv', 'joint', 'venture', 'services', 'service',
  'construction', 'real', 'estate', 'development', 'the', 'and', 'for', 'of', 'saudi', 'arabia', 'ksa',
  'general', 'maintenance', 'corporation', 'corp', 'inc', 'w', 'wll',
])

/** Significant lowercase tokens: punctuation, legal words and work-order numbers removed. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .split(' ')
    .filter((w) => w && !NOISE.has(w) && !/^\d+$/.test(w))
}

/** Order-independent compact key, e.g. "Al Fahad-882" → "alfahad". */
export const nameKey = (name: string) => [...nameTokens(name)].sort().join('')

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

/** True when two names most likely mean the same company. */
export function sameCompany(a: string, b: string): boolean {
  const ka = nameKey(a)
  const kb = nameKey(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  // joined spelling ("alfahd") vs spaced ("al fahad") and one-letter typos
  const ja = nameTokens(a).join('')
  const jb = nameTokens(b).join('')
  if (ja === jb) return true
  if (Math.min(ja.length, jb.length) >= 5 && lev(ja, jb) <= 1) return true
  // initials: "AM Tamimi" = "Abdul Mohsin Al Tamimi"
  return acronymMatch(nameTokens(a), nameTokens(b)) || acronymMatch(nameTokens(b), nameTokens(a))
}

const PARTICLES = new Set(['al', 'el', 'bin', 'ibn'])
const core = (t: string[]) => t.filter((w) => !PARTICLES.has(w)).sort().join(' ')

function acronymMatch(short: string[], long: string[]): boolean {
  for (let k = 0; k < short.length; k++) {
    const s = short[k]
    if (s.length < 2 || s.length > 4 || !/^[a-z]+$/.test(s)) continue
    for (let i = 0; i + s.length <= long.length; i++) {
      const run = long.slice(i, i + s.length)
      if (run.map((w) => w[0]).join('') !== s) continue
      const restShort = core(short.filter((_, j) => j !== k))
      const restLong = core([...long.slice(0, i), ...long.slice(i + s.length)])
      if (restShort && restShort === restLong) return true
    }
  }
  return false
}

/** Does free text (e.g. an audit's contractor field) mention this contractor? */
export function mentions(text: string, names: string[]): boolean {
  const words = nameTokens(text)
  return names.some((n) => {
    const size = nameTokens(n).length
    if (size === 0) return false
    // compare every run of nearby words in the text with the name
    for (let len = Math.max(1, size - 1); len <= size + 1; len++) {
      for (let i = 0; i + len <= words.length; i++) {
        if (sameCompany(words.slice(i, i + len).join(' '), n)) return true
      }
    }
    return false
  })
}

/** Legal-form and filler words that can go from the end of a name. */
const TAIL = [
  'co', 'company', 'contracting', 'contract', 'contractors', 'contractor', 'trading', 'est', 'establishment',
  'llc', 'ltd', 'limited', 'group', 'jv', 'joint', 'venture', 'services', 'service', 'corporation', 'corp',
  'inc', 'wll', 'branch', 'holding', 'holdings',
]
const TAIL_SET = new Set(TAIL)
/** Joining words left dangling once the end is gone. */
const DANGLING = new Set(['and', 'for', 'of', 'the', ''])

/**
 * A contractor's short name for tight rows: filler words come off the end only
 * ("Project Pioneers Contracting Company" → "Project Pioneers"), including a last word
 * cut off by an old import ("… Contracting Compa"). The middle and the spelling stay;
 * the first word always stays.
 */
export function shortName(name: string): string {
  const words = name.replace(/_/g, ' ').trim().split(/\s+/).filter(Boolean)
  const key = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '')
  let end = words.length
  // a cut-off last word: the start of a filler word ("Compa", "Con")
  const last = key(words[end - 1] ?? '')
  if (end > 1 && last.length >= 3 && !TAIL_SET.has(last) && TAIL.some((t) => t.length > last.length && t.startsWith(last))) end--
  while (end > 1 && (TAIL_SET.has(key(words[end - 1])) || DANGLING.has(key(words[end - 1])))) end--
  return words.slice(0, end).join(' ')
}

/**
 * Another contractor already called this (by name or one of its other names,
 * ignoring case and spaces)? Returns that contractor's name, or null.
 */
export function takenContractorName(
  name: string,
  contractors: { uuid: string; name: string; aliases: string[] }[],
  exceptUuid = '',
): string | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key) return null
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const hit = contractors.find((c) => c.uuid !== exceptUuid && [c.name, ...c.aliases].some((n) => norm(n) === key))
  return hit ? hit.name : null
}
