// Cleaners for the one-time history import: every messy spelling in the old
// workbooks becomes one value from lib/lists.ts.

/** Plain text of an ExcelJS cell value (rich text, formulas, hyperlinks…). */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('').trim()
    if ('result' in o) return cellText(o.result)
    if ('text' in o) return cellText(o.text)
    if ('error' in o) return ''
    return ''
  }
  return String(v).trim()
}

/** Unwrap formula results so dates and numbers keep their type. */
export function cellValue(v: unknown): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date) && 'result' in (v as object)) {
    return (v as { result: unknown }).result
  }
  return v
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) =>
  y > 1990 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : ''

/**
 * YYYY-MM-DD from a real date, an Excel serial number, `dd-mm-yyyy hh:mm`
 * text or ISO text. Returns '' when it can't be read.
 */
export function parseDate(raw: unknown): string {
  const v = cellValue(raw)
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    return ymd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate())
  }
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return ''
    const d = new Date(Math.round((v - 25569) * 86400000))
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  const s = cellText(v)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return ymd(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return ymd(+m[3], +m[2], +m[1])
  return ''
}

const MON: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** Weekly tab names like "03-JAN-2025", "20-Apr-2025" → YYYY-MM-DD. */
export function parseSheetDate(name: string): string {
  const m = name.trim().match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{4})$/)
  if (!m) return ''
  const mon = MON[m[2].toLowerCase()]
  return mon ? ymd(+m[3], mon, +m[1]) : ''
}

export function toInt(raw: unknown): number {
  const v = cellValue(raw)
  if (typeof v === 'number') return Math.max(0, Math.round(v))
  const n = parseInt(cellText(v).replace(/[^\d]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

/** 0.83 or 83 or "83%" → 83. Blank → null. */
export function toPct(raw: unknown): number | null {
  const v = cellValue(raw)
  let n: number
  if (typeof v === 'number') n = v
  else {
    const s = cellText(v).replace('%', '').trim()
    if (s === '') return null
    n = Number(s)
    if (isNaN(n)) return null
  }
  if (n <= 1) n *= 100
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10))
}

export const isYes = (raw: unknown) => /^y(es)?$/i.test(cellText(raw))

export function cleanChannel(raw: unknown): string {
  const s = cellText(raw).toLowerCase()
  if (!s) return ''
  if (s.includes('hotline')) return 'Worker Hotline'
  if (s.includes('chatbot')) return 'WhatsApp Chatbot'
  if (s.includes('whatsapp')) return 'WhatsApp'
  if (s.includes('internal')) return 'Welfare Internal'
  if (s.includes('mail')) return 'Email'
  if (s.includes('phone') || s.includes('call')) return 'Phone'
  if (s.includes('site') || s.includes('visit')) return 'Site visit'
  return cellText(raw)
}

/** First of the given texts that names a known category. */
export function cleanCategory(...raws: unknown[]): string {
  const texts = raws.map((r) => cellText(r).toLowerCase()).filter(Boolean)
  for (const s of texts) if (/off.?board/.test(s)) return 'Off-Boarding'
  for (const s of texts) if (/on.?board/.test(s)) return 'On-Boarding'
  for (const s of texts) {
    if (/transport/.test(s)) return 'Transportation'
    if (/employ|salary/.test(s)) return 'Employment Practice'
    if (/accom|liveab|livab/.test(s)) return 'Accommodation'
    if (/food/.test(s)) return 'Food'
  }
  return texts.length ? 'Other' : ''
}

const ISSUE_RULES: [RegExp, string][] = [
  [/final\s*sal/, 'Final salary'],
  [/over\s*time/, 'Overtime not paid'],
  [/end\s*of\s*service|eosb|gratuity/, 'End of service benefits'],
  [/deduct/, 'Illegal deductions'],
  [/ajeer|freelanc|informal|illegal\s*work/, 'Informal worker / No Ajeer'],
  [/recruit/, 'Recruitment fees'],
  [/passport/, 'Passport withheld'],
  [/harass|bully|intimid|abuse/, 'Harassment / bullying'],
  [/fire/, 'Fire fighting system'],
  [/food/, 'Food provision'],
  [/transport|bus/, 'Transportation'],
  [/salar|wage|unpaid|not\s*paid/, 'Salary not received'],
  [/bed|bath|toilet|accom|overcrowd|wi.?fi|kitchen|camp|room|ac\b|air\s*con/, 'Accommodation standards'],
]

/** First of the given texts that matches a known issue. */
export function cleanIssue(...raws: unknown[]): string {
  const texts = raws.map((r) => cellText(r).toLowerCase()).filter(Boolean)
  for (const s of texts) for (const [re, issue] of ISSUE_RULES) if (re.test(s)) return issue
  return texts.length ? 'Other' : ''
}

export function cleanPriority(raw: unknown): number {
  const s = cellText(raw).toLowerCase()
  const d = s.match(/[1-4]/)
  if (d) return Number(d[0])
  if (s.includes('critical')) return 1
  if (s.includes('high')) return 2
  if (s.includes('moderate') || s.includes('medium')) return 3
  if (s.includes('low')) return 4
  return 2
}

export function cleanSeverity(raw: unknown): string {
  const s = cellText(raw).toLowerCase()
  if (s.includes('critical')) return 'Critical'
  if (s.includes('improve')) return 'Need Improvement'
  return 'Not Acceptable'
}

export function cleanStatus(raw: unknown): 'Open' | 'In progress' | 'Closed' | '' {
  const s = cellText(raw).toLowerCase()
  if (s.includes('clos')) return 'Closed'
  if (s.includes('progress')) return 'In progress'
  if (s.includes('open')) return 'Open'
  return ''
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1').replace(/[aeiou]/g, '')

/**
 * Unify people's names ("ASIM Jan" / "Asim Jan", "Mohamed  Ibrahim" /
 * "Mohammed Ibrahim"). Returns raw → canonical (the most used spelling).
 */
export function unifyNames(raws: string[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const r of raws) {
    const t = titleCase(r)
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  const groups = new Map<string, string[]>()
  for (const t of counts.keys()) {
    const k = squash(t)
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  const canon = new Map<string, string>()
  for (const names of groups.values()) {
    const best = [...names].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))[0]
    for (const n of names) canon.set(n, best)
  }
  const out = new Map<string, string>()
  for (const r of raws) {
    const t = titleCase(r)
    if (t) out.set(r, canon.get(t) ?? t)
  }
  return out
}

/**
 * Money mentioned in free text: "SAR 25,553", "25553/SAR", "1050 sar",
 * "SR 500", "500 riyals". Returns the largest amount found, or null.
 */
export function extractAmount(raw: unknown): number | null {
  const text = cellText(raw)
  if (!text) return null
  const re = /(?:\b(?:SAR|SR)\.?\s*([\d,]+(?:\.\d+)?))|(?:([\d,]+(?:\.\d+)?)\s*\/?\s*(?:SAR|SR|riyals?|ryals?)\b)/gi
  let best: number | null = null
  for (const m of text.matchAll(re)) {
    const n = Number((m[1] ?? m[2] ?? '').replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0 && (best === null || n > best)) best = n
  }
  return best
}

export interface MoneyCell {
  amount: number | null
  /** "combined with WWCMPL0008056" → that ticket number */
  combinedWith: string
  duplicate: boolean
}

/**
 * The "Money Owed" column: a number, "combined (ticket) with WWCMPL…",
 * "Duplicate", "N/A" — or, in old rows, leftover description text (ignored).
 */
export function parseMoneyCell(raw: unknown): MoneyCell {
  const v = cellValue(raw)
  const out: MoneyCell = { amount: null, combinedWith: '', duplicate: false }
  if (typeof v === 'number') return { ...out, amount: Math.max(0, v) }
  const s = cellText(v)
  if (!s) return out
  const combined = s.match(/combin\w*[^A-Z0-9]*(?:ticket\s*)?(?:with\s*)?(WWCMPL[\w-]+)/i)
  if (combined) return { ...out, combinedWith: combined[1].toUpperCase() }
  if (/duplic/i.test(s)) return { ...out, duplicate: true }
  const n = s.replace(/[,\s]|SAR|SR/gi, '')
  if (/^\d+(\.\d+)?$/.test(n)) return { ...out, amount: Number(n) }
  return out
}
