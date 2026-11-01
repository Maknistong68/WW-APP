// A damped spring (for the bouncy, game-like moves: sites popping in, bars
// filling with a little overshoot, a site squashing when it's dropped).

export interface Spring {
  x: number
  v: number
}

/** Step a spring towards `target`. Low damping overshoots; sub-steps keep it stable on slow frames. */
export function springStep(s: Spring, target: number, dt: number, stiffness = 170, damping = 12): void {
  let left = Math.min(Math.max(dt, 0), 0.1)
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120)
    const a = -stiffness * (s.x - target) - damping * s.v
    s.v += a * h
    s.x += s.v * h
    left -= h
  }
}
