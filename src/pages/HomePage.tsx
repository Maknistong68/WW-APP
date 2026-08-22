import { useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { saveAs } from 'file-saver'
import { createBackup, db, deleteInspection, restoreBackup } from '../db'
import { TEMPLATES, countItems, getTemplate } from '../templates'
import { ConfirmSheet } from '../components/Modal'
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

export default function HomePage() {
  const navigate = useNavigate()
  const inspections = useLiveQuery(() => db.inspections.orderBy('createdAt').reverse().toArray())
  const [listQuery, setListQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Inspection | null>(null)
  const [busy, setBusy] = useState(false)
  const restoreRef = useRef<HTMLInputElement>(null)

  const doBackup = async () => {
    setBusy(true)
    try {
      const { blob, fileName } = await createBackup()
      saveAs(blob, fileName)
      showToast({ text: `Backup saved: ${fileName}. Keep it in Drive or email.`, duration: 6000 })
    } catch (err) {
      showToast({ text: `Backup failed: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setBusy(false)
    }
  }

  const doRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const { inspections: n, photos: p } = await restoreBackup(file)
      showToast({ text: `Restored ${n} inspection${n === 1 ? '' : 's'} and ${p} photo${p === 1 ? '' : 's'}` })
    } catch (err) {
      showToast({ text: `Restore failed: ${err instanceof Error ? err.message : String(err)}`, duration: 7000 })
    } finally {
      setBusy(false)
    }
  }

  const q = listQuery.trim().toLowerCase()
  const visible = (inspections ?? []).filter((ins) => {
    if (!q) return true
    const t = getTemplate(ins.templateId)
    return [ins.info?.contractorNames, ins.info?.facilityLocation, ins.info?.region, t?.name, ins.info?.reviewDate]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q))
  })

  return (
    <>
      <header className="app-header">
        <h1>Worker Welfare Inspections</h1>
        <button
          className="icon-btn header-btn"
          onClick={() => navigate('/kpis')}
          title="Contractor KPIs"
          aria-label="Contractor KPIs"
        >
          📊
        </button>
      </header>
      <main className="page">
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
            <span className="search-icon" aria-hidden="true">🔎</span>
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
            const answered = Object.values(ins.responses ?? {}).filter(
              (r) => r && (r.assessment !== '' || r.yesNo !== ''),
            ).length
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
                  title="Delete"
                  aria-label={`Delete inspection ${ins.info?.contractorNames ?? ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(ins)
                  }}
                >
                  🗑
                </button>
              </div>
            )
          })
        )}

        <div className="section-label">Your data</div>
        <div className="card">
          <p className="note" style={{ marginTop: 0 }}>
            Everything lives only on this phone. Save a backup file regularly (to Drive, email, anywhere) — it
            contains all inspections and photos and can be restored on any phone.
          </p>
          <div className="btn-row" style={{ marginTop: 4 }}>
            <button className="btn" disabled={busy} onClick={() => void doBackup()}>
              {busy ? 'Working…' : '⬇ Save backup'}
            </button>
            <button className="btn" disabled={busy} onClick={() => restoreRef.current?.click()}>
              ⬆ Restore backup
            </button>
          </div>
          <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={doRestore} />
        </div>
      </main>

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
    </>
  )
}
