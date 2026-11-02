import type { PeekPart } from '../../lib/peek'

/**
 * One whole split into parts, as a thin bar (8 px, 2 px gaps) with a legend
 * that names each part and its number. A part at zero draws nothing.
 */
export default function SplitBar({
  parts,
  label,
  format = (v) => v.toLocaleString('en-US'),
  legend = true,
}: {
  parts: PeekPart[]
  /** What it shows, for screen readers. */
  label: string
  format?: (v: number) => string
  legend?: boolean
}) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const text = parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')
  return (
    <div className="split" role="img" aria-label={`${label}: ${text}`}>
      <div className="split-bar">
        {total === 0 ? (
          <span className="split-part none" style={{ flexBasis: '100%' }} />
        ) : (
          parts.filter((p) => p.value > 0).map((p) => <span key={p.label} className={`split-part ${p.tone}`} style={{ flexBasis: `${(p.value / total) * 100}%` }} />)
        )}
      </div>
      {legend && (
        <div className="split-legend">
          {parts.map((p) => (
            <span key={p.label}>
              <i className={`sw ${p.tone}`} />
              {p.label}
              <b>{format(p.value)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
