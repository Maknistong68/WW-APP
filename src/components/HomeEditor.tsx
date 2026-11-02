import { useLayoutEffect, useRef } from 'react'
import Icon from './Icon'
import { reducedMotion } from '../lib/motion'
import { HOME_SECTIONS, type HomeSection } from '../lib/homeLayout'

/**
 * Edit Home: Home's sections as a list, each moved up or down on its own.
 * A moved row glides to its new place (transform only; none with reduced motion).
 */
export default function HomeEditor({
  order,
  onMove,
  onReset,
  onDone,
}: {
  order: HomeSection[]
  onMove: (key: HomeSection, by: -1 | 1) => void
  onReset: () => void
  onDone: () => void
}) {
  const rows = useRef(new Map<HomeSection, HTMLElement>())
  const tops = useRef(new Map<HomeSection, number>())

  // FLIP: each row starts where it was and slides to where it is now.
  useLayoutEffect(() => {
    const next = new Map<HomeSection, number>()
    rows.current.forEach((el, key) => {
      const top = el.getBoundingClientRect().top
      next.set(key, top)
      const was = tops.current.get(key)
      if (was !== undefined && was !== top && !reducedMotion() && typeof el.animate === 'function') {
        el.animate([{ transform: `translateY(${was - top}px)` }, { transform: 'none' }], { duration: 250, easing: 'cubic-bezier(.33,0,.1,1)' })
      }
    })
    tops.current = next
  }, [order])

  return (
    <div className="home-edit">
      <section className="clist">
        <h2 className="clist-head">Edit Home</h2>
        <div className="clist-body">
          {order.map((key, i) => {
            const s = HOME_SECTIONS.find((x) => x.key === key)!
            return (
              <div
                key={key}
                className="hedit-row"
                ref={(el) => {
                  if (el) rows.current.set(key, el)
                  else rows.current.delete(key)
                }}
              >
                <span className="hedit-text">
                  <b>{s.label}</b>
                  <span>{s.help}</span>
                </span>
                <button type="button" className="round-btn hedit-btn up" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => onMove(key, -1)}>
                  <Icon name="chevron-down" size={22} strokeWidth={2.4} />
                </button>
                <button type="button" className="round-btn hedit-btn" aria-label={`Move ${s.label} down`} disabled={i === order.length - 1} onClick={() => onMove(key, 1)}>
                  <Icon name="chevron-down" size={22} strokeWidth={2.4} />
                </button>
              </div>
            )
          })}
        </div>
      </section>
      <p className="list-foot">The order is kept on this phone.</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onReset}>
          Reset order
        </button>
        <button type="button" className="btn primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}
