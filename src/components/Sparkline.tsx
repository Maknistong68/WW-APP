import { segments } from '../lib/chartScale'
import type { Tone } from '../lib/tone'

/**
 * A tiny trend: a muted line (gaps where there's no data), an optional dashed
 * target line, and the latest point coloured by its status.
 */
export default function Sparkline({
  values,
  label,
  tone = 'none',
  width = 84,
  height = 28,
  domain = [0, 100],
  guide,
}: {
  values: (number | null)[]
  /** What it shows, for screen readers, e.g. "Overall KPI, last 6 months". */
  label: string
  /** Status of the latest value: colours the end dot. */
  tone?: Tone
  width?: number
  height?: number
  domain?: [number, number]
  /** A dashed target line, e.g. 90. */
  guide?: number
}) {
  const pad = 3
  const n = values.length
  const [lo, hi] = domain
  const x = (i: number) => pad + (n <= 1 ? 0 : (i * (width - 2 * pad)) / (n - 1))
  const y = (v: number) => pad + (height - 2 * pad) * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1))
  const d = segments(values)
    .map((run) => run.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(values[i] as number).toFixed(1)}`).join(''))
    .join('')
  let last = -1
  for (let i = n - 1; i >= 0; i--) if (values[i] !== null) { last = i; break }
  const shown = values.filter((v) => v !== null).join(', ')
  return (
    <svg className="spark" width={width} height={height} role="img" aria-label={`${label}: ${shown || 'no data'}`}>
      {guide !== undefined && <line className="spark-guide" x1={0} x2={width} y1={y(guide)} y2={y(guide)} />}
      <path className="spark-line" d={d} />
      {last >= 0 && <circle className={`spark-dot ${tone}`} cx={x(last)} cy={y(values[last] as number)} r={3.2} />}
    </svg>
  )
}
