import { useNavigate } from 'react-router-dom'

export default function KpisPage() {
  const navigate = useNavigate()
  return (
    <>
      <header className="app-header">
        <button className="back" onClick={() => navigate('/')} aria-label="Back">
          ‹
        </button>
        <h1>Contractor Welfare KPIs</h1>
      </header>
      <main className="page">
        <div className="empty">
          <p style={{ fontSize: 40, margin: 0 }}>📊</p>
          <p>
            <b>Coming soon.</b>
          </p>
          <p>
            This section will track worker welfare KPIs per contractor (audit scores, open corrective
            actions, closure rates and trends). It is intentionally left empty for now.
          </p>
        </div>
      </main>
    </>
  )
}
