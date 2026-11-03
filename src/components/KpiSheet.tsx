import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import Icon from './Icon'
import StatusChip from './StatusChip'
import SubmissionSheet, { docChip, loadDocs } from './SubmissionSheet'
import { useSave } from '../lib/useSave'
import { markSeen } from '../lib/onboarding'
import SaveButton from './SaveButton'
import Modal, { type ModalHandle } from './Modal'
import { showToast } from './Toast'
import { haptic } from '../lib/haptics'
import { PctRow, YesNoRow, count, str } from './Inputs'
import { MANPOWER_FIELDS, applyKpiChanges, mergeEdited } from '../lib/merge'
import { saveRecord } from '../lib/records'
import { localDate, monthLabel, shortDate } from '../lib/dates'
import { declarationsDue } from '../lib/due'
import { allSettled, awaitedItems, shortList, submissionCounts } from '../lib/submissions'
import { emptyKpi } from '../lib/subjects'
import { CLOSEOUT_DAYS, closeoutState, closeoutText, hasAudit, setAuditDate } from '../lib/closeout'
import { attendedPct, meetingAttended, offboardingScore, setOffboarding } from '../lib/kpi'
import type { Contractor, KpiMonth, Manpower } from '../types'

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
  // The copy as opened: only what is changed against it is saved (src/lib/merge.ts).
  const [opened] = useState(kpi)
  const [k, setK] = useState(kpi)
  // The quarterly audit is optional each month: on only when this month has one.
  const [audit, setAudit] = useState(() => openAudit || hasAudit(kpi))
  const set = <F extends keyof KpiMonth>(f: F, v: KpiMonth[F]) => setK((p) => ({ ...p, [f]: v }))
  const closeout = closeoutState(k)
  // A typed score as typed; an older month's counts as a whole %.
  const off = offboardingScore(k)
  const offShown = k.offboardingPct ?? (off === null ? null : Math.round(off))

  // The documents live in their own panel; this one shows where they stand, kept fresh.
  const [docsOpen, setDocsOpen] = useState(false)
  const docs = useLiveQuery(() => loadDocs(k.contractorUuid, k.workOrderUuid, k.month), [k.contractorUuid, k.workOrderUuid, k.month])
  const docCount = docs ? submissionCounts(docs.kpi, docs.prev) : null
  const docWaiting = docs ? awaitedItems(docs.kpi, docs.prev) : []
  const docTone = docs && allSettled(docs.kpi, docs.prev) ? docChip('in', undefined, '', '') : docChip('awaited', undefined, declarationsDue(k.month), localDate())

  const sheet = useRef<ModalHandle>(null)
  const { saving, alert, run } = useSave(`${subjectLabel} KPIs`)
  const save = () =>
    run(async () => {
      if (audit && (k.auditClosed ?? 0) > (k.auditFindings ?? 0)) {
        return 'Closed out can’t be more than the findings'
      }
      // Only what was changed here, over a fresh copy: the documents (their own panel) and a
      // teammate's answers saved meanwhile are kept.
      const fresh = await db.kpiMonths.where('[contractorUuid+workOrderUuid+month]').equals([k.contractorUuid, k.workOrderUuid, k.month]).first()
      await saveRecord('kpiMonths', applyKpiChanges(fresh ?? opened, opened, k, audit), `${subjectLabel} · ${monthLabel(k.month)} KPIs`)
      haptic('success')
      markSeen('kpi')
      showToast({ text: 'KPIs saved' })
      // slide the sheet away, then close
      if (sheet.current) sheet.current.close()
      else onClose()
    })

  return (
    <>
    <Modal
      ref={sheet}
      title={`${monthLabel(k.month)} · ${subjectLabel.replace(`${contractor.name} · `, '')}`}
      onClose={onClose}
      alert={alert}
      header={
        <SaveButton saving={saving} onClick={() => void save()}>
          Save
        </SaveButton>
      }
    >
      <div className="sheet-body">
        <div className="list-foot" style={{ marginTop: 0, overflowWrap: 'anywhere' }}>
          {subjectLabel.startsWith(contractor.name) ? subjectLabel : `${contractor.name} · ${subjectLabel}`}
        </div>
        <div className="section-label">Submitted</div>
        <div className="list">
          <button className="row" onClick={() => setDocsOpen(true)}>
            <span className="row-main">
              <div className="row-title">Documents</div>
              <div className="row-sub">
                {!docCount ? '…' : docWaiting.length ? `${docCount.in} of ${docCount.required} in · ${shortList(docWaiting)} waiting` : `All ${docCount.required} in`}
              </div>
            </span>
            {docCount && (
              <StatusChip tone={docTone.tone} icon={docTone.icon}>
                {docWaiting.length ? `${docCount.in}/${docCount.required}` : 'All in'}
              </StatusChip>
            )}
            <Icon name="chevron-right" size={18} className="row-chev" />
          </button>
        </div>
        <div className="list-foot">The score counts WPS, Manpower register and Salary; ones they can’t provide are left out.</div>
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
                    // the due date follows the audit date until it is changed by hand
                    setK((p) => setAuditDate(p, date))
                  }}
                />
              </label>
              <label className="row">
                <span className="row-label">Findings</span>
                <input inputMode="numeric" placeholder="—" value={str(k.auditFindings ?? null)} onChange={(e) => set('auditFindings', count(e.target.value))} />
              </label>
              <label className="row">
                <span className="row-label">Closed out</span>
                <input inputMode="numeric" placeholder="—" value={str(k.auditClosed ?? null)} onChange={(e) => set('auditClosed', count(e.target.value))} />
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
    {docsOpen && docs && (
      <SubmissionSheet
        subjectLabel={subjectLabel}
        kpi={docs.kpi ?? { ...emptyKpi(k.contractorUuid, k.workOrderUuid, k.month), uuid: k.uuid }}
        prev={docs.prev}
        onClose={() => setDocsOpen(false)}
      />
    )}
    </>
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
  const [opened] = useState(record)
  const [m, setM] = useState(record)
  const field = (label: string, f: 'totalWorkers' | 'illegalOrFreelance' | 'visaExpiring30d' | 'paidRecruitmentFees') => (
    <label className="row">
      <span className="row-label">{label}</span>
      <input inputMode="numeric" value={String(m[f])} onChange={(e) => setM({ ...m, [f]: count(e.target.value) ?? 0 })} />
    </label>
  )
  const sheet = useRef<ModalHandle>(null)
  const { saving, alert, run } = useSave(`${subjectLabel} manpower`)
  const save = () =>
    run(async () => {
      // Only the counts changed here, over a fresh copy (a teammate's other counts are kept).
      const fresh = await db.manpower.where('[contractorUuid+workOrderUuid+month]').equals([m.contractorUuid, m.workOrderUuid, m.month]).first()
      const out = mergeEdited(fresh ?? opened, opened, m, MANPOWER_FIELDS)
      const over = (['illegalOrFreelance', 'visaExpiring30d', 'paidRecruitmentFees'] as const).some((f) => out[f] > out.totalWorkers)
      if (over) return 'Counts can’t be more than total workers'
      await saveRecord('manpower', out, `${subjectLabel} · ${monthLabel(m.month)} manpower`)
      haptic('success')
      showToast({ text: 'Manpower saved' })
      if (sheet.current) sheet.current.close()
      else onClose()
    })
  return (
    <Modal
      ref={sheet}
      title={`${monthLabel(m.month)} manpower · ${subjectLabel}`}
      onClose={onClose}
      alert={alert}
      header={
        <SaveButton saving={saving} onClick={() => void save()}>
          Save
        </SaveButton>
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
