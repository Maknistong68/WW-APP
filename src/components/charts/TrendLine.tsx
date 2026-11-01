import { useEffect, useRef, useState } from 'react'
import { segments } from '../../lib/chartScale'

export interface TrendDatum {
  date: string
  /** null = no data: the line breaks there instead of dropping to 0. */
  value: number | null
}

const H = 150
const PAD = { top: 12, right: 30, bottom: 22, left: 28 }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`
const full = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`

function niceMax(v: number) {
  if (v <= 5) return 5
  const step = Math.pow(10, Math.floor(Math.log10(v)))
  return Math.ceil(v / step) * step
}

/** Single-series line: 2px line, 10% wash, end label, crosshair tooltip. */
export default function TrendLine({ data, unit }: { data: TrendDatum[]; unit: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const values = data.map((d) => d.value)
  const runs = segments(values)
  const known = values.filter((v): v is number => v !== null)
  if (data.length < 2 || known.length < 2) return <div className="note">Not enough data yet.</div>
  const max = niceMax(Math.max(...known))
  const iw = w - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * iw
  const y = (v: number) => PAD.top + ih - (v / max) * ih
  const runPath = (run: number[]) => run.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(values[i] as number).toFixed(1)}`).join('')
  const path = runs.map(runPath).join('')
  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => `${runPath(r)}L${x(r[r.length - 1])},${y(0)}L${x(r[0])},${y(0)}Z`)
    .join('')
  const ticks = [0, max / 2, max]
  const xTicks = [0, Math.floor((data.length - 1) / 2), data.length - 1]
  const lastRun = runs[runs.length - 1]
  const lastI = lastRun[lastRun.length - 1]
  const lastValue = values[lastI] as number
  const hoverValue = hover === null ? null : values[hover]

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - PAD.left) / iw) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg
        className="chart-svg"
        width={w}
        height={H}
        role="img"
        aria-label={`${unit}, latest ${lastValue}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis-text" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {xTicks.map((i, n) => (
          <text
            key={i}
            className="axis-text"
            x={x(i)}
            y={H - 4}
            textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}
          >
            {label(data[i].date)}
          </text>
        ))}
        <path className="area" d={area} />
        <path className="line" d={path} pathLength={1} />
        {runs
          .filter((r) => r.length === 1 && r[0] !== lastI)
          .map(([i]) => (
            <circle key={i} className="dot" cx={x(i)} cy={y(values[i] as number)} r={3} />
          ))}
        <circle className="dot" cx={x(lastI)} cy={y(lastValue)} r={4} />
        <text className="end-label" x={x(lastI) + 7} y={y(lastValue) + 4}>
          {lastValue}
        </text>
        {hover !== null && (
          <>
            <line className="cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} />
            {hoverValue !== null && <circle className="dot" cx={x(hover)} cy={y(hoverValue)} r={5} />}
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(x(hover), 60), w - 60), top: 0 }}>
          {full(data[hover].date)} · {hoverValue === null ? 'no data' : `${hoverValue} ${unit}`}
        </div>
      )}
    </div>
  )
}
