import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Cover from '../components/Cover'
import MediaRow from '../components/MediaRow'
import CampSheet from '../components/CampSheet'
import { showActions } from '../components/ActionSheet'
import { newUuid } from '../db'
import { DEFAULT_CYCLE_DAYS, campState, campsFromAudits, type CampStatus } from '../lib/camps'
import { shortDate } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { nowIso, saveRecord } from '../lib/records'
import type { Camp } from '../types'

export const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`)

export const TONE: Record<CampStatus, string> = { ok: 'ok', due: 'risk', expired: 'late', never: 'late' }
const CHIP: Record<CampStatus, string> = { ok: 'good', due: 'warn', expired: 'bad', never: 'bad' }
const CHIP_LABEL: Record<CampStatus, string> = { ok: 'Up to date', due: 'Due soon', expired: 'Overdue', never: 'Never' }
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
  const [editing, setEditing] = useState<Camp | null>(null)

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
      back="/library"
      backLabel="Library"
    >
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Camp, contractor, area" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {d.loaded && d.camps.length === 0 ? (
        <div className="empty-state">
          <Icon name="tent" size={44} />
          <b>No camps yet</b>
          Tap Create to add a camp. Each camp shows when it was last inspected.
        </div>
      ) : (
        <>
          <div className="section-label">
            {rows.length} camp{rows.length === 1 ? '' : 's'}
            {expired ? ` · ${expired} expired` : ''}
          </div>
          <div className="list">
            {rows.map(({ c, s }) => (
              <MediaRow
                key={c.uuid}
                cover={<Cover section="camps" seed={c.name} icon="tent" size={48} />}
                title={c.name}
                sub={[s.lastDate ? `Last ${shortDate(s.lastDate)} · ${ago(s.daysSince ?? 0)}` : '', d.byUuid.get(c.contractorUuid)?.name ?? '', c.location]
                  .filter(Boolean)
                  .join(' · ') || 'No inspection yet'}
                trail={
                  c.active ? (
                    <span className={`status-chip ${CHIP[s.status]}`}>{CHIP_LABEL[s.status]}</span>
                  ) : (
                    <span className="row-trail">Inactive</span>
                  )
                }
                onOpen={() => navigate(`/camps/${c.uuid}`)}
                onMore={() =>
                  showActions({
                    title: c.name,
                    sub: s.lastDate ? `Last inspected ${shortDate(s.lastDate)}` : 'Never inspected',
                    cover: <Cover section="camps" seed={c.name} icon="tent" size={56} />,
                    actions: [
                      { label: 'Start inspection', icon: 'play', onSelect: () => navigate(`/new/accommodation?camp=${c.uuid}`), edit: true },
                      { label: 'Open inspection log', icon: 'clipboard', onSelect: () => navigate(`/camps/${c.uuid}`) },
                      { label: 'Edit camp', icon: 'pencil', onSelect: () => setEditing(c), edit: true },
                    ],
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      <div className="list-foot">Inspect every camp at least every 90 days. Hold a camp to start an inspection.</div>

      {editing && <CampSheet camp={editing} onClose={() => setEditing(null)} />}
    </Page>
  )
}
