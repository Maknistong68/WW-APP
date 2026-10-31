export interface BarDatum {
  key: string
  label: string
  value: number
  detail?: string
  onClick?: () => void
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
        <div
          key={d.key}
          className="bar-row"
          role="listitem"
          title={`${d.label}: ${format(d.value)}${d.detail ? ` · ${d.detail}` : ''}`}
          onClick={d.onClick}
          style={d.onClick ? { cursor: 'pointer' } : undefined}
        >
          <span className="bar-label">{d.label}</span>
          <span className="bar-value">
            {format(d.value)}
            {d.detail ? ` · ${d.detail}` : ''}
          </span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / top) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
