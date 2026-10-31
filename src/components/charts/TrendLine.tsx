import { useEffect, useRef, useState } from 'react'

export interface TrendDatum {
  date: string
  value: number
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

  if (data.length < 2) return <div className="note">Not enough weeks yet.</div>
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const iw = w - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * iw
  const y = (v: number) => PAD.top + ih - (v / max) * ih
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('')
  const area = `${path}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
  const ticks = [0, max / 2, max]
  const xTicks = [0, Math.floor((data.length - 1) / 2), data.length - 1]
  const last = data[data.length - 1]

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
        aria-label={`${unit} per week, latest ${last.value}`}
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
        <path className="line" d={path} />
        <circle className="dot" cx={x(data.length - 1)} cy={y(last.value)} r={4} />
        <text className="end-label" x={x(data.length - 1) + 7} y={y(last.value) + 4}>
          {last.value}
        </text>
        {hover !== null && (
          <>
            <line className="cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} />
            <circle className="dot" cx={x(hover)} cy={y(data[hover].value)} r={5} />
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(x(hover), 60), w - 60), top: 0 }}>
          {full(data[hover].date)} · {data[hover].value} {unit}
        </div>
      )}
    </div>
  )
}
