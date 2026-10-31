import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, deleteInspection, duplicateInspection } from '../db'
import { TEMPLATES, countItems, getTemplate } from '../templates'
import { isAnswered } from '../lib/score'
import { ConfirmSheet } from '../components/Modal'
import Icon from '../components/Icon'
import Page, { SettingsButton } from '../components/Page'
import { showToast } from '../components/Toast'
import type { Inspection } from '../types'

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

export default function AuditsPage() {
  const navigate = useNavigate()
  const inspections = useLiveQuery(() => db.inspections.orderBy('createdAt').reverse().toArray())
  const [listQuery, setListQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Inspection | null>(null)
  const q = listQuery.trim().toLowerCase()
  const visible = (inspections ?? []).filter((ins) => {
    if (!q) return true
    const t = getTemplate(ins.templateId)
    return [ins.info?.contractorNames, ins.info?.facilityLocation, ins.info?.region, t?.name, ins.info?.reviewDate]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q))
  })

  return (
    <Page title="All inspections" back="/camps" backLabel="Camps" actions={<SettingsButton />}>
        <div className="section-label">Start a new inspection</div>
        {TEMPLATES.map((t) => (
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
          visible.map((ins) => {
            const t = getTemplate(ins.templateId)
            const total = t ? countItems(t) : 0
            const answered = Object.values(ins.responses ?? {}).filter(isAnswered).length
            return (
              <div key={ins.id} className="card inspection-row" onClick={() => navigate(`/inspection/${ins.id}`)}>
                <div className="info">
                  <b>{ins.info?.contractorNames || ins.info?.facilityLocation || t?.shortName || ins.templateId}</b>
                  <span>
                    {t?.shortName} · {friendlyDate(ins.info?.reviewDate ?? '')}
                    {total > 0 && ` · ${answered}/${total} questions`}
                  </span>
                </div>
                <span className={`badge ${ins.status}`}>{ins.status === 'completed' ? 'Completed' : 'Draft'}</span>
                <button
                  className="icon-btn"
                  title="Repeat visit (copy details into a new inspection)"
                  aria-label="Start repeat visit"
                  onClick={(e) => {
                    e.stopPropagation()
                    void duplicateInspection(ins.id!).then((newId) => {
                      if (newId) {
                        showToast({ text: 'New inspection started with the same details' })
                        navigate(`/inspection/${newId}`)
                      }
                    })
                  }}
                >
                  <Icon name="copy" size={22} />
                </button>
                <button
                  className="icon-btn"
                  title="Delete"
                  aria-label={`Delete inspection ${ins.info?.contractorNames ?? ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(ins)
                  }}
                >
                  <Icon name="trash" size={22} />
                </button>
              </div>
            )
          })
        )}


      {confirmDelete && (
        <ConfirmSheet
          title="Delete inspection?"
          message={`This permanently deletes “${
            confirmDelete.info?.contractorNames || confirmDelete.info?.facilityLocation || 'this inspection'
          }” and all its photos. Save a backup first if you might need it again.`}
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete.id) void deleteInspection(confirmDelete.id)
            setConfirmDelete(null)
            showToast({ text: 'Inspection deleted' })
          }}
        />
      )}
    </Page>
  )
}
