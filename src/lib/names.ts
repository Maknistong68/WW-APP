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
