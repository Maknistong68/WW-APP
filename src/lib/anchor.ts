import type { Box } from './popup'

// The item a menu was opened from (long-press, ⋯ or right-click). The press
// handler sets it just before the menu opens; showActions() takes it, so every
// menu grows out of the item it belongs to without each screen passing it on.

const FRESH_MS = 300
let last: { box: Box; at: number } | null = null

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export function setAnchor(box: Box, at: number = now()): void {
  last = { box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height }, at }
}

/** The held item, once, if it was set a moment ago. */
export function takeAnchor(at: number = now()): Box | undefined {
  const a = last
  last = null
  return a && at - a.at <= FRESH_MS ? a.box : undefined
}
