import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import Modal from '../components/Modal'
import CardList from '../components/CardList'
import ItemRow from '../components/ItemRow'
import SiteScene, { type EditTool } from '../three/SiteScene'
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
  canEditLayout,
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
import { commitLayout, useMapItemRows, useSitePlaces } from '../lib/sitePlaces'
import {
  ITEM_LABEL,
  diffItems,
  itemsFrom,
  moveItem,
  removePoint,
  rotateItem,
  snapPoint,
  treeRow,
  type MapItem,
  type XZ,
} from '../lib/mapItems'
import { newUuid } from '../db'
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

interface Snap {
  draft: Layout
  items: MapItem[]
}

interface Edit {
  base: Layout
  draft: Layout
  /** Selected site (Move tool). */
  selected: string | null
  baseItems: MapItem[]
  items: MapItem[]
  tool: EditTool
  /** Selected map item; point = a road corner or one palm (-1 = the whole item). */
  item: { uuid: string; point: number } | null
  roadKind: 'road' | 'highway'
  /** The road being drawn. */
  drawing: XZ[]
  /** Trees: plant one, or a row from a start point to an end point. */
  rowMode: boolean
  rowStart: XZ | null
  /** This session's palms go into one item (one row in the log, not hundreds). */
  plantUuid: string | null
  history: Snap[]
}

const TOOLS: { key: EditTool; label: string; icon: 'move' | 'road' | 'palm' | 'tent' | 'village' }[] = [
  { key: 'move', label: 'Move', icon: 'move' },
  { key: 'road', label: 'Road', icon: 'road' },
  { key: 'trees', label: 'Trees', icon: 'palm' },
  { key: 'camp', label: 'Camp', icon: 'tent' },
  { key: 'village', label: 'Village', icon: 'village' },
]

const pushHistory = (e: Edit): Snap[] => [...e.history.slice(-40), { draft: e.draft, items: e.items }]

/** Turn the road being drawn into a map item (needs 2+ points). */
function finishRoad(e: Edit): Edit {
  if (e.drawing.length < 2) return { ...e, drawing: [] }
  const road: MapItem = { uuid: newUuid(), kind: e.roadKind, points: e.drawing }
  return { ...e, history: pushHistory(e), items: [...e.items, road], drawing: [] }
}

/** "Live site": the project as an animated construction site; each office's health bar is its KPI. */
export default function City3DPage() {
  const navigate = useNavigate()
  const d = useAllData()
  const rows = useSitePlaces()
  const itemRows = useMapItemRows()
  const { role } = useAuthInfo()
  const canLayout = canEditLayout(role)
  const palette = usePalette()
  const motion = useMemo(() => !reducedMotion(), [])
  const webgl = useMemo(hasWebGL, [])
  const lite = useMemo(isTouch, [])
  const saved = useMemo(() => layoutFrom(rows ?? []), [rows])
  const savedItems = useMemo(() => itemsFrom(itemRows ?? []), [itemRows])
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
  const items = edit?.items ?? savedItems
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
  const changed = useMemo(() => {
    if (!edit) return 0
    const d = diffItems(edit.baseItems, edit.drawing.length > 1 ? [...edit.items, { uuid: 'drawing', kind: edit.roadKind, points: edit.drawing }] : edit.items)
    return SITES.filter((s) => !samePlace(edit.base[s.id], edit.draft[s.id])).length + d.added.length + d.changed.length + d.removed.length
  }, [edit])

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
    setEdit({
      base: saved,
      draft: saved,
      selected: null,
      baseItems: savedItems,
      items: savedItems,
      tool: 'move',
      item: null,
      roadKind: 'road',
      drawing: [],
      rowMode: false,
      rowStart: null,
      plantUuid: null,
      history: [],
    })
  }
  const upd = (f: (e: Edit) => Edit) => setEdit((e) => (e ? f(e) : e))
  const setTool = (tool: EditTool) => upd((e) => ({ ...finishRoad(e), tool, selected: null, item: null, rowStart: null }))
  const addPalms = (e: Edit, pts: XZ[]): Edit => {
    const history = pushHistory(e)
    const mine = e.plantUuid ? e.items.find((i) => i.uuid === e.plantUuid) : undefined
    if (mine) return { ...e, history, items: e.items.map((i) => (i.uuid === mine.uuid ? { ...i, points: [...(i.points ?? []), ...pts] } : i)) }
    const uuid = newUuid()
    return { ...e, history, plantUuid: uuid, items: [...e.items, { uuid, kind: 'trees', points: pts }] }
  }
  const groundTap = (x: number, z: number) =>
    upd((e) => {
      if (e.tool === 'move') return { ...e, selected: null, item: null }
      if (e.tool === 'road') {
        const p = snapPoint(x, z)
        const last = e.drawing[e.drawing.length - 1]
        if (last && last[0] === p[0] && last[1] === p[1]) return e
        return { ...e, drawing: [...e.drawing, p] }
      }
      if (e.tool === 'trees') {
        const p = snapPoint(x, z, 0.25)
        if (!e.rowMode) return addPalms(e, [p])
        if (!e.rowStart) return { ...e, rowStart: p }
        return { ...addPalms(e, treeRow(e.rowStart, p)), rowStart: null }
      }
      const block = moveItem({ uuid: newUuid(), kind: e.tool, x, z, rot: 0 }, 0, 0)
      return { ...e, history: pushHistory(e), items: [...e.items, block], item: { uuid: block.uuid, point: -1 } }
    })
  const selItem = edit?.item ? edit.items.find((i) => i.uuid === edit.item!.uuid) : undefined
  const turnSelected = () =>
    upd((e) => {
      const def = e.selected ? SITE_BY_ID.get(e.selected) : undefined
      if (def && canRotate(def)) return { ...e, history: pushHistory(e), draft: { ...e.draft, [def.id]: rotatePlace(def, e.draft[def.id]) } }
      const it = e.item ? e.items.find((i) => i.uuid === e.item!.uuid) : undefined
      if (it && (it.kind === 'camp' || it.kind === 'village')) return { ...e, history: pushHistory(e), items: e.items.map((i) => (i.uuid === it.uuid ? rotateItem(i) : i)) }
      return e
    })
  const deleteSelected = () =>
    upd((e) => {
      const it = e.item ? e.items.find((i) => i.uuid === e.item!.uuid) : undefined
      if (!it) return e
      const point = e.item!.point
      // one palm, or one corner of a road with 3+ corners; otherwise the whole thing
      const next = point >= 0 && (it.kind === 'trees' || (it.points?.length ?? 0) > 2) ? removePoint(it, point) : null
      const items = next ? e.items.map((i) => (i.uuid === it.uuid ? next : i)) : e.items.filter((i) => i.uuid !== it.uuid)
      return { ...e, history: pushHistory(e), items, item: null }
    })
  const undo = () =>
    upd((e) => {
      if (e.tool === 'road' && e.drawing.length) return { ...e, drawing: e.drawing.slice(0, -1) }
      if (e.rowStart) return { ...e, rowStart: null }
      const last = e.history[e.history.length - 1]
      if (!last) return e
      return { ...e, draft: last.draft, items: last.items, history: e.history.slice(0, -1), selected: null, item: null }
    })
  const save = async () => {
    if (!edit || !allFit) return
    const e = finishRoad(edit)
    setSaving(true)
    try {
      const n = await commitLayout(e.base, e.draft, labelOf, e.baseItems, e.items)
      setToast(n ? `Map saved · ${n} change${n === 1 ? '' : 's'}` : 'No changes')
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
  const hint = (() => {
    if (!edit) return { text: '', tone: '' }
    if (!allFit && !editDef) return { text: 'Some sites overlap or sit in the sea — fix the red ones.', tone: 'bad' }
    switch (edit.tool) {
      case 'move':
        if (editDef && editFit) return { text: `${editDef.title} · ${fitHint(editFit, editDef)}${canRotate(editDef) ? '' : ' · slides along the coast'}`, tone: editFit.ok ? 'good' : 'bad' }
        if (selItem) {
          const what = selItem.kind === 'trees' && edit.item!.point >= 0 ? 'Palm tree' : ITEM_LABEL[selItem.kind][0].toUpperCase() + ITEM_LABEL[selItem.kind].slice(1)
          return { text: `${what} · drag to move${selItem.kind === 'road' || selItem.kind === 'highway' ? ', drag the dots to bend it' : ''}`, tone: 'good' }
        }
        return { text: 'Drag sites, roads, palms, camps or villages. One finger on the ground pans.', tone: '' }
      case 'road':
        return { text: edit.drawing.length === 0 ? `Tap the ground to start a ${edit.roadKind}.` : `${edit.drawing.length} point${edit.drawing.length === 1 ? '' : 's'} · tap to add more, then Finish.`, tone: '' }
      case 'trees':
        return { text: edit.rowMode ? (edit.rowStart ? 'Tap where the row of palms ends.' : 'Tap where the row of palms starts.') : 'Tap the ground to plant a palm.', tone: '' }
      default:
        return { text: `Tap the ground to place a ${ITEM_LABEL[edit.tool]}.`, tone: '' }
    }
  })()
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
            items={items}
            tool={edit?.tool ?? 'move'}
            drawing={edit && edit.tool === 'road' ? edit.drawing : edit?.rowStart ? [edit.rowStart] : null}
            drawingKind={edit?.roadKind ?? 'road'}
            itemSelected={edit?.item ?? null}
            onGroundTap={groundTap}
            onItemGrab={(uuid, point) => upd((e) => ({ ...e, history: pushHistory(e), item: { uuid, point }, selected: null }))}
            onItemChange={(it) => upd((e) => ({ ...e, items: e.items.map((i) => (i.uuid === it.uuid ? it : i)) }))}
            onItemDrop={() => {}}
            onTapSite={tapSite}
            onPickOffice={pick}
            onNothing={() => !edit && setSel(null)}
            onEditGrab={(id) => upd((e) => ({ ...e, history: pushHistory(e), selected: id, item: null }))}
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
            <b>Edit map</b>
            <span>Only Admins can change the map. Done saves it for the team.</span>
          </div>
          <button className="city-btn" onClick={() => setSheet('reset')} aria-label="Put every site back in its default place">
            <Icon name="undo" size={18} /> Sites
          </button>
          <button className="city-btn" onClick={() => setEdit(null)}>
            Cancel
          </button>
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
          {canLayout && (
            <button className="city-btn icon" aria-label="Edit the map" onClick={startEdit}>
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
            <div className="city-tools" role="tablist" aria-label="Map tools">
              {TOOLS.map((t) => (
                <button key={t.key} role="tab" aria-selected={edit.tool === t.key} className={edit.tool === t.key ? 'on' : ''} onClick={() => setTool(t.key)}>
                  <Icon name={t.icon} size={22} fill={edit.tool === t.key} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <div className={`city-edit-hint ${hint.tone}`}>{hint.text}</div>
            <div className="city-edit-row">
              {(edit.tool === 'move' || edit.tool === 'camp' || edit.tool === 'village') && (
                <>
                  <button
                    className="btn"
                    disabled={!((editDef && canRotate(editDef)) || (selItem && (selItem.kind === 'camp' || selItem.kind === 'village')))}
                    onClick={turnSelected}
                  >
                    <Icon name="refresh" size={18} /> Turn
                  </button>
                  <button className="btn danger" disabled={!selItem} onClick={deleteSelected}>
                    <Icon name="trash" size={18} /> Delete
                  </button>
                </>
              )}
              {edit.tool === 'road' && (
                <>
                  <button className="btn" aria-pressed={edit.roadKind === 'highway'} onClick={() => upd((e) => ({ ...e, roadKind: e.roadKind === 'road' ? 'highway' : 'road' }))}>
                    <Icon name="road" size={18} /> {edit.roadKind === 'road' ? 'Small' : 'Highway'}
                  </button>
                  <button className="btn" disabled={edit.drawing.length < 2} onClick={() => upd(finishRoad)}>
                    <Icon name="check" size={18} /> Finish
                  </button>
                </>
              )}
              {edit.tool === 'trees' && (
                <>
                  <button className="btn" aria-pressed={edit.rowMode} onClick={() => upd((e) => ({ ...e, rowMode: !e.rowMode, rowStart: null }))}>
                    <Icon name="palm" size={18} /> {edit.rowMode ? 'Row' : 'Single'}
                  </button>
                  <button className="btn danger" disabled={!selItem} onClick={deleteSelected}>
                    <Icon name="trash" size={18} /> Delete
                  </button>
                </>
              )}
              <button className="btn" disabled={!edit.history.length && !edit.drawing.length && !edit.rowStart} onClick={undo}>
                <Icon name="undo" size={18} /> Undo
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
              The <b>octagon</b> is the project. Its land half is being built now: each contractor or work order has its own site with its scope of works (earthworks,
              pipeline, culvert, bridge, roads, buildings, plant, reservoir, port, seawall and the Coast Guard building). The sea half is the <b>floating city</b>, not built
              yet. Outside the octagon: the highway, the workers’ camp and the village.
            </p>
            <p>
              The <b>health bar</b> over each site office is that month’s overall KPI: a full bar is 100% (full compliance), an empty bar is 0%.{' '}
              <span className="good">Green</span> on track (90%+), <span className="warn">amber</span> at risk (70–89%), <span className="bad">red</span> critical (below 70%), grey no data.
            </p>
            <p>Tap a site or its bar to see the 8 KPI items. Zoom in to see the names.</p>
            <p>Press ▶ at the bottom to play the months, or ▶ at the top to tour the sites that need attention.</p>
            {canLayout && (
              <p>
                ✎ edits the map (Admins only). <b>Move</b>: drag sites, roads, palms, camps and villages; a site turns green when it fits and red when it overlaps or sits in
                the sea. <b>Road</b>: tap points, then Finish. <b>Trees</b>: tap to plant, or Row for a line of palms. <b>Camp</b> / <b>Village</b>: tap to place. Done saves
                it for the whole team.
              </p>
            )}
            <p>Day or night follows the app theme. Machines and workers are for show only; they don’t stand for real numbers.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
