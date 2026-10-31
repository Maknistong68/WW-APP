import { useState } from 'react'
import Icon from './Icon'
import KpiSheet, { ManpowerSheet } from './KpiSheet'
import { addMonths, monthLabel, monthOf } from '../lib/dates'
import { auditPctFor, type AllData } from '../lib/kpiData'
import { emptyKpi, emptyManpower, subjectKpi, subjectManpower, woOf, type KpiSubject } from '../lib/subjects'

/** ‹ Oct 2026 › — no months in the future. */
export function MonthStepper({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="segmented" style={{ gridTemplateColumns: '44px 1fr 44px', display: 'grid', gridAutoFlow: 'unset' }}>
      <button aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>
        ‹
      </button>
      <button className="on">{monthLabel(month)}</button>
      <button aria-label="Next month" disabled={month >= monthOf()} onClick={() => onChange(addMonths(month, 1))}>
        ›
      </button>
    </div>
  )
}

export interface SubjectRow {
  s: KpiSubject
  done: boolean
  /** What is entered so far. */
  value?: string
}

/** Searchable list of work orders / contractors: red dot = still missing, ✓ = entered. */
export function SubjectList({
  rows,
  onPick,
  search = true,
}: {
  rows: SubjectRow[]
  onPick?: (s: KpiSubject) => void
  search?: boolean
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((r) => r.s.label.toLowerCase().includes(q)) : rows
  return (
    <>
      {search && rows.length > 8 && (
        <label className="ios-search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Contractor or WO" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}
      {shown.length === 0 ? (
        <div className="list-foot">{rows.length ? 'Nothing matches.' : 'No active work orders.'}</div>
      ) : (
        <div className="list">
          {shown.map(({ s, done, value }) => (
            <button key={s.key} className="row" disabled={!onPick} onClick={() => onPick?.(s)}>
              {done ? (
                <span style={{ color: 'var(--green)', display: 'inline-flex' }} aria-label="Entered">
                  <Icon name="check" size={18} strokeWidth={2.5} />
                </span>
              ) : (
                <span className="status-dot bad" aria-label="Missing" />
              )}
              <span className="row-main">
                <div className="row-title">{s.label}</div>
                {value ? <div className="row-sub">{value}</div> : !done && <div className="row-sub">Not entered</div>}
              </span>
              {onPick && (
                <span className="row-chev">
                  <Icon name="chevron-right" size={18} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/** Opens the right sheet (KPIs or manpower) for one subject and month. */
export function SubjectEditor({
  d,
  subject,
  month,
  sheet,
  onClose,
}: {
  d: AllData
  subject: KpiSubject
  month: string
  sheet: 'kpi' | 'manpower'
  onClose: () => void
}) {
  const wo = woOf(subject)
  if (sheet === 'manpower') {
    return (
      <ManpowerSheet
        subjectLabel={subject.label}
        record={subjectManpower(subject, d.manpower, month) ?? emptyManpower(subject.contractor.uuid, wo, month)}
        onClose={onClose}
      />
    )
  }
  return (
    <KpiSheet
      contractor={subject.contractor}
      subjectLabel={subject.label}
      kpi={subjectKpi(subject, d.kpis, month) ?? emptyKpi(subject.contractor.uuid, wo, month)}
      auditPct={auditPctFor(subject.contractor, d.inspections, month)}
      onClose={onClose}
    />
  )
}
