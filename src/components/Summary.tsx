import type { ReactNode } from 'react'

export interface Fact {
  label: string
  value: ReactNode
  tone?: 'bad' | 'warn' | 'good'
}

/** Detail-screen summary: tile, title, status chips and a 2×2 grid of key facts. */
export default function Summary({
  tile,
  title,
  sub,
  chips,
  facts = [],
}: {
  tile: ReactNode
  title: ReactNode
  sub?: ReactNode
  chips?: ReactNode
  facts?: Fact[]
}) {
  return (
    <section className="summary">
      <div className="summary-head">
        {tile}
        <div className="summary-text">
          <h1 className="summary-title">{title}</h1>
          {sub && <div className="summary-sub">{sub}</div>}
        </div>
      </div>
      {chips && <div className="summary-chips">{chips}</div>}
      {facts.length > 0 && (
        <div className="facts">
          {facts.map((f) => (
            <div key={f.label} className="fact">
              <div className={`fact-num ${f.tone ?? ''}`}>{f.value}</div>
              <div className="fact-label">{f.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
