import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { niceMax } from '../../lib/chartScale'
import { haptic } from '../../lib/haptics'

export interface MonthBarsPoint {
  /** YYYY-MM */
  month: string
  /** null = no data that month (no bar, not a 0 bar). */
  values: (number | null)[]
}

const H = 150
const PAD = { top: 10, right: 6, bottom: 22, left: 36 }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1]
const long = (m: string) => `${short(m)} ${m.slice(0, 4)}`

/** A bar with 4px rounded top corners, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/**
 * Monthly columns, one or two series side by side (2px gap). Legend for two
 * series. Hover (mouse) previews a month; a tap or a scrub selects it with a
 * tick, and the callout pops out of the bar, with an Open button when
 * `onOpen` is given.
 */
export default function MonthBars({
  data,
  series,
  format = (v) => v.toLocaleString('en-US'),
  axisFormat = format,
  onOpen,
  openLabel = 'Open',
}: {
  data: MonthBarsPoint[]
  /** Series names, in the order of `values`. Max 2. */
  series: string[]
  format?: (v: number) => string
  axisFormat?: (v: number) => string
  /** Open the month that was tapped (its tickets, or that month on the Dashboard). */
  onOpen?: (month: string) => void
  openLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  const [hover, setHover] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const scrubbing = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A tap anywhere else lets go of the selected month.
  useEffect(() => {
    if (sel === null) return
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setSel(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [sel])

  const all = data.flatMap((d) => d.values).filter((v): v is number => v !== null)
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

  const indexAt = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left - PAD.left) / slot)
    return i >= 0 && i < data.length ? i : null
  }
  const select = (i: number | null) => {
    if (i === null || i === sel) return
    haptic('tick')
    setSel(i)
  }
  const shown = hover ?? sel
  const actionable = !!onOpen && sel !== null && shown === sel
  /** Half the callout's width, so it stays inside the card. */
  const half = Math.min(w / 2, (actionable ? 70 : 0) + (n > 1 ? 105 : 70))

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
        style={{ touchAction: 'pan-y' }}
        onPointerMove={(e) => {
          if (scrubbing.current) select(indexAt(e))
          else if (e.pointerType === 'mouse') setHover(indexAt(e))
        }}
        onPointerDown={(e) => {
          scrubbing.current = true
          select(indexAt(e))
        }}
        onPointerUp={() => (scrubbing.current = false)}
        onPointerCancel={() => (scrubbing.current = false)}
        onPointerLeave={() => {
          scrubbing.current = false
          setHover(null)
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis-text" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {shown !== null && (
          <rect className={`hover-band${shown === sel ? ' sel' : ''}`} x={PAD.left + shown * slot} y={PAD.top} width={slot} height={ih} rx={4} />
        )}
        {data.map((d, i) => {
          const x0 = PAD.left + i * slot + (slot - groupW) / 2
          return (
            <g key={d.month}>
              {d.values.slice(0, n).map((v, k) =>
                v === null ? null : (
                  <path key={k} className={`col s${k}`} style={{ '--i': i } as CSSProperties} d={barPath(x0 + k * (barW + 2), y(v), barW, y(0) - y(v))} />
                ),
              )}
              {(i % every === 0 || i === data.length - 1) && (data.length - 1 - i >= every || i === data.length - 1) && (
                <text className="axis-text" x={PAD.left + i * slot + slot / 2} y={H - 4} textAnchor="middle">
                  {short(d.month)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {shown !== null && (
        <div
          key={shown}
          className={`chart-tip${actionable ? ' actionable' : ''}`}
          style={{ left: Math.min(Math.max(PAD.left + shown * slot + slot / 2, half), w - half), top: n > 1 ? 22 : 0 }}
        >
          {long(data[shown].month)} ·{' '}
          {series
            .map((s, k) => {
              const v = data[shown].values[k]
              return `${n > 1 ? `${s} ` : ''}${v === null || v === undefined ? 'no data' : format(v)}`
            })
            .join(' · ')}
          {actionable && (
            <button className="chart-open" onClick={() => onOpen!(data[sel!].month)}>
              {openLabel} ›
            </button>
          )}
        </div>
      )}
    </div>
  )
}
