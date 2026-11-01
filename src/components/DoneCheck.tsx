import type { CSSProperties } from 'react'

/**
 * "Done": a green ring springs in and a tick draws itself; with `burst`, a
 * little ring of dots flies out (the "all caught up" moment). Transform and
 * opacity only; reduced motion shows the finished check at once.
 */
export default function DoneCheck({ size = 52, burst = false, label = 'Done' }: { size?: number; burst?: boolean; label?: string }) {
  return (
    <span className={`done-check${burst ? ' burst' : ''}`} style={{ width: size, height: size, '--r': `${size * 0.75}px` } as CSSProperties} role="img" aria-label={label}>
      <svg viewBox="0 0 52 52" width={size} height={size} aria-hidden="true">
        <circle className="done-ring" cx="26" cy="26" r="24" />
        <path className="done-tick" d="M15 27l7 7 15-16" pathLength={1} />
      </svg>
      {burst &&
        Array.from({ length: 8 }, (_, i) => <i key={i} className="done-dot" aria-hidden="true" style={{ '--a': `${i * 45}deg` } as CSSProperties} />)}
    </span>
  )
}
