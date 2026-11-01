import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import { EXIT_MS, reducedMotion } from '../lib/motion'

export interface SheetAction {
  label: string
  icon: IconName
  onSelect: () => void
  danger?: boolean
  /** Hidden for read-only (viewer) accounts. */
  edit?: boolean
}

export interface ActionSheetSpec {
  title: string
  sub?: string
  /** Cover art or any small visual for the header. */
  cover?: ReactNode
  /** Extra line(s) under the header, e.g. what a Home card means. */
  note?: string
  actions: SheetAction[]
}

type Listener = (s: ActionSheetSpec | null) => void
let listener: Listener | null = null

/** Open the quick-action sheet (long-press / ⋯) from anywhere. */
export function showActions(spec: ActionSheetSpec) {
  listener?.(spec)
}

/** One host near the root renders the sheet. */
export default function ActionSheetHost({ canEdit }: { canEdit: boolean }) {
  const [spec, setSpec] = useState<ActionSheetSpec | null>(null)
  const [closing, setClosing] = useState(false)
  const drag = useRef<{ y: number; dy: number } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listener = (s) => {
      setClosing(false)
      setSpec(s)
    }
    return () => {
      listener = null
    }
  }, [])

  useEffect(() => {
    if (!spec) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    sheet.current?.querySelector<HTMLElement>('button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec])

  const close = (then?: () => void) => {
    if (closing) return
    const done = () => {
      setSpec(null)
      setClosing(false)
      then?.()
    }
    if (reducedMotion()) return done()
    setClosing(true)
    window.setTimeout(done, EXIT_MS)
  }

  if (!spec) return null
  const actions = spec.actions.filter((a) => canEdit || !a.edit)
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
        <div className="as-grab" aria-hidden="true" />
        <div className="as-head">
          {spec.cover}
          <div className="as-head-text">
            <div className="as-title">{spec.title}</div>
            {spec.sub && <div className="as-sub">{spec.sub}</div>}
          </div>
        </div>
        {spec.note && <p className="as-note">{spec.note}</p>}
        <div className="as-list">
          {actions.map((a) => (
            <button key={a.label} className={`as-item${a.danger ? ' danger' : ''}`} onClick={() => close(a.onSelect)}>
              <Icon name={a.icon} size={24} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
