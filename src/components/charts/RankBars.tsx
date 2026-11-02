import { useLongPress } from '../../lib/useLongPress'
import type { Tone } from '../../lib/tone'

export interface RankItem {
  key: string
  label: string
  value: number
  /** The value as written, when it isn't the plain number ("84%"). */
  text?: string
  detail?: string
  tone?: Tone
  tag?: string
  onOpen?: () => void
  /** Hold (or right-click) for its pop-up. */
  onHold?: () => void
}

function Row({ item, top, format }: { item: RankItem; top: number; format: (v: number) => string }) {
  const press = useLongPress(item.onHold)
  const value = item.text ?? format(item.value)
  const title = `${item.label}: ${value}${item.detail ? ` · ${item.detail}` : ''}`
  const inner = (
    <>
      <span className="rank-label">
        {item.label}
        {item.tag && <em className="rank-tag">{item.tag}</em>}
      </span>
      <span className="rank-value">
        <b>{value}</b>
        {item.detail ? ` · ${item.detail}` : ''}
      </span>
      <span className="rank-track">
        <span className={`rank-fill${item.tone ? ` ${item.tone}` : ''}`} style={{ width: `${top ? (item.value / top) * 100 : 0}%` }} />
      </span>
    </>
  )
  return item.onOpen ? (
    <button type="button" className="rank-row" role="listitem" title={title} aria-label={title} onClick={item.onOpen} {...press}>
      {inner}
    </button>
  ) : (
    <div className="rank-row" role="listitem" title={title} {...press}>
      {inner}
    </div>
  )
}

/**
 * Ranked thin bars (8 px): the name and value above, the bar below. Top `max`
 * then one "Other" (counts and money), or every row (percentages). Tap opens,
 * hold pops up.
 */
export default function RankBars({
  items,
  format = (v) => v.toLocaleString('en-US'),
  scale,
  other = 'sum',
  max = 6,
}: {
  items: RankItem[]
  format?: (v: number) => string
  /** A fixed full-bar value (100 for percentages); otherwise the largest. */
  scale?: number
  other?: 'sum' | 'none'
  max?: number
}) {
  const shown = other === 'none' ? [...items] : items.slice(0, max)
  const rest = other === 'none' ? [] : items.slice(max)
  if (rest.length) shown.push({ key: '__other', label: `Other (${rest.length})`, value: rest.reduce((s, d) => s + d.value, 0), tone: 'none' })
  const top = scale ?? Math.max(...shown.map((d) => d.value), 1)
  return (
    <div className="rank" role="list">
      {shown.map((item) => (
        <Row key={item.key} item={item} top={top} format={format} />
      ))}
    </div>
  )
}
