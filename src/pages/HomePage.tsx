import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, deleteInspection } from '../db'
import { TEMPLATES, countItems, getTemplate } from '../templates'

export default function HomePage() {
  const navigate = useNavigate()
  const inspections = useLiveQuery(() => db.inspections.orderBy('createdAt').reverse().toArray())

  return (
    <>
      <header className="app-header">
        <h1>Worker Welfare Inspections</h1>
        <button className="icon-btn" style={{ color: '#fff' }} onClick={() => navigate('/kpis')} title="KPIs">
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
              {t.sections.length} sections · {countItems(t)} items →
            </div>
          </button>
        ))}

        <div className="section-label">My inspections</div>
        {!inspections || inspections.length === 0 ? (
          <div className="empty">No inspections yet. Start one above — everything is saved on this phone, even offline.</div>
        ) : (
          inspections.map((ins) => {
            const t = getTemplate(ins.templateId)
            const total = t ? countItems(t) : 0
            const answered = Object.values(ins.responses).filter((r) => r.result !== 'not_checked').length
            return (
              <div key={ins.id} className="card inspection-row" onClick={() => navigate(`/inspection/${ins.id}`)}>
                <div className="info">
                  <b>{ins.meta.contractor || t?.shortName || ins.templateId}</b>
                  <span>
                    {t?.shortName} · {ins.meta.date}
                    {total > 0 && ` · ${answered}/${total} items`}
                  </span>
                </div>
                <span className={`badge ${ins.status}`}>{ins.status === 'completed' ? 'Completed' : 'Draft'}</span>
                <button
                  className="icon-btn"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Delete this inspection and all its photos? This cannot be undone.')) {
                      void deleteInspection(ins.id!)
                    }
                  }}
                >
                  🗑
                </button>
              </div>
            )
          })
        )}
      </main>
    </>
  )
}
