import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { monthLabel } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { STATUS_LABEL, kpiStatus } from '../lib/kpi'
import type { CompareRow } from '../lib/compare'
import { kpiTone } from '../lib/tone'
import { useLongPress } from '../lib/useLongPress'

const short = (m: string) => monthLabel(m).slice(0, 3)

function NameCell({ r, onOpen, onHold }: { r: CompareRow; onOpen: () => void; onHold?: () => void }) {
  const press = useLongPress(onHold)
  return (
    <button className="cmp-name" role="rowheader" onClick={onOpen} title={r.label} {...press}>
      <span className="cmp-label">{r.label}</span>
      {r.change !== null && r.change !== 0 && (
        <span className={`cmp-change ${r.change > 0 ? 'up' : 'down'}`}>
          {r.change > 0 ? '▲' : '▼'}
          {Math.abs(r.change)}
        </span>
      )}
    </button>
  )
}

/**
 * Contractors (or work orders) down the side, months across; each cell shows
 * the % on its status colour. Tap a cell: it lights up and a callout offers
 * Open; tap a name for its trends; hold a name for its pop-up.
 */
export default function CompareGrid({
  rows,
  months,
  averages,
  onOpenCell,
  onOpenRow,
  onHoldRow,
  label,
}: {
  rows: CompareRow[]
  months: string[]
  /** A footer row of monthly averages. */
  averages?: (number | null)[]
  onOpenCell: (row: CompareRow, month: string) => void
  onOpenRow: (row: CompareRow) => void
  onHoldRow?: (row: CompareRow) => void
  /** What the grid shows, for screen readers ("Overall KPI by contractor"). */
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState<{ key: string; i: number } | null>(null)

  // Open on the newest months; older ones are a swipe to the left.
  const span = `${months[0]}…${months[months.length - 1]}`
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [span, rows.length])

  // A tap outside the grid lets go of the selected cell.
  useEffect(() => {
    if (!sel) return
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setSel(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [sel])

  const picked = sel ? rows.find((r) => r.key === sel.key) : undefined
  const pickedValue = picked && sel ? picked.values[sel.i] : null
  const cols = { '--cols': months.length } as CSSProperties

  return (
    <div className="cmp" ref={ref}>
      <div className="cmp-scroll" ref={scroller}>
        <div className="cmp-grid" role="grid" aria-label={label} style={cols}>
          <div className="cmp-row cmp-head" role="row">
            <span className="cmp-name" role="columnheader" />
            {months.map((m) => (
              <span key={m} className="cmp-mon" role="columnheader">
                {short(m)}
              </span>
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.key} className="cmp-row" role="row">
              <NameCell r={r} onOpen={() => onOpenRow(r)} onHold={onHoldRow ? () => onHoldRow(r) : undefined} />
              {r.values.map((v, i) => {
                const st = kpiStatus(v)
                const on = sel?.key === r.key && sel.i === i
                return (
                  <button
                    key={months[i]}
                    role="gridcell"
                    className={`cmp-cell ${kpiTone(st)}${on ? ' sel' : ''}`}
                    aria-label={`${r.label}, ${monthLabel(months[i])}, ${v === null ? 'no data' : `${v}%, ${STATUS_LABEL[st]}`}`}
                    aria-selected={on}
                    onClick={() => {
                      if (on) return onOpenCell(r, months[i])
                      haptic('tick')
                      setSel({ key: r.key, i })
                    }}
                  >
                    {v === null ? '–' : v}
                  </button>
                )
              })}
            </div>
          ))}
          {averages && (
            <div className="cmp-row cmp-avg" role="row">
              <span className="cmp-name" role="rowheader">
                <span className="cmp-label">Average</span>
              </span>
              {averages.map((a, i) => (
                <span key={months[i]} className="cmp-cell plain" role="gridcell">
                  {a ?? '–'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {picked && sel && (
        <div key={`${sel.key}-${sel.i}`} className="cmp-callout" role="status">
          <span>
            <b>{picked.label}</b> · {monthLabel(months[sel.i])} ·{' '}
            {pickedValue === null ? 'no data' : `${pickedValue}% ${STATUS_LABEL[kpiStatus(pickedValue)]}`}
          </span>
          <button className="chart-open" onClick={() => onOpenCell(picked, months[sel.i])}>
            Open ›
          </button>
        </div>
      )}
    </div>
  )
}
