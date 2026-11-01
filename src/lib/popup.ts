// Where a long-press pop-up opens: right under the held item, or above it,
// or (no room either side) as a bottom sheet. Pure, so it is tested.

export interface Box {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface Placement {
  /** below / above the held item, or docked at the bottom when it fits on neither side. */
  mode: 'below' | 'above' | 'dock'
  top: number
  left: number
  width: number
  /** transform-origin inside the pop-up, so it grows out of the held item. */
  originX: number
  originY: number
}

/** Space between the item and the pop-up. */
export const POP_GAP = 8
/** Space kept from the screen edges. */
export const POP_MARGIN = 12

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function placePopup(anchor: Box, size: { width: number; height: number }, viewport: { width: number; height: number }): Placement {
  const width = Math.min(size.width, viewport.width - 2 * POP_MARGIN)
  const left = clamp(anchor.left + (anchor.width - width) / 2, POP_MARGIN, viewport.width - POP_MARGIN - width)
  const originX = clamp(anchor.left + anchor.width / 2 - left, 0, width)
  if (anchor.bottom + POP_GAP + size.height <= viewport.height - POP_MARGIN) {
    return { mode: 'below', top: anchor.bottom + POP_GAP, left, width, originX, originY: 0 }
  }
  if (anchor.top - POP_GAP - size.height >= POP_MARGIN) {
    return { mode: 'above', top: anchor.top - POP_GAP - size.height, left, width, originX, originY: size.height }
  }
  // Docked at the bottom, as wide as a sheet, still growing out of the held item.
  const dockW = Math.min(DOCK_MAX_W, viewport.width - 2 * POP_MARGIN)
  const dockLeft = (viewport.width - dockW) / 2
  const top = Math.max(POP_MARGIN, viewport.height - POP_MARGIN - size.height)
  return {
    mode: 'dock',
    top,
    left: dockLeft,
    width: dockW,
    originX: anchor.left + anchor.width / 2 - dockLeft,
    originY: anchor.top + anchor.height / 2 - top,
  }
}

/** Widest a docked menu gets (tablets). */
export const DOCK_MAX_W = 520
