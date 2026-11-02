import { useEffect, type RefObject } from 'react'

/**
 * Where a sideways chip row should scroll so the chosen chip is fully in
 * view with `pad` space beside it, or null when it already is. `start` is
 * the chip's left edge measured from the row's scroll start.
 */
export function chipScrollLeft(
  row: { scrollLeft: number; clientWidth: number },
  chip: { start: number; width: number },
  pad: number,
): number | null {
  if (chip.start - pad < row.scrollLeft) return Math.max(0, chip.start - pad)
  const end = chip.start + chip.width + pad
  if (end > row.scrollLeft + row.clientWidth) return end - row.clientWidth
  return null
}

/** Keep the row's `.on` chip in view whenever `value` changes. Sets scrollLeft (scrollIntoView jumps the page on iOS). */
export function useChipScroll(ref: RefObject<HTMLElement>, value: unknown, pad = 16): void {
  useEffect(() => {
    const row = ref.current
    const on = row?.querySelector<HTMLElement>('.on')
    if (!row || !on) return
    const r = on.getBoundingClientRect()
    const c = row.getBoundingClientRect()
    const next = chipScrollLeft({ scrollLeft: row.scrollLeft, clientWidth: row.clientWidth }, { start: r.left - c.left + row.scrollLeft, width: r.width }, pad)
    if (next !== null) row.scrollLeft = next
  }, [ref, value, pad])
}
