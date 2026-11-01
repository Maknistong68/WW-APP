import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import Modal from '../components/Modal'
import CardList from '../components/CardList'
import ItemRow from '../components/ItemRow'
import SiteScene from '../three/SiteScene'
import { SceneErrorBoundary } from '../three/SceneGuard'
import type { Focus } from '../three/CameraRig'
import type { BarOffice } from '../three/HealthBars'
import { reducedMotion, usePalette } from '../three/theme3d'
import { useAuthInfo } from '../lib/auth'
import {
  FLOORS,
  SITES,
  SITE_BY_ID,
  buildTour,
  canRotate,
  fitCheck,
  fitHint,
  homeLayout,
  layoutFrom,
  linkOffices,
  officeWorld,
  rotatePlace,
  samePlace,
  siteMonth,
  siteMonths,
  type Fit,
  type Layout,
  type OfficeLink,
  type SiteDef,
  type SiteMonth,
} from '../lib/site'
import { commitLayout, useSitePlaces } from '../lib/sitePlaces'
import { monthLabel } from '../lib/dates'
import { STATUS_LABEL, kpiStatus, pct } from '../lib/kpi'
import { useAllData } from '../lib/kpiData'
import { kpiTone } from '../lib/tone'
import '../styles/city.css'

/** three.js (r163+) needs WebGL 2. */
function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/** Phones and tablets: lighter rendering. */
const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

const hasIdle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
const idle = (fn: () => void): number => (hasIdle ? window.requestIdleCallback(fn, { timeout: 300 }) : window.setTimeout(fn, 16))
const cancelIdle = (id: number) => (hasIdle ? window.cancelIdleCallback(id) : window.clearTimeout(id))

type Stage = 'data' | 'graphics' | 'first frame'
const WATCHDOG_MS = 10000

/** "SAMA", "Al Fahad 823" */
const shortName = (l: OfficeLink) => (l.subjects.length === 1 && l.subjects[0].workOrder ? `${l.contractor.name} ${l.subjects[0].workOrder.number}` : l.contractor.name)

interface Edit {
  base: Layout
  draft: Layout
  selected: string | null
}

/** "Live site": the project as an animated construction site; each office's health bar is its KPI. */
export default function City3DPage() {
  const navigate = useNavigate()
  const d = useAllData()
  const rows = useSitePlaces()
  const { canEdit } = useAuthInfo()
  const palette = usePalette()
  const motion = useMemo(() => !reducedMotion(), [])
  const webgl = useMemo(hasWebGL, [])
  const lite = useMemo(isTouch, [])
  const saved = useMemo(() => layoutFrom(rows ?? []), [rows])
  const links = useMemo(() => (d.loaded ? linkOffices(d) : null), [d])
  const months = useMemo(() => (d.loaded ? siteMonths(d) : []), [d])
  // Open on the latest month that has KPI entries (this month is often still empty).
  const start = useMemo(() => {
    const has = new Set(d.kpis.map((k) => k.month))
    for (let i = months.length - 1; i >= 0; i--) if (has.has(months[i])) return i
    return months.length - 1
  }, [d.kpis, months])

  // This month first (fast first frame), the others in idle time.
  const [data, setData] = useState<(SiteMonth | undefined)[]>([])
  useEffect(() => {
    if (!links || months.length === 0) return
    const arr: (SiteMonth | undefined)[] = new Array(months.length).fill(undefined)
    arr[start] = siteMonth(d, links, months[start])
    setData([...arr])
    const order = months.map((_, i) => i).filter((i) => i !== start)
    let id = 0
    const step = () => {
      const i = order.shift()
      if (i === undefined) return
      arr[i] = siteMonth(d, links, months[i])
      setData([...arr])
      id = idle(step)
    }
    id = idle(step)
    return () => cancelIdle(id)
  }, [d, links, months, start])
  const ready = data.length === months.length && months.length > 0 && data.every(Boolean)

  // Watchdog: explain instead of spinning forever.
  const stage = useRef<Stage>('data')
  const drawn = useRef(false)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!drawn.current) setProblem(`It stopped while preparing the ${stage.current}.`)
    }, WATCHDOG_MS)
    return () => window.clearTimeout(id)
  }, [])

  const [idx, setIdx] = useState<number | null>(null)
  const cur = idx ?? start
  const [playing, setPlaying] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [tour, setTour] = useState<number | null>(null)
  const [sheet, setSheet] = useState<'list' | 'legend' | 'reset' | null>(null)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const m = data[cur] ?? data[start]
  const layout = edit?.draft ?? saved
  const fly = (x: number, z: number, dist = 18) => setFocus((f) => ({ x, z, dist, v: (f?.v ?? 0) + 1 }))

  const offices: BarOffice[] = useMemo(() => {
    if (!links) return []
    const out: BarOffice[] = []
    SITES.forEach((def, site) => {
      for (const o of def.offices) {
        const l = links.offices.get(o.key)
        if (l) out.push({ key: o.key, site, at: o.at, name: shortName(l), off: l.off })
      }
    })
    return out
  }, [links])
  const officeDef = (key: string) => SITES.find((s) => s.offices.some((o) => o.key === key))
  const flyToOffice = (key: string, dist = 26) => {
    const def = officeDef(key)
    const o = def?.offices.find((x) => x.key === key)
    if (!def || !o) return
    const w = officeWorld(def, layout[def.id], o)
    // aim a little in front of the office so it sits above the card
    fly(w.x, w.z + 4, dist)
  }

  // Play through the months.
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setIdx((i) => {
        const at = i ?? months.length - 1
        if (at >= months.length - 1) {
          setPlaying(false)
          return at
        }
        return at + 1
      })
    }, 2200)
    return () => window.clearInterval(id)
  }, [playing, months.length])

  const stops = useMemo(() => (links && m ? buildTour(links, m) : []), [links, m])
  // Tour: fly through the month's worst sites.
  useEffect(() => {
    if (tour === null) return
    const stop = stops[tour]
    if (!stop) {
      setTour(null)
      return
    }
    if (stop.officeKey) {
      setSel(stop.officeKey)
      flyToOffice(stop.officeKey, 24)
    } else {
      setSel(null)
      setFocus(null)
    }
    const id = window.setTimeout(() => setTour((t) => (t === null ? null : t + 1)), 4200)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, m?.month])

  // Edit mode: every site's fit, and whether Done can save.
  const fits = useMemo(() => {
    if (!edit) return null
    const out: Record<string, Fit> = {}
    for (const s of SITES) out[s.id] = fitCheck(edit.draft, s.id)
    return out
  }, [edit])
  const allFit = !!fits && Object.values(fits).every((f) => f.ok)
  const changed = !!edit && SITES.filter((s) => !samePlace(edit.base[s.id], edit.draft[s.id])).length

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  if (!webgl) {
    return (
      <div className="city-fallback">
        <IconTile icon="cube" tone="none" size={64} />
        <h1>3D isn’t available on this device</h1>
        <p>Your browser can’t draw 3D graphics. The normal dashboard has the same numbers.</p>
        <button className="btn primary" onClick={() => navigate('/dashboard')}>
          Open the 2D dashboard
        </button>
      </div>
    )
  }

  const link = sel ? links?.offices.get(sel) : undefined
  const health = sel ? m?.offices.get(sel) : undefined
  const selDef = sel ? officeDef(sel) : undefined
  const siblings = selDef ? selDef.offices.filter((o) => links?.offices.has(o.key)) : []
  const stop = tour !== null ? stops[tour] : undefined
  const labelOf = (def: SiteDef) => `${def.title} (${def.offices.map((o) => (links?.offices.get(o.key) ? shortName(links.offices.get(o.key)!) : o.names[0])).join(' + ')})`

  const pick = (key: string) => {
    if (edit) return
    setTour(null)
    setSel(key)
    flyToOffice(key)
  }
  const tapSite = (siteId: string) => {
    const def = SITE_BY_ID.get(siteId)
    const o = def?.offices.find((x) => links?.offices.has(x.key))
    if (o) pick(o.key)
  }
  const startEdit = () => {
    setTour(null)
    setPlaying(false)
    setSel(null)
    setFocus(null)
    setEdit({ base: saved, draft: saved, selected: null })
  }
  const save = async () => {
    if (!edit || !allFit) return
    setSaving(true)
    try {
      const n = await commitLayout(edit.base, edit.draft, labelOf)
      setToast(n ? `Layout saved · ${n} site${n === 1 ? '' : 's'} moved` : 'No changes')
      setEdit(null)
    } catch (e) {
      setToast(`Couldn’t save the layout: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  if (m && stage.current === 'data') stage.current = 'graphics'
  const editDef = edit?.selected ? SITE_BY_ID.get(edit.selected) : undefined
  const editFit = editDef && fits ? fits[editDef.id] : null
  const summary = m
    ? `${monthLabel(m.month)}: site KPI ${pct(m.overall)}. ${m.counts.bad} critical, ${m.counts.warn} at risk, ${m.counts.good} on track, ${m.counts.none} with no data.`
    : ''

  return (
    <div className={`city${edit ? ' editing' : ''}`}>
      {m && links ? (
        <SceneErrorBoundary onError={(msg) => setProblem(`The 3D view hit an error: ${msg}`)}>
          <SiteScene
            layout={layout}
            offices={offices}
            health={m.offices}
            palette={palette}
            motion={motion}
            lite={lite}
            selectedOffice={sel}
            focus={focus}
            editing={!!edit}
            editSelected={edit?.selected ?? null}
            editFit={editFit}
            onTapSite={tapSite}
            onPickOffice={pick}
            onNothing={() => !edit && setSel(null)}
            onEditGrab={(id) => setEdit((e) => (e ? { ...e, selected: id } : e))}
            onEditMove={(id, place) => setEdit((e) => (e ? { ...e, draft: { ...e.draft, [id]: place } } : e))}
            onEditDrop={() => {}}
            onCreated={() => (stage.current = 'first frame')}
            onFirstFrame={() => {
              // Dev-only switch to test the watchdog: #/dashboard/3d?stall
              if (import.meta.env.MODE === 'development' && window.location.hash.includes('stall')) return
              drawn.current = true
            }}
            onLost={() => setProblem('The phone paused 3D graphics (usually low memory).')}
          />
        </SceneErrorBoundary>
      ) : (
        <div className="city-loading">Building the site…</div>
      )}
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>
      {problem && (
        <div className="city-guard" role="alert">
          <IconTile icon="cube" tone="warn" size={64} />
          <h2>3D isn’t working on this phone right now</h2>
          <p>{problem}</p>
          <div className="btn-row">
            <button className="btn" onClick={() => navigate('/dashboard')}>
              Open 2D dashboard
            </button>
            <button className="btn primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Top: back to 2D, title, tools */}
      {edit ? (
        <div className="city-top">
          <div className="city-title">
            <b>Move sites</b>
            <span>Drag a site. Turn it with ↻. Done saves it for the team.</span>
          </div>
        </div>
      ) : (
        <div className="city-top">
          <button className="city-btn" onClick={() => navigate('/dashboard')} aria-label="Back to the 2D dashboard">
            <Icon name="chevron-left" size={20} strokeWidth={2.4} /> 2D
          </button>
          <div className="city-title">
            <b>Live site</b>
            <span>{m ? `KPI ${pct(m.overall)} · ${monthLabel(m.month)}` : ''}</span>
          </div>
          <button className={`city-btn icon${tour !== null ? ' on' : ''}`} aria-label={tour !== null ? 'Stop the tour' : 'Tour the sites that need attention'} onClick={() => (tour !== null ? setTour(null) : (setSel(null), setTour(0)))}>
            <Icon name={tour !== null ? 'pause' : 'play'} size={20} fill />
          </button>
          <button className="city-btn icon" aria-label="List all sites" onClick={() => setSheet('list')}>
            <Icon name="stack" size={20} />
          </button>
          {canEdit && (
            <button className="city-btn icon" aria-label="Move sites" onClick={startEdit}>
              <Icon name="pencil" size={20} />
            </button>
          )}
          <button className="city-btn icon" aria-label="What am I looking at?" onClick={() => setSheet('legend')}>
            <Icon name="info" size={20} />
          </button>
          <button className="city-btn icon" aria-label="Reset the view" onClick={() => (setSel(null), setTour(null), setFocus(null))}>
            <Icon name="locate" size={20} />
          </button>
        </div>
      )}

      {/* Tour caption */}
      {stop && !edit && (
        <div className={`city-caption ${stop.tone}`}>
          <Icon name={stop.tone === 'bad' ? 'alert' : stop.tone === 'warn' ? 'clock' : 'check-circle'} size={18} fill />
          <span>{stop.text}</span>
        </div>
      )}
      {toast && <div className="city-caption good">{toast}</div>}

      {/* Bottom: edit bar, site card or time bar */}
      <div className="city-bottom">
        {edit && (
          <div className="city-edit">
            <div className={`city-edit-hint ${editFit ? (editFit.ok ? 'good' : 'bad') : ''}`}>
              {editDef && editFit ? (
                <>
                  <b>{editDef.title}</b> · {fitHint(editFit, editDef)}
                  {!canRotate(editDef) && ' · faces the sea'}
                </>
              ) : allFit ? (
                'Tap and drag a site to move it.'
              ) : (
                'Some sites overlap — fix the red ones.'
              )}
            </div>
            <div className="city-edit-row">
              <button className="btn" disabled={!editDef || !canRotate(editDef)} onClick={() => editDef && setEdit((e) => (e ? { ...e, draft: { ...e.draft, [editDef.id]: rotatePlace(editDef, e.draft[editDef.id]) } } : e))}>
                <Icon name="refresh" size={18} /> Turn
              </button>
              <button className="btn" onClick={() => setSheet('reset')}>
                <Icon name="undo" size={18} /> Reset
              </button>
              <button className="btn" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="btn primary" disabled={!allFit || saving} onClick={save}>
                {saving ? 'Saving…' : changed ? `Done · ${changed}` : 'Done'}
              </button>
            </div>
          </div>
        )}
        {!edit && link && health && selDef && (
          <div className="city-card">
            <div className="city-card-head">
              <IconTile icon="hard-hat" tone={kpiTone(health.status)} size={52} />
              <div className="city-card-title">
                <b>{link.label}</b>
                <span>
                  {selDef.title} ·{' '}
                  <StatusChip tone={kpiTone(health.status)}>
                    {pct(health.overall)} · {STATUS_LABEL[health.status]}
                  </StatusChip>
                </span>
              </div>
              <button className="city-x" aria-label="Close" onClick={() => setSel(null)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            {siblings.length > 1 && (
              <div className="segmented city-switch">
                {siblings.map((o) => (
                  <button key={o.key} className={o.key === sel ? 'on' : ''} onClick={() => setSel(o.key)}>
                    {shortName(links!.offices.get(o.key)!)}
                  </button>
                ))}
              </div>
            )}
            <div className={`city-health ${kpiTone(health.status)}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health.overall ?? undefined} aria-label="KPI">
              <span style={{ width: `${Math.round(health.fill * 100)}%` }} />
            </div>
            <div className="city-floors">
              {FLOORS.map((f, i) => (
                <button key={f.key} className={`city-floor ${kpiTone(kpiStatus(health.parts[i]))}`} onClick={() => navigate(`/kpis/${f.key}?m=${m?.month ?? ''}`)}>
                  <span>{f.label}</span>
                  <b>{pct(health.parts[i])}</b>
                </button>
              ))}
            </div>
            {link.off && <div className="city-note">Switched off in Contractors, so it isn’t in the site KPI. Switch it on to count it.</div>}
            <div className="btn-row">
              <button className="btn primary" onClick={() => navigate(`/contractors/${link.contractor.uuid}`)}>
                Open contractor
              </button>
            </div>
          </div>
        )}
        {!edit && !(link && health) && (
          <div className="city-time">
            <button className="city-play" disabled={!ready || months.length < 2} aria-label={playing ? 'Pause' : 'Play the months'} onClick={() => (cur >= months.length - 1 && !playing ? (setIdx(0), setPlaying(true)) : setPlaying((p) => !p))}>
              <Icon name={playing ? 'pause' : 'play'} size={22} fill />
            </button>
            <div className="city-scrub">
              <div className="city-month">
                <b>{months[cur] ? monthLabel(months[cur]) : ''}</b>
                {m && <span>{ready ? (m.counts.bad || m.counts.warn ? `${m.counts.bad} critical · ${m.counts.warn} at risk` : 'All on track') : 'Preparing months…'}</span>}
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, months.length - 1)}
                value={cur}
                disabled={!ready}
                aria-label="Month"
                onChange={(e) => {
                  setPlaying(false)
                  setIdx(Number(e.target.value))
                }}
              />
            </div>
          </div>
        )}
      </div>

      {sheet === 'list' && m && links && (
        <Modal title={`Sites · ${monthLabel(m.month)}`} onClose={() => setSheet(null)}>
          <div className="sheet-body">
            <CardList title="On the map" count={offices.length}>
              {[...offices]
                .sort((a, b) => (m.offices.get(a.key)?.overall ?? 101) - (m.offices.get(b.key)?.overall ?? 101))
                .map((o) => {
                  const h = m.offices.get(o.key)
                  const l = links.offices.get(o.key)!
                  return (
                    <ItemRow
                      key={o.key}
                      tile={<IconTile icon="hard-hat" tone={kpiTone(h?.status ?? 'none')} size={44} />}
                      title={l.label}
                      sub={`${SITES[o.site].title} · KPI ${pct(h?.overall ?? null)}${l.off ? ' · switched off' : ''}`}
                      onOpen={() => {
                        setSheet(null)
                        pick(o.key)
                      }}
                    />
                  )
                })}
            </CardList>
            {m.unmapped.length > 0 && (
              <CardList title="Not on the map" count={m.unmapped.length}>
                {m.unmapped.map((u) => (
                  <ItemRow
                    key={u.subject.key}
                    tile={<IconTile text={u.subject.contractor.name} tone={kpiTone(u.status)} size={44} />}
                    title={u.subject.label}
                    sub={`KPI ${pct(u.overall)} · no site on the map`}
                    onOpen={() => navigate(`/contractors/${u.subject.contractor.uuid}`)}
                  />
                ))}
              </CardList>
            )}
          </div>
        </Modal>
      )}
      {sheet === 'reset' && (
        <Modal title="Reset the layout?" onClose={() => setSheet(null)}>
          <div className="sheet-body">
            <p className="city-note">Every site goes back to its default place. Nothing is saved until you press Done.</p>
            <div className="btn-row">
              <button className="btn" onClick={() => setSheet(null)}>
                Keep my layout
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  setEdit((e) => (e ? { ...e, draft: homeLayout(), selected: null } : e))
                  setSheet(null)
                }}
              >
                Reset layout
              </button>
            </div>
          </div>
        </Modal>
      )}
      {sheet === 'legend' && (
        <Modal title="What am I looking at?" onClose={() => setSheet(null)}>
          <div className="sheet-body city-legend">
            <p>
              The <b>octagon</b> is the project site. Each contractor or work order has its own site with its scope of works: earthworks, pipeline, culvert, bridge, roads,
              buildings, plant, reservoir, port, seawall and the Coast Guard building.
            </p>
            <p>
              The <b>health bar</b> over each site office is that month’s overall KPI: a full bar is 100% (full compliance), an empty bar is 0%.{' '}
              <span className="good">Green</span> on track (90%+), <span className="warn">amber</span> at risk (70–89%), <span className="bad">red</span> critical (below 70%), grey no data.
            </p>
            <p>Tap a site or its bar to see the 8 KPI items. Zoom in to see the names.</p>
            <p>Press ▶ at the bottom to play the months, or ▶ at the top to tour the sites that need attention.</p>
            {canEdit && <p>Use ✎ to move sites. Drag a site on the grid; it turns green when it fits and red when it overlaps. Done saves the layout for the whole team.</p>}
            <p>Day or night follows the app theme. Machines and workers are for show only; they don’t stand for real numbers.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
