import { useState } from 'react'
import { useCachedLiveQuery } from '../lib/useCachedQuery'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { TEMPLATES, countItems, getTemplate } from '../templates'
import { isAnswered } from '../lib/score'
import Icon from '../components/Icon'
import Page from '../components/Page'
import type { Inspection } from '../types'
import { useAuthInfo } from '../lib/auth'
import { inspectionMenu } from '../components/menus'
import { setAnchor } from '../lib/anchor'
import { useLongPress } from '../lib/useLongPress'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function friendlyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  const today = new Date()
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Yesterday'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** One inspection: tap opens it; hold or ⋯ for Repeat visit / Delete. */
function InspectionCard({ ins, onOpen }: { ins: Inspection; onOpen: () => void }) {
  const t = getTemplate(ins.templateId)
  const total = t ? countItems(t) : 0
  const answered = Object.values(ins.responses ?? {}).filter(isAnswered).length
  const title = ins.info?.contractorNames || ins.info?.facilityLocation || t?.shortName || ins.templateId
  const sub = `${t?.shortName ?? ''} · ${friendlyDate(ins.info?.reviewDate ?? '')}${total > 0 ? ` · ${answered}/${total} questions` : ''}`
  const more = () => inspectionMenu(ins, { title, sub, tone: ins.status === 'completed' ? 'good' : 'info' })
  const press = useLongPress(more)
  return (
    <div
      className="card inspection-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpen()
        }
      }}
      {...press}
    >
      <div className="info">
        <b>{title}</b>
        <span>{sub}</span>
      </div>
      <span className={`badge ${ins.status}`}>{ins.status === 'completed' ? 'Completed' : 'Draft'}</span>
      <button
        className="icon-btn"
        aria-label={`More actions for ${title}`}
        onClick={(e) => {
          e.stopPropagation()
          const row = e.currentTarget.closest('.inspection-row')
          if (row) setAnchor(row.getBoundingClientRect())
          more()
        }}
      >
        <Icon name="dots" size={22} />
      </button>
    </div>
  )
}

export default function AuditsPage() {
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  const inspections = useCachedLiveQuery('inspections:recent', () => db.inspections.orderBy('createdAt').reverse().toArray())
  const [listQuery, setListQuery] = useState('')
  const q = listQuery.trim().toLowerCase()
  const visible = (inspections ?? []).filter((ins) => {
    if (!q) return true
    const t = getTemplate(ins.templateId)
    return [ins.info?.contractorNames, ins.info?.facilityLocation, ins.info?.region, t?.name, ins.info?.reviewDate]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q))
  })

  return (
    <Page title="All inspections" back="/library" backLabel="Library">
        {canEdit && <div className="section-label">Start a new inspection</div>}
        {canEdit && TEMPLATES.map((t) => (
          <button key={t.id} className="card template-card" onClick={() => navigate(`/new/${t.id}`)}>
            <h3>{t.name}</h3>
            <p>{t.description}</p>
            <div className="count">
              {t.sections.length} sections · {countItems(t)} questions →
            </div>
          </button>
        ))}

        <div className="section-label">My inspections</div>
        {(inspections?.length ?? 0) > 5 && (
          <div className="search-box" style={{ marginBottom: 10 }}>
            <span className="search-icon" aria-hidden="true">
              <Icon name="search" size={19} />
            </span>
            <input
              type="search"
              value={listQuery}
              placeholder="Search inspections…"
              aria-label="Search inspections"
              onChange={(e) => setListQuery(e.target.value)}
            />
          </div>
        )}
        {!inspections || inspections.length === 0 ? (
          <div className="empty">No inspections yet. Start one above — everything is saved on this phone, even offline.</div>
        ) : visible.length === 0 ? (
          <div className="empty">No inspection matches “{listQuery}”.</div>
        ) : (
          visible.map((ins) => <InspectionCard key={ins.id} ins={ins} onOpen={() => navigate(`/inspection/${ins.id}`)} />)
        )}


    </Page>
  )
}
