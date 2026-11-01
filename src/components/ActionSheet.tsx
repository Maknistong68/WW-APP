import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import Sparkline from './Sparkline'
import { EXIT_MS, reducedMotion } from '../lib/motion'
import { takeAnchor } from '../lib/anchor'
import { placePopup, type Box, type Placement } from '../lib/popup'
import type { Tone } from '../lib/tone'

export interface SheetAction {
  label: string
  icon: IconName
  onSelect: () => void
  danger?: boolean
  /** Hidden for read-only (viewer) accounts. */
  edit?: boolean
}

export interface SheetFact {
  label: string
  value: ReactNode
  tone?: Tone
}

export interface ActionSheetSpec {
  title: string
  sub?: string
  /** Cover art or any small visual for the header. */
  cover?: ReactNode
  /** Extra line(s) under the header, e.g. what a Home card means. */
  note?: string
  /** A small preview: up to 3 key numbers. */
  facts?: SheetFact[]
  /** A small preview: a trend line (e.g. the last 6 months' KPI). */
  spark?: { values: (number | null)[]; label: string; tone?: Tone; guide?: number }
  /** The item it was opened from; defaults to the one just held (src/lib/anchor.ts). */
  anchor?: Box
  actions: SheetAction[]
}

/** Width of the pop-up that grows out of a held item. */
const POP_W = 340

type Listener = (s: ActionSheetSpec | null) => void
let listener: Listener | null = null

/** Open the quick actions (long-press / ⋯ / right-click) from anywhere. */
export function showActions(spec: ActionSheetSpec) {
  listener?.({ ...spec, anchor: spec.anchor ?? takeAnchor() })
}

/**
 * One host near the root renders the menu. Opened from a held item it is a
 * pop-up that grows out of that item, with the item lit up and the rest
 * dimmed (below it, above it, or docked at the bottom when it fits on
 * neither side); opened from code without an item, a floating bottom sheet.
 */
export default function ActionSheetHost({ canEdit }: { canEdit: boolean }) {
  const [spec, setSpec] = useState<ActionSheetSpec | null>(null)
  const [closing, setClosing] = useState(false)
  const [place, setPlace] = useState<Placement | null>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const canEditNow = useRef(canEdit)
  canEditNow.current = canEdit

  useEffect(() => {
    listener = (s) => {
      // nothing a viewer may do and nothing to preview: don't open an empty menu
      const visible = s?.actions.filter((a) => canEditNow.current || !a.edit) ?? []
      if (s && !visible.length && !s.facts?.length && !s.spark && !s.note) return
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setClosing(false)
      setPlace(null)
      setSpec(s)
    }
    return () => {
      listener = null
    }
  }, [])

  const close = (then?: () => void) => {
    if (closing) return
    const done = () => {
      setSpec(null)
      setClosing(false)
      setPlace(null)
      if (then) then()
      else if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
    }
    if (reducedMotion()) return done()
    setClosing(true)
    window.setTimeout(done, EXIT_MS)
  }

  // Measure the pop-up, then place it next to the held item (before paint).
  useLayoutEffect(() => {
    if (!spec?.anchor || !sheet.current) return
    const p = placePopup(spec.anchor, { width: POP_W, height: sheet.current.offsetHeight }, { width: window.innerWidth, height: window.innerHeight })
    setPlace(p)
  }, [spec])

  useEffect(() => {
    if (!spec) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    sheet.current?.querySelector<HTMLElement>('.as-item')?.focus({ preventScroll: true })
    // a pop-up belongs to a spot on the screen: scrolling or resizing closes it
    const pop = !!spec.anchor
    const away = () => close()
    if (pop) {
      window.addEventListener('scroll', away, { passive: true })
      window.addEventListener('resize', away)
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', away)
      window.removeEventListener('resize', away)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, place])

  if (!spec) return null
  const actions = spec.actions.filter((a) => canEdit || !a.edit)
  const anchor = spec.anchor
  const pop = !!anchor
  const measuring = pop && !place

  const body = (
    <>
      {!pop && <div className="as-grab" aria-hidden="true" />}
      <div className="as-head">
        {spec.cover}
        <div className="as-head-text">
          <div className="as-title">{spec.title}</div>
          {spec.sub && <div className="as-sub">{spec.sub}</div>}
        </div>
      </div>
      {(spec.facts?.length || spec.spark) && (
        <div className="as-peek">
          {spec.spark && (
            <div className="as-fact as-spark">
              <Sparkline values={spec.spark.values} label={spec.spark.label} tone={spec.spark.tone} guide={spec.spark.guide} width={96} height={34} />
            </div>
          )}
          {spec.facts?.slice(0, 3).map((f) => (
            <div key={f.label} className="as-fact">
              <div className={`as-fact-value${f.tone ? ` ${f.tone}` : ''}`}>{f.value}</div>
              <div className="as-fact-label">{f.label}</div>
            </div>
          ))}
        </div>
      )}
      {spec.note && <p className="as-note">{spec.note}</p>}
      <div className="as-list">
        {actions.map((a, i) => (
          <button
            key={a.label}
            className={`as-item${a.danger ? ' danger' : ''}`}
            style={{ '--i': i } as CSSProperties}
            onClick={() => close(a.onSelect)}
          >
            <Icon name={a.icon} size={24} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </>
  )

  if (pop && anchor) {
    const style: CSSProperties = place
      ? { top: place.top, left: place.left, width: place.width, transformOrigin: `${place.originX}px ${place.originY}px` }
      : { top: 0, left: 0, width: Math.min(POP_W, window.innerWidth - 24), visibility: 'hidden' }
    return (
      <div className={`as-backdrop pop${closing ? ' out' : ''}`} onClick={() => close()} onContextMenu={(e) => e.preventDefault()}>
        <div
          className="as-spot"
          aria-hidden="true"
          style={{ top: anchor.top, left: anchor.left, width: anchor.width, height: anchor.height }}
        />
        <div
          ref={sheet}
          className={`as-pop${measuring ? '' : ' in'}${place ? ` ${place.mode}` : ''}${closing ? ' out' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={spec.title}
          style={style}
          onClick={(e) => e.stopPropagation()}
        >
          {body}
        </div>
      </div>
    )
  }

  return (
    <div className={`as-backdrop${closing ? ' out' : ''}`} onClick={() => close()}>
      <div
        ref={sheet}
        className={`as-sheet${closing ? ' out' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={spec.title}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('.as-grab, .as-head')) drag.current = { y: e.clientY, dy: 0 }
        }}
        onPointerMove={(e) => {
          if (!drag.current || !sheet.current) return
          drag.current.dy = Math.max(0, e.clientY - drag.current.y)
          sheet.current.style.transition = 'none'
          sheet.current.style.transform = `translateY(${drag.current.dy}px)`
        }}
        onPointerUp={() => {
          if (!drag.current || !sheet.current) return
          const far = drag.current.dy > 80
          sheet.current.style.transition = ''
          sheet.current.style.transform = ''
          drag.current = null
          if (far) close()
        }}
      >
        {body}
      </div>
    </div>
  )
}
