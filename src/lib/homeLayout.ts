// Home's sections and their order. Each person sets their own order with
// Edit Home; it is kept on the phone (localStorage), like the theme.

export type HomeSection = 'start' | 'areas' | 'watch' | 'progress'

export interface HomeSectionDef {
  key: HomeSection
  label: string
  /** One line on what it shows (Edit Home). */
  help: string
}

/** Every section, in the default order. */
export const HOME_SECTIONS: HomeSectionDef[] = [
  { key: 'start', label: 'Start here', help: 'Late and this week’s jobs, one card each' },
  { key: 'areas', label: 'All areas', help: 'The six areas: what’s late, or the next date' },
  { key: 'watch', label: 'Watch', help: 'No deadline: low KPIs, workers, visas, fees' },
  { key: 'progress', label: 'Month progress', help: 'How much of the month is entered' },
]

export const DEFAULT_ORDER: HomeSection[] = HOME_SECTIONS.map((s) => s.key)

const isSection = (v: unknown): v is HomeSection => DEFAULT_ORDER.includes(v as HomeSection)

/** A saved order made safe: known names once each, then any section it didn't have. */
export function normalizeOrder(saved: unknown): HomeSection[] {
  const out: HomeSection[] = []
  if (Array.isArray(saved)) for (const v of saved) if (isSection(v) && !out.includes(v)) out.push(v)
  for (const k of DEFAULT_ORDER) if (!out.includes(k)) out.push(k)
  return out
}

/** The order with one section moved up (-1) or down (+1); unchanged at either end. */
export function moveSection(order: HomeSection[], key: HomeSection, by: -1 | 1): HomeSection[] {
  const i = order.indexOf(key)
  const j = i + by
  if (i < 0 || j < 0 || j >= order.length) return order
  const next = [...order]
  next[i] = order[j]
  next[j] = key
  return next
}

const STORE = 'ww.homeOrder'

export function loadOrder(): HomeSection[] {
  try {
    const raw = localStorage.getItem(STORE)
    return normalizeOrder(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_ORDER
  }
}

export function saveOrder(order: HomeSection[]) {
  try {
    if (order.join() === DEFAULT_ORDER.join()) localStorage.removeItem(STORE)
    else localStorage.setItem(STORE, JSON.stringify(order))
  } catch {
    // no storage (private window): the order lasts until the app closes
  }
}

/** Home's title by the hour: morning until noon, afternoon until 5 pm, then evening. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}
