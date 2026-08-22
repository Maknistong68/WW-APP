import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import { getTemplate } from '../templates'
import type { Inspection } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

const defaultReference = (shortName: string) => {
  const prefix = shortName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return `${prefix}-${today().replace(/-/g, '')}`
}

export default function NewInspectionPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const template = getTemplate(templateId ?? '')

  const [contractor, setContractor] = useState('')
  const [location, setLocation] = useState('')
  const [inspector, setInspector] = useState(() => localStorage.getItem('ww.inspector') ?? '')
  const [date, setDate] = useState(today())
  const [reference, setReference] = useState(() => (template ? defaultReference(template.shortName) : ''))
  const [saving, setSaving] = useState(false)

  if (!template) {
    return (
      <main className="page">
        <div className="empty">Unknown checklist type.</div>
      </main>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      localStorage.setItem('ww.inspector', inspector)
    } catch {
      // private-mode storage failures are non-fatal
    }
    const now = new Date().toISOString()
    const inspection: Inspection = {
      templateId: template.id,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      meta: { reference, date, contractor, location, inspector, notes: '' },
      responses: {},
    }
    const id = await db.inspections.add(inspection)
    navigate(`/inspection/${id}`, { replace: true })
  }

  return (
    <>
      <header className="app-header">
        <button className="back" onClick={() => navigate('/')} aria-label="Back">
          ‹
        </button>
        <h1>New {template.name}</h1>
      </header>
      <main className="page">
        <form className="card" onSubmit={submit}>
          <div className="field">
            <label>Reference</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Contractor / Camp name</label>
            <input
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              placeholder="e.g. ABC Contracting — Camp 3"
              required
            />
          </div>
          <div className="field">
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Industrial Area, Zone 2" />
          </div>
          <div className="field">
            <label>Inspector</label>
            <input value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="Your name" />
          </div>
          <button className="btn primary block" type="submit" disabled={saving}>
            Start inspection
          </button>
        </form>
      </main>
    </>
  )
}
