import { useMemo, useRef, useState } from 'react'
import Modal, { type ModalHandle } from './Modal'
import Icon from './Icon'
import StatusChip from './StatusChip'
import { db } from '../db'
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
import { auditKpiPlan, withAudit, type AuditKpiPlan } from '../lib/welfareAudit'
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
 * Finishing a Worker Welfare audit: the score, grade and findings, what's still
 * missing (unanswered, a "No" without a comment), and the quarterly audit KPI
 * it fills for its work order (score, date, findings, close-out due in 30 days).
 */
export default function AuditCompleteSheet({
  template,
  audit,
  onShow,
  onComplete,
  onClose,
}: {
  template: InspectionTemplate
  audit: Inspection
  /** Show the unanswered questions, or the Nos without a comment. */
  onShow: (what: 'unanswered' | 'flagged') => void
  onComplete: () => void
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
  const { saving, run, alert } = useSave('Quarterly audit')

  const complete = () =>
    void run(async () => {
      if (toKpi && plan && audit.uuid) await saveAuditToKpi(plan, audit.uuid, label)
    }).then((ok) => {
      if (!ok) return
      onComplete()
      ref.current?.close()
    })

  return (
    <Modal ref={ref} title="Complete the audit" onClose={onClose} alert={alert}>
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

        <div className="btn-row">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Not yet
          </button>
          <button type="button" className="btn primary" disabled={saving} onClick={complete}>
            <Icon name="check" size={19} /> {saving ? 'Saving…' : 'Complete audit'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
