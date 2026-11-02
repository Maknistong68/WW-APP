import { useState, useRef } from 'react'
import Modal, { type ModalHandle } from './Modal'
import { showToast } from './Toast'
import { haptic } from '../lib/haptics'
import { saveRecord } from '../lib/records'
import { monthLabel, shortDate } from '../lib/dates'
import { CLOSEOUT_DAYS, closeoutState, closeoutText, defaultDue, hasAudit, withoutAudit } from '../lib/closeout'
import { DECLARATIONS, attendedPct, declState, meetingAttended, offboardingScore, setDecl, setOffboarding } from '../lib/kpi'
import type { Contractor, KpiMonth, Manpower } from '../types'

const num = (v: string): number | null => {
  const t = v.replace(/[^\d.]/g, '')
  if (t === '') return null
  return Number(t)
}
const str = (v: number | null) => (v === null || v === undefined ? '' : String(v))

function PctRow({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <input
        inputMode="decimal"
        placeholder="—"
        value={str(value)}
        onChange={(e) => {
          const n = num(e.target.value)
          onChange(n === null ? null : Math.min(100, n))
        }}
      />
      <span className="row-trail">%</span>
    </label>
  )
}

/** Yes / No answer; tap the picked one again to clear it (not answered). */
function YesNoRow({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const pick = (v: boolean) => {
    haptic('tick')
    onChange(value === v ? null : v)
  }
  return (
    <div className="row" role="group" aria-label={label}>
      <span className="row-main">{label}</span>
      <span className="yesno">
        <button type="button" className={`tog yes${value === true ? ' on' : ''}`} aria-pressed={value === true} onClick={() => pick(true)}>
          Yes
        </button>
        <button type="button" className={`tog no${value === false ? ' on' : ''}`} aria-pressed={value === false} onClick={() => pick(false)}>
          No
        </button>
      </span>
    </div>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row">
      <span className="row-main">{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}


/** Monthly scoring: only what the app can't work out itself. */
export default function KpiSheet({
  contractor,
  subjectLabel,
  kpi,
  auditPct,
  audit: openAudit = false,
  onClose,
}: {
  contractor: Contractor
  /** "Al Fahad · WO 882" — what is being scored. */
  subjectLabel: string
  kpi: KpiMonth
  auditPct: number | null
  /** Open with the quarterly audit switched on (from the audit's missing list). */
  audit?: boolean
  onClose: () => void
}) {
  const [k, setK] = useState(kpi)
  // The quarterly audit is optional each month: on only when this month has one.
  const [audit, setAudit] = useState(() => openAudit || hasAudit(kpi))
  const set = <F extends keyof KpiMonth>(f: F, v: KpiMonth[F]) => setK((p) => ({ ...p, [f]: v }))
  const closeout = closeoutState(k)
  // A typed score as typed; an older month's counts as a whole %.
  const off = offboardingScore(k)
  const offShown = k.offboardingPct ?? (off === null ? null : Math.round(off))

  const sheet = useRef<ModalHandle>(null)
  const save = async () => {
    if (audit && (k.auditClosed ?? 0) > (k.auditFindings ?? 0)) {
      return showToast({ text: 'Closed out can’t be more than the findings' })
    }
    await saveRecord('kpiMonths', audit ? k : withoutAudit(k), `${subjectLabel} · ${monthLabel(k.month)} KPIs`)
    haptic('success')
    showToast({ text: 'KPIs saved' })
    // slide the sheet away, then close
    if (sheet.current) sheet.current.close()
    else onClose()
  }

  return (
    <Modal
      ref={sheet}
      title={`${monthLabel(k.month)} · ${subjectLabel.replace(`${contractor.name} · `, '')}`}
      onClose={onClose}
      header={
        <button className="nav-btn strong" onClick={() => void save()}>
          Save
        </button>
      }
    >
      <div className="sheet-body">
        <div className="section-label">Submitted</div>
        <div className="list">
          {DECLARATIONS.map((x) => (
            <YesNoRow key={x.key} label={x.label} value={declState(k, x.key)} onChange={(v) => setK((p) => setDecl(p, x.key, v))} />
          ))}
        </div>
        <div className="list-foot">No = they can’t provide it. It isn’t chased or counted against them.</div>
        <div className="section-label">Scores</div>
        <div className="list">
          <PctRow label="Accommodation" value={k.accommodationPct} onChange={(v) => set('accommodationPct', v)} />
          <PctRow label="Onboarding" value={k.onboardingPct} onChange={(v) => set('onboardingPct', v)} />
          <PctRow label="Offboarding" value={offShown} onChange={(v) => setK((p) => setOffboarding(p, v))} />
          <YesNoRow label="Meeting attended" value={meetingAttended(k.meetingPct)} onChange={(v) => set('meetingPct', attendedPct(v))} />
        </div>
        {k.accommodationPct === null && auditPct !== null && (
          <div className="list-foot">Accommodation empty → uses this month’s audit: {auditPct}%</div>
        )}
        <div className="section-label">Quarterly audit</div>
        <div className="list">
          <Toggle label="Audit this month" on={audit} onChange={setAudit} />
          {audit && (
            <>
              <PctRow label="Audit score" value={k.quarterlyAuditPct} onChange={(v) => set('quarterlyAuditPct', v)} />
              <label className="row">
                <span className="row-label">Audit date</span>
                <input
                  type="date"
                  value={k.auditDate ?? ''}
                  onChange={(e) => {
                    const date = e.target.value
                    // Keep the due date following the audit date until it is changed by hand.
                    const autoDue = !k.auditDueDate || k.auditDueDate === defaultDue(k.auditDate ?? '')
                    setK((p) => ({ ...p, auditDate: date, ...(autoDue ? { auditDueDate: defaultDue(date) } : {}) }))
                  }}
                />
              </label>
              <label className="row">
                <span className="row-label">Findings</span>
                <input inputMode="numeric" placeholder="—" value={str(k.auditFindings ?? null)} onChange={(e) => set('auditFindings', num(e.target.value))} />
              </label>
              <label className="row">
                <span className="row-label">Closed out</span>
                <input inputMode="numeric" placeholder="—" value={str(k.auditClosed ?? null)} onChange={(e) => set('auditClosed', num(e.target.value))} />
              </label>
              <label className="row">
                <span className="row-label">Due by</span>
                <input type="date" value={k.auditDueDate ?? ''} onChange={(e) => set('auditDueDate', e.target.value)} />
              </label>
            </>
          )}
        </div>
        {audit &&
          (closeout ? (
            <div className="list-foot">
              <span className={`status-dot ${closeout.status === 'closed' ? 'good' : closeout.status === 'open' ? '' : closeout.status === 'due' ? 'warn' : 'bad'}`} />{' '}
              {closeoutText(closeout, shortDate)}
            </div>
          ) : (
            <div className="list-foot">Close-out due {CLOSEOUT_DAYS} days after the audit unless you change it.</div>
          ))}
        <div className="list-foot">Grievance, ticket closure and formal vs illegal are calculated automatically.</div>
      </div>
    </Modal>
  )
}


/** Manpower declaration as counts only — no names or ID numbers. */
export function ManpowerSheet({
  subjectLabel,
  record,
  onClose,
}: {
  subjectLabel: string
  record: Manpower
  onClose: () => void
}) {
  const [m, setM] = useState(record)
  const field = (label: string, f: 'totalWorkers' | 'illegalOrFreelance' | 'visaExpiring30d' | 'paidRecruitmentFees') => (
    <label className="row">
      <span className="row-label">{label}</span>
      <input inputMode="numeric" value={String(m[f])} onChange={(e) => setM({ ...m, [f]: num(e.target.value) ?? 0 })} />
    </label>
  )
  const sheet = useRef<ModalHandle>(null)
  const save = async () => {
    const over = (['illegalOrFreelance', 'visaExpiring30d', 'paidRecruitmentFees'] as const).some((f) => m[f] > m.totalWorkers)
    if (over) return showToast({ text: 'Counts can’t be more than total workers' })
    await saveRecord('manpower', m, `${subjectLabel} · ${monthLabel(m.month)} manpower`)
    haptic('success')
    showToast({ text: 'Manpower saved' })
    if (sheet.current) sheet.current.close()
    else onClose()
  }
  return (
    <Modal
      ref={sheet}
      title={`${monthLabel(m.month)} manpower · ${subjectLabel}`}
      onClose={onClose}
      header={
        <button className="nav-btn strong" onClick={() => void save()}>
          Save
        </button>
      }
    >
      <div className="sheet-body">
        <div className="list">
          {field('Total workers', 'totalWorkers')}
          {field('Illegal / freelance', 'illegalOrFreelance')}
          {field('Visas expiring ≤30 days', 'visaExpiring30d')}
          {field('Paid recruitment fees', 'paidRecruitmentFees')}
        </div>
        <div className="list-foot">Counts only. Keep names, Iqama and passport numbers out of the app.</div>
      </div>
    </Modal>
  )
}

export { emptyKpi, emptyManpower } from '../lib/subjects'
