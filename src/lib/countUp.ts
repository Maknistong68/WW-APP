// Count-up numbers: which values can roll up from 0, and how to print a
// value in between so it looks like the final one (same prefix, decimals,
// thousands commas and suffix).

export interface Count {
  prefix: string
  value: number
  decimals: number
  grouped: boolean
  suffix: string
}

const PATTERN = /^([A-Z]{1,3}\s)?(-?\d[\d,]*(?:\.\d+)?)(%|K|M|d)?$/

/** A number-like value that can count up, or null (dashes, dates, words). */
export function parseCount(v: unknown): Count | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    const s = String(v)
    const dot = s.indexOf('.')
    return { prefix: '', value: v, decimals: dot < 0 ? 0 : s.length - dot - 1, grouped: false, suffix: '' }
  }
  if (typeof v !== 'string') return null
  const m = PATTERN.exec(v.trim())
  if (!m) return null
  const digits = m[2]
  const grouped = digits.includes(',')
  if (grouped && !/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(digits)) return null
  const plain = digits.replace(/,/g, '')
  const dot = plain.indexOf('.')
  return {
    prefix: m[1] ?? '',
    value: Number(plain),
    decimals: dot < 0 ? 0 : plain.length - dot - 1,
    grouped,
    suffix: m[3] ?? '',
  }
}

/** Print an in-between value in the same shape as the final one. */
export function formatCount(c: Count, value: number): string {
  const fixed = Math.abs(value).toFixed(c.decimals)
  const [int, frac] = fixed.split('.')
  const body = c.grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : int
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : ''
  return `${c.prefix}${sign}${body}${frac ? `.${frac}` : ''}${c.suffix}`
}
