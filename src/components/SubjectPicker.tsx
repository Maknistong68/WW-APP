import { useState } from 'react'
import Icon from './Icon'
import IconTile from './IconTile'
import StatusChip from './StatusChip'
import ItemRow from './ItemRow'
import CardList from './CardList'
import KpiSheet, { ManpowerSheet } from './KpiSheet'
import SubmissionSheet from './SubmissionSheet'
import { addMonths, monthLabel, monthOf } from '../lib/dates'
import { auditPctFor, type AllData } from '../lib/kpiData'
import { emptyKpi, emptyManpower, subjectKpi, subjectManpower, subjectPrior, woOf, type KpiSubject } from '../lib/subjects'
import { kpiTone } from '../lib/tone'
import type { WoScore } from '../lib/woScore'

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
  /** The month's KPI score and its change against last month (shown on the right). */
  score?: WoScore
  /** How much of the month is entered, 0–1 (a thin bar under the line). */
  pct?: number
}

/** "86%" in its status colour, with ▲ 4 / ▼ 6 against last month under it. */
export function ScoreTrail({ score }: { score: WoScore }) {
  const { pct, change } = score
  const dir = change === null ? null : change > 0 ? 'up' : change < 0 ? 'down' : 'same'
  return (
    <span className="score-trail" aria-label={pct === null ? 'No score' : `Score ${pct}%${change === null ? '' : `, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)} from last month`}`}>
      <span className={`score-pct ${kpiTone(score.status)}`}>{pct === null ? '—' : `${pct}%`}</span>
      {dir && (
        <span className={`score-change ${dir}`} aria-hidden="true">
          {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '='} {Math.abs(change!)}
        </span>
      )}
    </span>
  )
}

/** Searchable list of work orders / contractors: red dot = still missing, ✓ = entered. */
export function SubjectList({
  rows,
  onPick,
  onMore,
  search = true,
  chip = true,
}: {
  rows: SubjectRow[]
  onPick?: (s: KpiSubject) => void
  /** Long-press / ⋯ on a row. */
  onMore?: (s: KpiSubject) => void
  search?: boolean
  /** The Done / Missing chip (off: the tile's colour says it, the name gets the room). */
  chip?: boolean
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((r) => r.s.label.toLowerCase().includes(q)) : rows
  return (
    <>
      {search && rows.length > 8 && (
        <label className="ios-search">
          <Icon name="search" size={18} />
          <input type="search" aria-label="Search work orders" placeholder="Contractor or WO" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}
      {shown.length === 0 ? (
        <div className="list-foot">{rows.length ? 'Nothing matches.' : 'No active work orders.'}</div>
      ) : (
        <CardList>
          {shown.map(({ s, done, value, score, pct }) => (
            <ItemRow
              key={s.key}
              tile={<IconTile text={s.contractor.name} tone={done ? 'good' : 'bad'} size={52} />}
              title={s.label}
              sub={
                pct === undefined ? (
                  value || (done ? 'Entered' : 'Not entered')
                ) : (
                  <>
                    <span className="entry-sub-text">{value || (done ? 'Entered' : 'Not entered')}</span>
                    <span className={`entry-bar${done ? ' done' : ''}`} role="presentation">
                      <span style={{ width: `${Math.round(pct * 100)}%` }} />
                    </span>
                  </>
                )
              }
              wrap={!chip}
              trail={
                score ? <ScoreTrail score={score} /> : chip ? done ? <StatusChip tone="good">Done</StatusChip> : <StatusChip tone="bad">Missing</StatusChip> : undefined
              }
              onOpen={onPick ? () => onPick(s) : undefined}
              onMore={
                onMore
                  ? () => onMore(s)
                  : undefined
              }
            />
          ))}
        </CardList>
      )}
    </>
  )
}

/** Opens the right sheet (KPIs, documents or manpower) for one subject and month. */
export function SubjectEditor({
  d,
  subject,
  month,
  sheet,
  audit,
  onClose,
}: {
  d: AllData
  subject: KpiSubject
  month: string
  sheet: 'kpi' | 'manpower' | 'submission'
  /** KPI sheet: open with the quarterly audit switched on. */
  audit?: boolean
  onClose: () => void
}) {
  const wo = woOf(subject)
  if (sheet === 'submission') {
    return (
      <SubmissionSheet
        subjectLabel={subject.label}
        kpi={subjectKpi(subject, d.kpis, month) ?? emptyKpi(subject.contractor.uuid, wo, month)}
        prev={subjectPrior(subject, d.kpis, month)}
        onClose={onClose}
      />
    )
  }
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
      auditPct={auditPctFor(subject.contractor, d.inspections, month, d.camps)}
      audit={audit}
      onClose={onClose}
    />
  )
}
