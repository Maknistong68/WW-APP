import { useNavigate } from 'react-router-dom'
import Page from './Page'
import Icon from './Icon'
import Summary from './Summary'
import IconTile from './IconTile'
import StatusChip from './StatusChip'
import ActionBar from './ActionBar'
import { useAuthInfo } from '../lib/auth'
import { useAllData } from '../lib/kpiData'
import { kpiStatus } from '../lib/kpi'
import { kpiTone } from '../lib/tone'
import { shortDate } from '../lib/dates'
import type { Inspection, LoggedScore } from '../types'

/**
 * A camp-log inspection: only the score, rating and occupancy were recorded
 * (no checklist), so it opens as a short summary instead of the checklist.
 */
export default function LoggedInspection({ ins, logged }: { ins: Inspection; logged: LoggedScore }) {
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  const d = useAllData()
  const camp = ins.campUuid ? d.camps.find((c) => c.uuid === ins.campUuid) : undefined
  const contractor = camp ? d.byUuid.get(camp.contractorUuid) : undefined
  const tone = kpiTone(kpiStatus(logged.pct))
  const info = ins.info
  const capacity = Number(info.maxOccupancy) || 0
  const occupied = Number(info.occupantsNumber) || 0
  const name = camp?.name || info.facilityLocation || 'Inspection'

  return (
    <Page title={name} back=".." album>
      <Summary
        tile={<IconTile icon="tent" tone={tone} size={64} />}
        title={name}
        sub={[contractor?.name || info.contractorNames, shortDate(info.reviewDate)].filter(Boolean).join(' · ')}
        chips={logged.rating ? <StatusChip tone={tone}>{logged.rating}</StatusChip> : undefined}
        facts={[
          { label: 'Score', value: `${logged.pct}%`, tone: tone === 'none' || tone === 'info' ? undefined : tone },
          { label: 'Date', value: info.reviewDate ? shortDate(info.reviewDate) : '—' },
          { label: 'Occupied', value: capacity ? `${occupied} of ${capacity}` : occupied || '—' },
          { label: 'Occupancy', value: capacity ? `${Math.round((occupied / capacity) * 100)}%` : '—' },
        ]}
      />
      <ActionBar
        primary={
          canEdit && camp
            ? { icon: 'play', label: 'Start inspection', onClick: () => navigate(`/new/accommodation?camp=${camp.uuid}`) }
            : undefined
        }
      />

      <div className="list">
        {camp ? (
          <button className="row" onClick={() => navigate(`/camps/${camp.uuid}`)}>
            <span className="row-main">Camp</span>
            <span className="row-trail" style={{ color: 'var(--brand)', fontWeight: 600 }}>{camp.name}</span>
            <span className="row-chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </button>
        ) : null}
        {contractor ? (
          <button className="row" onClick={() => navigate(`/contractors/${contractor.uuid}`)}>
            <span className="row-main">Contractor</span>
            <span className="row-trail" style={{ color: 'var(--brand)', fontWeight: 600 }}>{contractor.name}</span>
            <span className="row-chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </button>
        ) : (
          <div className="row">
            <span className="row-main">Contractor</span>
            <span className="row-trail">{info.contractorNames || '—'}</span>
          </div>
        )}
        {[
          ['Type', info.facilityType || '—'],
          ['Location', info.region || camp?.location || '—'],
        ].map(([l, v]) => (
          <div key={l} className="row">
            <span className="row-main">{l}</span>
            <span className="row-trail">{v}</span>
          </div>
        ))}
      </div>
      <div className="list-foot">From the camp log. No checklist.</div>
    </Page>
  )
}
