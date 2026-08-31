import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db, logEvent, newUuid } from '../db'
import { getTemplate } from '../templates'
import Icon from '../components/Icon'
import { showToast } from '../components/Toast'
import type { GeneralInfo, Inspection } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

/** "27.123456, 35.654321" (or any lat,lng pair in a string) → coordinates. */
const parseCoords = (s: string): { lat: number; lng: number } | null => {
  const m = s.match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

/** Pull coordinates out of a pasted Google Maps link (long URLs only —
 *  maps.app.goo.gl short links don't carry them). */
const coordsFromLink = (link: string): { lat: number; lng: number } | null => {
  const at = link.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
  if (at) return parseCoords(`${at[1]},${at[2]}`)
  const q = link.match(/[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  if (q) return parseCoords(`${q[1]},${q[2]}`)
  const bang = link.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
  if (bang) return parseCoords(`${bang[1]},${bang[2]}`)
  return null
}

const remember = (key: string, fallback = '') => {
  try {
    return localStorage.getItem(`ww.${key}`) ?? fallback
  } catch {
    return fallback
  }
}

/** Unsubmitted new-inspection forms are drafted here so nothing typed is lost. */
const draftKey = (templateId: string) => `ww.formDraft.${templateId}`

const blankInfo = (): GeneralInfo => ({
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
})

/** Creates a new inspection (/new/:templateId) or edits one (/inspection/:id/edit). */
export default function InfoFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { templateId, id } = useParams()
  const navigate = useNavigate()
  const inspectionId = Number(id)

  const [existing, setExisting] = useState<Inspection | null>(null)
  const restoredDraft = useRef(false)
  const dirty = useRef(false)
  const [info, setInfo] = useState<GeneralInfo>(() => {
    if (mode === 'new' && templateId) {
      try {
        const raw = localStorage.getItem(draftKey(templateId))
        if (raw) {
          restoredDraft.current = true
          return { ...blankInfo(), ...(JSON.parse(raw) as Partial<GeneralInfo>) }
        }
      } catch {
        // corrupt draft — fall through to a blank form
      }
    }
    return blankInfo()
  })
  const [loaded, setLoaded] = useState(mode === 'new')
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (mode !== 'edit') return
    void db.inspections.get(inspectionId).then((ins) => {
      if (ins) {
        setExisting(ins)
        setInfo(ins.info)
      }
      setLoaded(true)
    })
  }, [mode, inspectionId])

  useEffect(() => {
    if (restoredDraft.current) {
      showToast({ text: 'Draft restored — continue where you left off', duration: 3000 })
    }
  }, [])

  // Draft every edit (new mode only) so backing out or closing the app
  // mid-form loses nothing; the draft clears on submit.
  useEffect(() => {
    if (mode !== 'new' || !templateId || !dirty.current) return
    try {
      localStorage.setItem(draftKey(templateId), JSON.stringify(info))
    } catch {
      // private-mode storage failures are non-fatal
    }
  }, [info, mode, templateId])

  const template = mode === 'edit' ? getTemplate(existing?.templateId ?? '') : getTemplate(templateId ?? '')

  if (!loaded) return <main className="page"><div className="empty">Loading…</div></main>
  if (!template) {
    return (
      <main className="page">
        <div className="empty">{mode === 'edit' ? 'Inspection not found.' : 'Unknown checklist type.'}</div>
      </main>
    )
  }

  const set = (key: keyof GeneralInfo) => (e: { target: { value: string } }) => {
    dirty.current = true
    setInfo((prev) => ({ ...prev, [key]: e.target.value }))
  }

  // The pinned map follows whatever location data exists: the coordinates
  // field first (freshest after "Use my location"), else a pasted Maps link.
  const pin = parseCoords(info.mapCoordinates) ?? coordsFromLink(info.googleMapsLink)

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      showToast({ text: 'This device does not expose location to the browser.' })
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6)
        const lng = pos.coords.longitude.toFixed(6)
        dirty.current = true
        setInfo((prev) => ({
          ...prev,
          mapCoordinates: `${lat}, ${lng}`,
          googleMapsLink: prev.googleMapsLink || `https://maps.google.com/?q=${lat},${lng}`,
        }))
        setLocating(false)
        showToast({ text: 'Location captured — map pinned below', duration: 3000 })
      },
      (err) => {
        setLocating(false)
        showToast({ text: `Could not get location: ${err.message}`, duration: 6000 })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      try {
        localStorage.setItem('ww.auditTeam', info.auditTeam)
        localStorage.setItem('ww.region', info.region)
      } catch {
        // private-mode storage failures are non-fatal
      }
      const now = new Date().toISOString()
      if (mode === 'edit' && existing) {
        await db.inspections.put({ ...existing, info, updatedAt: now })
        logEvent(existing.id!, 'Details edited', info.contractorNames)
        showToast({ text: 'Inspection details updated' })
        navigate(`/inspection/${existing.id}`, { replace: true })
        return
      }
      const inspection: Inspection = {
        templateId: template.id,
        uuid: newUuid(),
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        info,
        responses: {},
        notes: '',
      }
      const newId = await db.inspections.add(inspection)
      try {
        localStorage.removeItem(draftKey(template.id))
      } catch {
        // non-fatal
      }
      logEvent(newId, 'Inspection created', `${template.name} · ${info.contractorNames}`)
      navigate(`/inspection/${newId}`, { replace: true })
    } catch (err) {
      showToast({
        text: `Could not save: ${err instanceof Error ? err.message : String(err)}`,
        duration: 8000,
      })
    } finally {
      setSaving(false)
    }
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

  const backTo = mode === 'edit' ? `/inspection/${inspectionId}` : '/'

  return (
    <>
      <header className="app-header">
        <button className="back" onClick={() => navigate(backTo)} aria-label="Back">
          <Icon name="chevron-left" size={26} />
        </button>
        <h1>{mode === 'edit' ? 'Inspection details' : `New ${template.name}`}</h1>
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
            {field('Map coordinates', 'mapCoordinates', { placeholder: 'e.g. 27.123456, 35.654321' })}
            {field('Link for Google Maps', 'googleMapsLink', { placeholder: 'https://…' })}
            <div className="btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <button type="button" className="btn primary" disabled={locating} onClick={useMyLocation}>
                <Icon name="locate" size={19} /> {locating ? 'Locating…' : 'Use my location'}
              </button>
              {(info.googleMapsLink || pin) && (
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    window.open(
                      info.googleMapsLink || `https://maps.google.com/?q=${pin!.lat},${pin!.lng}`,
                      '_blank',
                      'noopener',
                    )
                  }
                >
                  <Icon name="external-link" size={19} /> Open in Maps
                </button>
              )}
            </div>
            {pin ? (
              <>
                <iframe
                  className="map-embed"
                  title="Pinned facility location"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${pin.lat},${pin.lng}&z=15&output=embed`}
                />
                <p className="map-hint">
                  <Icon name="map-pin" size={13} /> Pinned at {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)} — updates
                  as the coordinates or link change.
                </p>
              </>
            ) : (
              <p className="map-hint">
                Tap “Use my location”, type coordinates, or paste a Google Maps link and the map pins itself here.
              </p>
            )}
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
            {mode === 'edit' ? 'Save changes' : 'Start inspection'}
          </button>
        </form>
      </main>
    </>
  )
}
