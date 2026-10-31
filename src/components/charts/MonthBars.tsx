import { useEffect, useRef, useState } from 'react'

export interface MonthBarsPoint {
  /** YYYY-MM */
  month: string
  values: number[]
}

const H = 150
const PAD = { top: 10, right: 6, bottom: 22, left: 36 }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1]
const long = (m: string) => `${short(m)} ${m.slice(0, 4)}`

function niceMax(v: number) {
  if (v <= 5) return 5
  const step = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / step
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * step
}

/** A bar with 4px rounded top corners, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/**
 * Monthly columns, one or two series side by side (2px gap). Legend for two
 * series; tap or hover a month for its numbers.
 */
export default function MonthBars({
  data,
  series,
  format = (v) => v.toLocaleString('en-US'),
  axisFormat = format,
}: {
  data: MonthBarsPoint[]
  /** Series names, in the order of `values`. Max 2. */
  series: string[]
  format?: (v: number) => string
  axisFormat?: (v: number) => string
}) {
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

  const all = data.flatMap((d) => d.values)
  if (data.length === 0 || all.every((v) => v === 0)) return <div className="note">Nothing in these months yet.</div>
  const max = niceMax(Math.max(...all))
  const iw = w - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const slot = iw / data.length
  const n = series.length
  const barW = Math.max(3, Math.min(18, (slot * 0.7 - (n - 1) * 2) / n))
  const groupW = n * barW + (n - 1) * 2
  const y = (v: number) => PAD.top + ih - (v / max) * ih
  const every = data.length > 8 ? Math.ceil(data.length / 6) : 1
  const ticks = [0, max / 2, max]

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left - PAD.left) / slot)
    setHover(i >= 0 && i < data.length ? i : null)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {n > 1 && (
        <div className="chart-legend">
          {series.map((s, i) => (
            <span key={s}>
              <i className={`swatch s${i}`} />
              {s}
            </span>
          ))}
        </div>
      )}
      <svg
        className="chart-svg"
        width={w}
        height={H}
        role="img"
        aria-label={`${series.join(' and ')} per month`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis-text" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {hover !== null && (
          <rect className="hover-band" x={PAD.left + hover * slot} y={PAD.top} width={slot} height={ih} rx={4} />
        )}
        {data.map((d, i) => {
          const x0 = PAD.left + i * slot + (slot - groupW) / 2
          return (
            <g key={d.month}>
              {d.values.slice(0, n).map((v, k) => (
                <path key={k} className={`col s${k}`} d={barPath(x0 + k * (barW + 2), y(v), barW, y(0) - y(v))} />
              ))}
              {(i % every === 0 || i === data.length - 1) && (data.length - 1 - i >= every || i === data.length - 1) && (
                <text className="axis-text" x={PAD.left + i * slot + slot / 2} y={H - 4} textAnchor="middle">
                  {short(d.month)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(PAD.left + hover * slot + slot / 2, 70), w - 70), top: n > 1 ? 22 : 0 }}
        >
          {long(data[hover].month)} · {series.map((s, k) => `${n > 1 ? `${s} ` : ''}${format(data[hover].values[k] ?? 0)}`).join(' · ')}
        </div>
      )}
    </div>
  )
}
