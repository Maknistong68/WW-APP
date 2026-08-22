import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import { getTemplate } from '../templates'
import type { GeneralInfo, Inspection } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

const remember = (key: string, fallback = '') => {
  try {
    return localStorage.getItem(`ww.${key}`) ?? fallback
  } catch {
    return fallback
  }
}

export default function NewInspectionPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const template = getTemplate(templateId ?? '')

  const [info, setInfo] = useState<GeneralInfo>(() => ({
    typeOfReview: 'Welfare Inspection',
    reviewDate: today(),
    auditTeam: remember('auditTeam'),
    region: remember('region'),
    facilityLocation: '',
    facilityType: 'Camp',
    mapCoordinates: '',
    googleMapsLink: '',
    facilityManagement: '',
    occupantsNumber: '',
    numberOfRooms: '',
    maxOccupancy: '',
    contractorsCount: '1',
    contractorNames: '',
    projectsServed: '',
    facilityRepresentative: '',
    workOrder: '',
  }))
  const [saving, setSaving] = useState(false)

  if (!template) {
    return (
      <main className="page">
        <div className="empty">Unknown checklist type.</div>
      </main>
    )
  }

  const set = (key: keyof GeneralInfo) => (e: { target: { value: string } }) =>
    setInfo((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      localStorage.setItem('ww.auditTeam', info.auditTeam)
      localStorage.setItem('ww.region', info.region)
    } catch {
      // private-mode storage failures are non-fatal
    }
    const now = new Date().toISOString()
    const inspection: Inspection = {
      templateId: template.id,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      info,
      responses: {},
      notes: '',
    }
    const id = await db.inspections.add(inspection)
    navigate(`/inspection/${id}`, { replace: true })
  }

  const field = (
    label: string,
    key: keyof GeneralInfo,
    opts: { type?: string; placeholder?: string; required?: boolean } = {},
  ) => (
    <div className="field">
      <label>{label}</label>
      <input
        type={opts.type ?? 'text'}
        value={info[key]}
        onChange={set(key)}
        placeholder={opts.placeholder}
        required={opts.required}
        inputMode={opts.type === 'number' ? 'numeric' : undefined}
      />
    </div>
  )

  return (
    <>
      <header className="app-header">
        <button className="back" onClick={() => navigate('/')} aria-label="Back">
          ‹
        </button>
        <h1>New {template.name}</h1>
      </header>
      <main className="page">
        <form onSubmit={submit}>
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>
              Review
            </div>
            {field('Type of review', 'typeOfReview', { required: true })}
            {field('Review date', 'reviewDate', { type: 'date', required: true })}
            {field('Member(s) of the audit team', 'auditTeam', { placeholder: 'Your name' })}
          </div>

          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>
              Facility
            </div>
            {field('Region', 'region', { placeholder: 'e.g. OXAGON' })}
            {field('Facility location', 'facilityLocation', { placeholder: 'e.g. Duba', required: true })}
            {field('Facility type', 'facilityType')}
            {field('Map coordinates', 'mapCoordinates')}
            {field('Link for Google Maps', 'googleMapsLink', { placeholder: 'https://…' })}
            {field('Facility management', 'facilityManagement')}
            {field('Facility representative', 'facilityRepresentative')}
          </div>

          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>
              Occupancy
            </div>
            {field('Occupants number', 'occupantsNumber', { type: 'number' })}
            {field('Number of rooms', 'numberOfRooms', { type: 'number' })}
            {field('Maximum number of occupancy', 'maxOccupancy', { type: 'number' })}
          </div>

          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>
              Contractor
            </div>
            {field('Number of contractor(s) within the facility', 'contractorsCount', { type: 'number' })}
            {field('Name of contractor(s)', 'contractorNames', { placeholder: 'e.g. AL FAHD', required: true })}
            {field('Projects served by contractors in the facility', 'projectsServed')}
            {field('Project / Work Order', 'workOrder', { placeholder: 'e.g. 4800000882/1272' })}
          </div>

          <button className="btn primary block" type="submit" disabled={saving}>
            Start inspection
          </button>
        </form>
      </main>
    </>
  )
}
