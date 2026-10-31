import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import History from '../components/History'
import CampSheet from '../components/CampSheet'
import { CAMP_STATUS_LABEL, campInspections, campState } from '../lib/camps'
import { addDays, shortDate } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { ago } from './CampsPage'
import { isFlagged, scoreInspection } from '../lib/score'
import { getTemplate } from '../templates'
import { useAuthInfo } from '../lib/auth'
import AlbumHeader from '../components/AlbumHeader'
import Cover from '../components/Cover'

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
      <AlbumHeader
        cover={<Cover section="camps" seed={camp.name} icon="tent" size={156} />}
        title={camp.name}
        sub={[contractor?.name, wo ? `WO ${wo.number}` : '', camp.location].filter(Boolean).join(' · ') || 'Camp'}
        meta={
          <>
            <span className={`status-chip ${tone}`}>{CAMP_STATUS_LABEL[state.status]}</span>
            <span>Every {camp.cycleDays || 90} days</span>
          </>
        }
        buttons={canEdit ? [{ icon: 'pencil', label: 'Edit camp', onClick: () => setEditing(true) }] : []}
        primary={canEdit ? { icon: 'play', label: 'Start inspection', onClick: () => navigate(`/new/accommodation?camp=${camp.uuid}`) } : undefined}
      />

      <div className="hero-row">
        <div className="hero">
          <div className={`hero-num ${tone}`} style={{ fontSize: 22 }}>
            {CAMP_STATUS_LABEL[state.status]}
          </div>
          <div className="hero-label">Every {camp.cycleDays || 90} days</div>
        </div>
        <div className="hero">
          <div className="hero-num" style={{ fontSize: 22 }}>
            {state.lastDate ? shortDate(state.lastDate) : '—'}
          </div>
          <div className="hero-label">{state.daysSince !== null ? `Last · ${ago(state.daysSince)}` : 'Last inspection'}</div>
        </div>
        <div className="hero">
          <div className={`hero-num ${tone}`} style={{ fontSize: 22 }}>
            {nextDue ? shortDate(nextDue) : 'Now'}
          </div>
          <div className="hero-label">Next due</div>
        </div>
      </div>


      <div className="section-label">Inspection log · {log.length}</div>
      {log.length === 0 ? (
        <div className="list-foot">No inspections yet.</div>
      ) : (
        <div className="list">
          {log.map((ins) => {
            const t = getTemplate(ins.templateId)
            const score = t ? scoreInspection(t, ins) : null
            const findings = Object.values(ins.responses ?? {}).filter(isFlagged).length
            return (
              <button key={ins.id} className="row" onClick={() => navigate(`/inspection/${ins.id}`)}>
                <span className="row-main">
                  <div className="row-title">{shortDate(ins.info.reviewDate)}</div>
                  <div className="row-sub">
                    {score?.pct != null ? `${score.pct}% compliant` : 'Not scored'} · {findings} finding{findings === 1 ? '' : 's'} ·{' '}
                    {ins.status === 'completed' ? 'Completed' : 'Draft'}
                  </div>
                </span>
                <span className="row-chev">
                  <Icon name="chevron-right" size={18} />
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="list" style={{ marginTop: 12 }}>
        {[
          ['Contractor', contractor?.name ?? '—'],
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
