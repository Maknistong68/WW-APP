import type { ReactNode } from 'react'
import { useLongPress } from '../../lib/useLongPress'

export interface BarDatum {
  key: string
  label: string
  value: number
  detail?: string
  onClick?: () => void
  /** Hold (or right-click) for a menu. */
  onMore?: () => void
}

function BarRow({ d, top, format }: { d: BarDatum; top: number; format: (v: number) => string }) {
  const press = useLongPress(d.onMore)
  const title = `${d.label}: ${format(d.value)}${d.detail ? ` · ${d.detail}` : ''}`
  const inner: ReactNode = (
    <>
      <span className="bar-label">{d.label}</span>
      <span className="bar-value">
        {format(d.value)}
        {d.detail ? ` · ${d.detail}` : ''}
      </span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${(d.value / top) * 100}%` }} />
      </span>
    </>
  )
  return d.onClick ? (
    <button type="button" className="bar-row tappable" role="listitem" title={title} aria-label={title} onClick={d.onClick} {...press}>
      {inner}
    </button>
  ) : (
    <div className="bar-row" role="listitem" title={title} {...press}>
      {inner}
    </div>
  )
}

/** Horizontal single-series bars, value at the tip, top N then "Other". */
export default function BarList({
  data,
  max = 7,
  format = (v) => String(v),
}: {
  data: BarDatum[]
  max?: number
  /** How the value is written at the bar's tip. */
  format?: (v: number) => string
}) {
  if (data.length === 0) return <div className="note">Nothing in this period.</div>
  const shown = data.slice(0, max)
  const rest = data.slice(max)
  if (rest.length) {
    shown.push({ key: '__other', label: `Other (${rest.length})`, value: rest.reduce((s, d) => s + d.value, 0) })
  }
  const top = Math.max(...shown.map((d) => d.value), 1)
  return (
    <div className="bars" role="list">
      {shown.map((d) => (
        <BarRow key={d.key} d={d} top={top} format={format} />
      ))}
    </div>
  )
}
