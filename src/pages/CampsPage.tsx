import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { newUuid } from '../db'
import { CAMP_STATUS_LABEL, DEFAULT_CYCLE_DAYS, campState, campsFromAudits, type CampStatus } from '../lib/camps'
import { shortDate } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { nowIso, saveRecord } from '../lib/records'
import type { Camp } from '../types'

export const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`)

const TONE: Record<CampStatus, string> = { ok: 'ok', due: 'risk', expired: 'late', never: 'late' }
const RANK: Record<CampStatus, number> = { never: 0, expired: 1, due: 2, ok: 3 }

export const newCamp = (): Camp => ({
  uuid: newUuid(),
  updatedAt: '',
  name: '',
  contractorUuid: '',
  workOrderUuid: '',
  location: '',
  cycleDays: DEFAULT_CYCLE_DAYS,
  active: true,
  notes: '',
})

/** Camps with when each was last inspected; expired ones first. */
export default function CampsPage() {
  const navigate = useNavigate()
  const d = useAllData()
  const [query, setQuery] = useState('')

  // Old audits without a camp become camps once, so their history shows here.
  const seeded = useRef(false)
  useEffect(() => {
    if (!d.loaded || seeded.current) return
    seeded.current = true
    const fresh = campsFromAudits(d.inspections, d.camps, d.contractors, newUuid, nowIso())
    void (async () => {
      for (const c of fresh) await saveRecord('camps', c, c.name)
    })()
  }, [d])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return d.camps
      .filter((c) => !q || [c.name, c.location, d.byUuid.get(c.contractorUuid)?.name ?? ''].some((s) => s.toLowerCase().includes(q)))
      .map((c) => ({ c, s: campState(c, d.inspections) }))
      .sort((a, b) => Number(b.c.active) - Number(a.c.active) || RANK[a.s.status] - RANK[b.s.status] || a.c.name.localeCompare(b.c.name))
  }, [d, query])
  const expired = rows.filter((r) => r.c.active && (r.s.status === 'expired' || r.s.status === 'never')).length

  return (
    <Page
      title="Camps"
    >
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Camp, contractor, area" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {d.loaded && d.camps.length === 0 ? (
        <div className="empty-state">
          <Icon name="tent" size={44} />
          <b>No camps yet</b>
          Tap + to add a camp. Each camp shows when it was last inspected.
        </div>
      ) : (
        <>
          <div className="section-label">
            {rows.length} camp{rows.length === 1 ? '' : 's'}
            {expired ? ` · ${expired} expired` : ''}
          </div>
          <div className="list">
            {rows.map(({ c, s }) => (
              <button key={c.uuid} className="row" onClick={() => navigate(`/camps/${c.uuid}`)}>
                <span className="row-main">
                  <div className="row-title">{c.name}</div>
                  <div className="row-sub">
                    {s.lastDate ? `Last inspected ${shortDate(s.lastDate)} · ${ago(s.daysSince ?? 0)}` : 'Never inspected'}
                    {d.byUuid.get(c.contractorUuid) ? ` · ${d.byUuid.get(c.contractorUuid)!.name}` : ''}
                  </div>
                </span>
                {c.active ? (
                  <span className={`age-chip ${TONE[s.status]}`}>{CAMP_STATUS_LABEL[s.status]}</span>
                ) : (
                  <span className="row-trail">Inactive</span>
                )}
                <span className="row-chev">
                  <Icon name="chevron-right" size={18} />
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="list" style={{ marginTop: 16 }}>
        <button className="row" onClick={() => navigate('/audits')}>
          <span className="row-icon">
            <Icon name="clipboard" size={18} />
          </span>
          <span className="row-main">
            <div className="row-title">All inspections</div>
            <div className="row-sub">
              {d.inspections.length} audit{d.inspections.length === 1 ? '' : 's'}
            </div>
          </span>
          <span className="row-chev">
            <Icon name="chevron-right" size={18} />
          </span>
        </button>
      </div>
      <div className="list-foot">Inspect every camp at least every 90 days. Due soon = last 14 days of the cycle.</div>

    </Page>
  )
}
