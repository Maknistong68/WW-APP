import type { CSSProperties } from 'react'

// Gradient "cover art" (Spotify-style): every section has its own hue pair,
// and every record gets a stable gradient from its name, so the same ticket or
// contractor always looks the same.

export type Section =
  | 'home'
  | 'tickets'
  | 'dashboard'
  | 'library'
  | 'contractors'
  | 'camps'
  | 'closeout'
  | 'users'
  | 'settings'
  | 'kpi'
  | 'money'

/** [hue from, hue to] */
export const SECTION_HUES: Record<Section, [number, number]> = {
  home: [145, 175],
  tickets: [345, 285],
  dashboard: [215, 250],
  library: [265, 225],
  contractors: [180, 210],
  camps: [32, 12],
  closeout: [275, 305],
  users: [200, 230],
  settings: [220, 220],
  kpi: [160, 200],
  money: [45, 20],
}

/** Small stable hash of a string (FNV-1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Section of a route path ("/tickets/abc" → tickets). */
export function sectionOf(path: string): Section {
  const first = path.split('/')[1] ?? ''
  if (first === '' ) return 'home'
  if (first === 'missing' || first === 'kpis') return 'kpi'
  if (first === 'closeouts') return 'closeout'
  if (first === 'audits' || first === 'new' || first === 'inspection') return 'camps'
  if (first in SECTION_HUES) return first as Section
  return 'library'
}

/** Gradient for a cover square. `seed` varies the hue around the section's. */
export function coverGradient(section: Section, seed = ''): string {
  const [a, b] = SECTION_HUES[section]
  const shift = seed ? (hash(seed) % 50) - 25 : 0
  const s = section === 'settings' ? 8 : 62
  return `linear-gradient(135deg, hsl(${a + shift} ${s}% 46%), hsl(${b + shift} ${s + 6}% 26%))`
}

/** Page header glow: the section colour fading into the background. */
export function glowStyle(section: Section): CSSProperties {
  const [a, b] = SECTION_HUES[section]
  const s = section === 'settings' ? 6 : 55
  return {
    background: `linear-gradient(180deg, hsl(${a} ${s}% 32% / 0.85) 0%, hsl(${b} ${s}% 22% / 0.45) 45%, transparent 100%)`,
  }
}

/** "Al Fahad Contracting" → "AF" */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return '·'
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase()
}
