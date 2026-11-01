import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import History from '../components/History'
import CampSheet from '../components/CampSheet'
import { CAMP_STATUS_LABEL, campInspections, campState } from '../lib/camps'
import { addDays, shortDate } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { isFlagged, scoreInspection } from '../lib/score'
import { getTemplate } from '../templates'
import { useAuthInfo } from '../lib/auth'
import Summary from '../components/Summary'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import ActionBar from '../components/ActionBar'
import { campTone, type Tone } from '../lib/tone'
import { inspectionMenu } from '../components/menus'
import { useLongPress } from '../lib/useLongPress'
import type { Inspection } from '../types'

/** One inspection in the camp's log: tap opens it, hold for Repeat visit / Delete. */
function LogRow({ ins, onOpen }: { ins: Inspection; onOpen: () => void }) {
  const t = getTemplate(ins.templateId)
  const score = t ? scoreInspection(t, ins) : null
  const findings = Object.values(ins.responses ?? {}).filter(isFlagged).length
  const tone: Tone = score?.pct == null ? 'none' : score.pct >= 90 ? 'good' : score.pct >= 70 ? 'warn' : 'bad'
  const sub = `${score?.pct != null ? `${score.pct}% compliant` : 'Not scored'} · ${findings} finding${findings === 1 ? '' : 's'} · ${ins.status === 'completed' ? 'Completed' : 'Draft'}`
  const press = useLongPress(() => inspectionMenu(ins, { title: `Inspection ${shortDate(ins.info.reviewDate)}`, sub, tone }))
  return (
    <button className="row" onClick={onOpen} {...press}>
      <span className="row-main">
        <div className="row-title">{shortDate(ins.info.reviewDate)}</div>
        <div className="row-sub">{sub}</div>
      </span>
      <span className="row-chev">
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  )
}

/** One camp: status, inspection log, start a new inspection. */
export default function CampDetailPage() {
  const { canEdit } = useAuthInfo()
  const { uuid = '' } = useParams()
  const navigate = useNavigate()
  const d = useAllData()
  const [editing, setEditing] = useState(false)
  const camp = d.camps.find((c) => c.uuid === uuid)

  if (!d.loaded) return null
  if (!camp) {
    return (
      <Page title="Camp" back="/camps" backLabel="Camps" large={false}>
        <div className="empty-state">
          <b>Camp not found</b>
        </div>
      </Page>
    )
  }
  const state = campState(camp, d.inspections)
  const log = campInspections(camp, d.inspections)
  const contractor = d.byUuid.get(camp.contractorUuid)
  const wo = d.woByUuid.get(camp.workOrderUuid)
  const nextDue = state.lastDate ? addDays(state.lastDate, camp.cycleDays || 90) : ''
  const tone = state.status === 'ok' ? 'good' : state.status === 'due' ? 'warn' : 'bad'

  return (
    <Page title={camp.name} back="/camps" backLabel="Camps" album>
      <Summary
        tile={<IconTile icon="tent" tone={campTone(state.status)} size={64} />}
        title={camp.name}
        sub={[contractor?.name, wo ? `WO ${wo.number}` : '', camp.location].filter(Boolean).join(' · ') || 'Camp'}
        chips={<StatusChip tone={campTone(state.status)}>{CAMP_STATUS_LABEL[state.status]}</StatusChip>}
        facts={[
          { label: 'Last inspected', value: state.lastDate ? shortDate(state.lastDate) : '—' },
          { label: 'Next due', value: nextDue ? shortDate(nextDue) : 'Now', tone: tone === 'good' ? undefined : tone },
          { label: 'Cycle', value: `${camp.cycleDays || 90} days` },
          { label: 'Inspections', value: log.length },
        ]}
      />
      <ActionBar
        secondary={canEdit ? [{ icon: 'pencil', label: 'Edit camp', onClick: () => setEditing(true) }] : []}
        primary={canEdit ? { icon: 'play', label: 'Start inspection', onClick: () => navigate(`/new/accommodation?camp=${camp.uuid}`) } : undefined}
      />

      <div className="section-label">Inspection log · {log.length}</div>
      {log.length === 0 ? (
        <div className="list-foot">No inspections yet.</div>
      ) : (
        <div className="list">
          {log.map((ins) => (
            <LogRow key={ins.id} ins={ins} onOpen={() => navigate(`/inspection/${ins.id}`)} />
          ))}
        </div>
      )}

      <div className="list" style={{ marginTop: 12 }}>
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
            <span className="row-trail">—</span>
          </div>
        )}
        {[
          ['Work order', wo ? `WO ${wo.number}` : '—'],
          ['Location', camp.location || '—'],
          ['Active', camp.active ? 'Yes' : 'No'],
        ].map(([l, v]) => (
          <div key={l} className="row">
            <span className="row-main">{l}</span>
            <span className="row-trail">{v}</span>
          </div>
        ))}
      </div>

      <History uuid={camp.uuid} contractors={d.byUuid} />
      {editing && <CampSheet camp={camp} onClose={() => setEditing(false)} />}
    </Page>
  )
}
