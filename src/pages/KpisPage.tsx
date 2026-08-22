import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { getTemplate } from '../templates'
import { scoreInspection } from '../lib/score'
import type { Inspection } from '../types'

interface ContractorKpi {
  name: string
  inspections: number
  latest: Inspection
  latestPct: number | null
  openFindings: number
}

const scoreClass = (pct: number | null) =>
  pct === null ? '' : pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad'

export default function KpisPage() {
  const navigate = useNavigate()
  const inspections = useLiveQuery(() => db.inspections.toArray())

  const kpis = useMemo(() => {
    if (!inspections) return null
    const byContractor = new Map<string, Inspection[]>()
    for (const ins of inspections) {
      const name = ins.info?.contractorNames?.trim() || 'Unnamed contractor'
      byContractor.set(name, [...(byContractor.get(name) ?? []), ins])
    }
    const contractors: ContractorKpi[] = []
    for (const [name, list] of byContractor) {
      const sorted = [...list].sort((a, b) => (a.info.reviewDate < b.info.reviewDate ? 1 : -1))
      const latest = sorted[0]
      const template = getTemplate(latest.templateId)
      const score = template ? scoreInspection(template, latest) : null
      contractors.push({
        name,
        inspections: list.length,
        latest,
        latestPct: score?.pct ?? null,
        openFindings: score?.flagged ?? 0,
      })
    }
    contractors.sort((a, b) => (a.latestPct ?? 101) - (b.latestPct ?? 101))
    const scored = contractors.filter((c) => c.latestPct !== null)
    return {
      contractors,
      totalInspections: inspections.length,
      avgPct: scored.length
        ? Math.round(scored.reduce((s, c) => s + (c.latestPct ?? 0), 0) / scored.length)
        : null,
      openFindings: contractors.reduce((s, c) => s + c.openFindings, 0),
    }
  }, [inspections])

  return (
    <>
      <header className="app-header">
        <button className="back" onClick={() => navigate('/')} aria-label="Back">
          ‹
        </button>
        <h1>Contractor Welfare KPIs</h1>
      </header>
      <main className="page">
        {!kpis || kpis.totalInspections === 0 ? (
          <div className="empty">
            <p style={{ fontSize: 40, margin: 0 }}>📊</p>
            <p>
              <b>No data yet.</b>
            </p>
            <p>KPIs build themselves from your inspections — complete one and contractor scores appear here.</p>
          </div>
        ) : (
          <>
            <div className="kpi-tiles">
              <div className="kpi-tile">
                <span className="kpi-num">{kpis.contractors.length}</span>
                <span className="kpi-label">Contractors</span>
              </div>
              <div className="kpi-tile">
                <span className="kpi-num">{kpis.totalInspections}</span>
                <span className="kpi-label">Inspections</span>
              </div>
              <div className="kpi-tile">
                <span className={`kpi-num ${scoreClass(kpis.avgPct)}`}>
                  {kpis.avgPct === null ? '—' : `${kpis.avgPct}%`}
                </span>
                <span className="kpi-label">Avg. compliance</span>
              </div>
              <div className="kpi-tile">
                <span className={`kpi-num ${kpis.openFindings > 0 ? 'bad' : 'good'}`}>{kpis.openFindings}</span>
                <span className="kpi-label">Open findings</span>
              </div>
            </div>

            <div className="section-label">By contractor (latest inspection)</div>
            {kpis.contractors.map((c) => (
              <div
                key={c.name}
                className="card kpi-contractor"
                onClick={() => navigate(`/inspection/${c.latest.id}`)}
              >
                <div className="kpi-contractor-head">
                  <b>{c.name}</b>
                  <span className={`kpi-pct ${scoreClass(c.latestPct)}`}>
                    {c.latestPct === null ? 'Not scored' : `${c.latestPct}%`}
                  </span>
                </div>
                <div className="kpi-bar">
                  <div
                    className={`kpi-bar-fill ${scoreClass(c.latestPct)}`}
                    style={{ width: `${c.latestPct ?? 0}%` }}
                  />
                </div>
                <div className="note">
                  {c.inspections} inspection{c.inspections === 1 ? '' : 's'} · latest{' '}
                  {c.latest.info.reviewDate}
                  {c.openFindings > 0 && ` · ${c.openFindings} open finding${c.openFindings === 1 ? '' : 's'}`}
                </div>
              </div>
            ))}
            <p className="note">
              Score = average over answered questions (Full 100 · Partial 50 · None 0, N/A excluded), same
              as the Excel report. Open findings = No/Partial compliance answers in the latest inspection.
            </p>
          </>
        )}
      </main>
    </>
  )
}
