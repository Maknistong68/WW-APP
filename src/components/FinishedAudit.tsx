import { useNavigate } from 'react-router-dom'
import Page from './Page'
import Icon from './Icon'
import Summary from './Summary'
import IconTile from './IconTile'
import StatusChip from './StatusChip'
import ActionBar from './ActionBar'
import { useAuthInfo } from '../lib/auth'
import { useAllData } from '../lib/kpiData'
import { kpiStatus, pct } from '../lib/kpi'
import { kpiTone } from '../lib/tone'
import { monthOf, shortDate } from '../lib/dates'
import { quarterOf } from '../lib/audits'
import { scoreText } from '../lib/score'
import type { Inspection, LoggedScore } from '../types'

/**
 * A finished Worker Welfare audit: only its scores were kept (scoresOnly in
 * src/lib/welfareAudit.ts). Final score, grade, findings, date and each
 * section's score; the answers, notes and photos were deleted when it was finished.
 */
export default function FinishedAudit({ ins, logged }: { ins: Inspection; logged: LoggedScore }) {
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  const d = useAllData()
  const info = ins.info
  const contractor = info.contractorUuid ? d.byUuid.get(info.contractorUuid) : undefined
  const wo = info.workOrderUuid ? d.woByUuid.get(info.workOrderUuid) : undefined
  const tone = kpiTone(kpiStatus(logged.pct))
  const strong = tone === 'none' || tone === 'info' ? undefined : tone
  const who = contractor?.name || info.contractorNames || 'Contractor'
  const findings = logged.findings ?? 0

  return (
    <Page title="Welfare audit" back={contractor ? `/contractors/${contractor.uuid}` : '/audits'} backLabel={contractor ? contractor.name : 'Audits'} album>
      <Summary
        tile={<IconTile icon="seal" tone={tone} size={64} />}
        title={wo ? `${who} · WO ${wo.number}` : who}
        sub={['Worker Welfare audit', info.reviewDate && quarterOf(monthOf(info.reviewDate)).label].filter(Boolean).join(' · ')}
        chips={logged.rating ? <StatusChip tone={tone}>{logged.rating}</StatusChip> : undefined}
        facts={[
          { label: 'Score', value: scoreText(logged.pct), tone: strong },
          { label: 'Findings', value: findings, tone: findings ? 'bad' : undefined },
          { label: 'Date', value: info.reviewDate ? shortDate(info.reviewDate) : '—' },
          { label: 'No.', value: info.inspectionNo || '—' },
        ]}
      />
      <ActionBar
        primary={
          canEdit && info.workOrderUuid
            ? { icon: 'play', label: 'New audit for this work order', onClick: () => navigate(`/new/welfare_audit?wo=${info.workOrderUuid}`) }
            : undefined
        }
      />

      {!!logged.sections?.length && (
        <>
          <div className="section-label">Sections</div>
          <div className="list">
            {logged.sections.map((s) => (
              <div key={s.letter} className="row">
                <span className="row-main">
                  <b>{s.letter}</b> · {s.title}
                </span>
                {s.pct === null ? <span className="row-trail">N/A</span> : <StatusChip tone={kpiTone(kpiStatus(s.pct))}>{pct(s.pct)}</StatusChip>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="list">
        {contractor && (
          <button className="row" onClick={() => navigate(`/contractors/${contractor.uuid}`)}>
            <span className="row-label">Contractor</span>
            <span className="row-trail" style={{ color: 'var(--brand)', fontWeight: 600 }}>
              {contractor.name}
            </span>
            <span className="row-chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </button>
        )}
        {[
          ['Project', info.project || '—'],
          ['Location', info.facilityLocation || '—'],
        ].map(([l, v]) => (
          <div key={l} className="row">
            <span className="row-label">{l}</span>
            <span className="row-trail">{v}</span>
          </div>
        ))}
      </div>
      <div className="list-foot">Finished. Only the scores are kept: the answers, notes and photos were deleted.</div>
    </Page>
  )
}
