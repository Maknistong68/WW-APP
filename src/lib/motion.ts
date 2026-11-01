// Motion helpers shared by components. Curves are Samsung One UI's SESL
// interpolators (SINE_IN_OUT_70/80/90); see tokens.css for the CSS side.

/** The phone asks for less motion. */
export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** How long overlays take to leave (matches --dur-out in tokens.css). */
export const EXIT_MS = 200

/**
 * A CSS-style cubic-bezier as a function of time (0..1 → 0..1), for the few
 * animations that run in JS (count-up numbers).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  /** Solve x(t) = x for t: Newton first, bisection if it stalls. */
  const solve = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x
      if (Math.abs(err) < 1e-6) return t
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 40; i++) {
      const v = sx(t)
      if (Math.abs(v - x) < 1e-6) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return t
  }
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)))
}

/** One UI "SINE_IN_OUT_80": the default for things that settle. */
export const easeSine80 = cubicBezier(0.33, 0, 0.2, 1)
