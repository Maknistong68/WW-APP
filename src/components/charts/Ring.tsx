import type { CSSProperties } from 'react'
import CountUp from '../CountUp'
import type { PeekPart } from '../../lib/peek'

const SIZE = 120
const R = 44
const STROKE = 12
/** Surface gap between parts. */
const GAP = 3
const C = 2 * Math.PI * R

/**
 * One whole split into parts: a ring in the status colours with the big
 * number in the middle. Parts at zero draw nothing; with nothing at all, a
 * grey track. Fills clockwise on entry (a surface-coloured cover unwinds).
 */
export default function Ring({ parts, value, label, aria }: { parts: PeekPart[]; value: string; label: string; aria: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const shown = parts.filter((p) => p.value > 0)
  let at = 0
  const arcs = shown.map((p) => {
    const len = (p.value / total) * C
    const arc = { tone: p.tone, dash: Math.max(0, len - (shown.length > 1 ? GAP : 0)), offset: at }
    at += len
    return arc
  })
  const mid = SIZE / 2
  return (
    <div className="ring" role="img" aria-label={aria}>
      <svg className="ring-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <g transform={`rotate(-90 ${mid} ${mid})`} fill="none" strokeWidth={STROKE}>
          {total === 0 ? (
            <circle className="ring-track" cx={mid} cy={mid} r={R} />
          ) : (
            arcs.map((a, i) => (
              <circle key={i} className={`ring-arc ${a.tone}`} cx={mid} cy={mid} r={R} strokeDasharray={`${a.dash} ${C}`} strokeDashoffset={-a.offset} />
            ))
          )}
          <circle className="ring-cover" cx={mid} cy={mid} r={R + 1} strokeWidth={STROKE + 2} style={{ '--c': C } as CSSProperties} />
        </g>
      </svg>
      <div className="ring-centre">
        <b className="ring-value">
          <CountUp value={value} />
        </b>
        <span className="ring-label">{label}</span>
      </div>
    </div>
  )
}
