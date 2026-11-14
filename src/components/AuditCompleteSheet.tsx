import { useMemo, useRef, useState } from 'react'
import Modal, { type ModalHandle } from './Modal'
import Icon from './Icon'
import StatusChip from './StatusChip'
import { db, logEvent } from '../db'
import { quarterOf } from '../lib/audits'
import { withoutAudit } from '../lib/closeout'
import { dayMonth, monthLabel } from '../lib/dates'
import { kpiStatus, pct } from '../lib/kpi'
import { useAllData } from '../lib/kpiData'
import { saveRecord } from '../lib/records'
import { gradeOf, scoreInspection, scoreText } from '../lib/score'
import { emptyKpi } from '../lib/subjects'
import { kpiTone } from '../lib/tone'
import { useSave } from '../lib/useSave'
import { auditKpiPlan, scoresOnly, withAudit, type AuditKpiPlan } from '../lib/welfareAudit'
import type { Inspection, InspectionTemplate } from '../types'

/** Writes the audit into its work order's quarterly audit KPI (and clears a typed score it replaces in another month). */
export async function saveAuditToKpi(plan: AuditKpiPlan, auditUuid: string, label: string) {
  const at = (month: string) =>
    db.kpiMonths.where('[contractorUuid+workOrderUuid+month]').equals([plan.contractorUuid, plan.workOrderUuid, month]).first()
  const fresh = await at(plan.month)
  await saveRecord('kpiMonths', withAudit(fresh ?? emptyKpi(plan.contractorUuid, plan.workOrderUuid, plan.month), plan, auditUuid), `${label} · ${monthLabel(plan.month)} quarterly audit`)
  if (plan.replaces && plan.replaces.month !== plan.month) {
    const other = await at(plan.replaces.month)
    if (other) await saveRecord('kpiMonths', withoutAudit(other), `${label} · ${monthLabel(other.month)} quarterly audit moved to ${monthLabel(plan.month)}`)
  }
}

/**
 * The audit becomes its scores only (`scoresOnly`): the answers, notes and
 * names go, and its photos are deleted here and, at the next sync, from the
 * cloud and the other devices. Returns the kept record.
 */
export async function keepScoresOnly(audit: Inspection, template: InspectionTemplate): Promise<Inspection> {
  const kept = scoresOnly(audit, template, new Date().toISOString())
  if (!kept || audit.id === undefined) throw new Error('Answer at least one question first.')
  await db.transaction('rw', db.inspections, db.photos, db.tombstones, async () => {
    for (const p of await db.photos.where('inspectionId').equals(audit.id!).toArray()) {
      if (p.uuid) await db.tombstones.add({ table: 'photos', uuid: p.uuid })
    }
    await db.photos.where('inspectionId').equals(audit.id!).delete()
    await db.inspections.put(kept)
  })
  logEvent(audit.id, 'Audit details cleared', 'Scores kept; answers, notes and photos deleted')
  return kept
}

/**
 * Finishing a Worker Welfare audit: the score, grade and findings, what's still
 * missing (unanswered, a "No" without a comment), and the quarterly audit KPI
 * it fills for its work order (score, date, findings, close-out due in 30 days).
 */
export default function AuditCompleteSheet({
  template,
  audit,
  onShow,
  onExcel,
  onComplete,
  onClose,
}: {
  template: InspectionTemplate
  audit: Inspection
  /** Show the unanswered questions, or the Nos without a comment. */
  onShow: (what: 'unanswered' | 'flagged') => void
  /** Download the Excel report (before the details are cleared). */
  onExcel: () => Promise<void>
  /** Finished: the audit is now its scores only. */
  onComplete: (kept: Inspection) => void
  onClose: () => void
}) {
  const d = useAllData()
  const ref = useRef<ModalHandle>(null)
  const [toKpi, setToKpi] = useState(true)
  const score = useMemo(() => scoreInspection(template, audit), [template, audit])
  const plan = useMemo(() => (d.loaded ? auditKpiPlan(audit, d) : null), [audit, d])
  const responses = Object.values(audit.responses)
  const nos = responses.filter((r) => r.assessment === 'No compliance')
  const noComment = nos.filter((r) => !r.observation.trim()).length
  const unanswered = score.total - score.answered
  const low = (score.sections ?? []).filter((s) => s.pct !== null && s.pct < 70)
  const wo = audit.info.workOrderUuid ? d.woByUuid.get(audit.info.workOrderUuid) : undefined
  const label = `${audit.info.contractorNames}${wo ? ` · WO ${wo.number}` : ''}`
  const { saving, run, alert } = useSave('Finish audit')
  const [excel, setExcel] = useState<'' | 'making' | 'done'>('')
  let kept: Inspection | null = null

  const finish = () =>
    void run(async () => {
      if (toKpi && plan && audit.uuid) await saveAuditToKpi(plan, audit.uuid, label)
      kept = await keepScoresOnly(audit, template)
    }).then((ok) => {
      if (!ok || !kept) return
      const done = kept
      ref.current?.close(() => onComplete(done))
    })

  const downloadExcel = () => {
    setExcel('making')
    void onExcel().then(
      () => setExcel('done'),
      () => setExcel(''),
    )
  }

  return (
    <Modal ref={ref} title="Finish the audit" onClose={onClose} alert={alert}>
      <div className="sheet-body audit-done">
        <div className="audit-score">
          <span className={`audit-score-num ${kpiTone(kpiStatus(score.pct))}`}>{scoreText(score.pct)}</span>
          <span className="audit-score-grade">{gradeOf(score.pct) || 'Not scored yet'}</span>
          <span className="audit-score-sub">
            {nos.length} finding{nos.length === 1 ? '' : 's'} (No) · {score.answered} of {score.total} answered
          </span>
        </div>

        {(unanswered > 0 || noComment > 0) && (
          <div className="audit-missing">
            {unanswered > 0 && (
              <button type="button" className="row" onClick={() => onShow('unanswered')}>
                <span className="row-main">
                  <div className="row-title">{unanswered} not answered</div>
                  <div className="row-sub">They don’t count in the score. Tap to answer them.</div>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            )}
            {noComment > 0 && (
              <button type="button" className="row" onClick={() => onShow('flagged')}>
                <span className="row-main">
                  <div className="row-title">
                    {noComment} “No” without a comment
                  </div>
                  <div className="row-sub">The report’s findings need one. Tap to add them.</div>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            )}
          </div>
        )}

        {low.length > 0 && (
          <>
            <div className="control-label">Below 70%</div>
            <div className="audit-low">
              {low.map((s) => (
                <StatusChip key={s.letter} tone={kpiTone(kpiStatus(s.pct))}>
                  {s.letter} · {s.title} {pct(s.pct)}
                </StatusChip>
              ))}
            </div>
          </>
        )}

        {plan ? (
          <label className="audit-kpi">
            <input type="checkbox" role="switch" checked={toKpi} onChange={(e) => setToKpi(e.target.checked)} />
            <span>
              <b>
                Save to {wo ? `WO ${wo.number}` : audit.info.contractorNames}’s {quarterOf(plan.month).label} audit
              </b>
              <span>
                {scoreText(plan.pct)} · {plan.findings} finding{plan.findings === 1 ? '' : 's'} · close-out due {dayMonth(plan.dueDate)}
                {plan.replaces ? `. Replaces the ${pct(plan.replaces.pct)} typed for ${monthLabel(plan.replaces.month)}.` : ''}
              </span>
            </span>
          </label>
        ) : (
          <p className="note">Not linked to a quarterly audit: pick the work order and audit date in the audit’s details to link it.</p>
        )}

        <div className="control-label">Before you finish</div>
        <div className="list audit-excel">
          <button type="button" className="row" disabled={excel === 'making'} onClick={downloadExcel}>
            <span className="row-main">
              <div className="row-title">{excel === 'making' ? 'Making the Excel…' : excel === 'done' ? 'Excel report downloaded' : 'Download the Excel report'}</div>
              <div className="row-sub">{excel === 'done' ? 'Tap to download it again.' : 'To send it. It can’t be made after.'}</div>
            </span>
            <span className={excel === 'done' ? 'done-mark' : 'row-chev'}>
              <Icon name={excel === 'done' ? 'check-circle' : 'download'} size={20} fill={excel === 'done'} />
            </span>
          </button>
        </div>
        <p className="note audit-keep">
          Finishing keeps the scores only: the final score, grade, each section’s score and the number of findings. The answers, notes
          and photos are deleted from this device, your other devices and the cloud.
        </p>

        <div className="btn-row">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Not yet
          </button>
          <button type="button" className="btn primary" disabled={saving || score.pct === null} onClick={finish}>
            <Icon name="check" size={19} /> {saving ? 'Finishing…' : 'Finish'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
