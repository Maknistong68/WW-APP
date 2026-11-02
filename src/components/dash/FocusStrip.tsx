import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CountUp from '../CountUp'
import Icon from '../Icon'
import Meter from '../charts/Meter'
import Ring from '../charts/Ring'
import SplitBar from '../charts/SplitBar'
import { useLongPress } from '../../lib/useLongPress'
import type { FocusCard } from '../../lib/focus'

function Card({ c, onHold, format }: { c: FocusCard; onHold: () => void; format?: (v: number) => string }) {
  const navigate = useNavigate()
  const press = useLongPress(onHold)
  return (
    <button type="button" className="fcard" onClick={() => navigate(c.link.to)} aria-label={`${c.title}: ${c.value}. ${c.line}`} {...press}>
      <span className="fcard-head">
        <span className="fcard-title">{c.title}</span>
      </span>
      {c.kind === 'ring' && c.parts && (
        <span className="fcard-fig ring-fig">
          <Ring parts={c.parts} value={c.value} label={c.key === 'overall' ? 'average' : c.key === 'camps' ? 'active' : 'open'} aria={`${c.title} ${c.value}`} />
          <span className="ring-legend">
            {c.parts.map((p) => (
              <span key={p.label}>
                <i className={`sw ${p.tone}`} />
                {p.label}
                <b>{p.value}</b>
              </span>
            ))}
          </span>
        </span>
      )}
      {c.kind === 'meter' && c.meter && (
        <span className="fcard-fig">
          <span className={`fcard-num ${c.tone}`}>
            <CountUp value={c.value} />
          </span>
          <Meter pct={c.meter.pct} tone={c.tone} target={c.meter.target} label={c.title} />
        </span>
      )}
      {c.kind === 'split' && c.parts && (
        <span className="fcard-fig">
          <span className={`fcard-num ${c.tone}`}>
            <CountUp value={c.value} />
          </span>
          <SplitBar parts={c.parts} label={c.title} format={format} />
        </span>
      )}
      <span className="fcard-line">{c.line}</span>
      <span className="fcard-link">
        {c.link.label}
        <Icon name="chevron-right" size={16} strokeWidth={2.6} />
      </span>
    </button>
  )
}

/**
 * The Dashboard's Focus: two to four big cards side by side, swiped across;
 * the heading says which one you're on. Tap a card for its list, hold for its
 * pop-up.
 */
export default function FocusStrip({ cards, onHold, format }: { cards: FocusCard[]; onHold: (c: FocusCard) => void; format?: (c: FocusCard) => ((v: number) => string) | undefined }) {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const onScroll = () => {
    const el = track.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    setAt(Math.min(cards.length - 1, Math.max(0, Math.round(el.scrollLeft / (first.offsetWidth + gap)))))
  }
  return (
    <section className="focus" aria-label="Focus">
      <h2 className="clist-head">
        Focus
        <span className="focus-pos">
          {Math.min(at, cards.length - 1) + 1} of {cards.length}
        </span>
      </h2>
      <div className="focus-track" ref={track} onScroll={onScroll}>
        {cards.map((c) => (
          <Card key={c.key} c={c} onHold={() => onHold(c)} format={format?.(c)} />
        ))}
      </div>
    </section>
  )
}
