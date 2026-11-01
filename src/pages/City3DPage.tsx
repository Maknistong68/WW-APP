import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import Modal from '../components/Modal'
import CardList from '../components/CardList'
import ItemRow from '../components/ItemRow'
import CityScene from '../three/CityScene'
import { SceneErrorBoundary } from '../three/SceneGuard'
import type { Focus } from '../three/CameraRig'
import { ALL_LAYERS, LAYER_LABEL, type Layers } from '../three/layers'
import { reducedMotion, usePalette } from '../three/theme3d'
import { useAuthInfo } from '../lib/auth'
import { FLOORS, buildCity, tideMax, timelineMonths, type City, type CityCamp, type CityTicket, type CityTower } from '../lib/city'
import { CAMP_STATUS_LABEL } from '../lib/camps'
import { monthLabel, shortDate } from '../lib/dates'
import { STATUS_LABEL, kpiStatus, pct } from '../lib/kpi'
import { useAllData } from '../lib/kpiData'
import { sar, sarShort } from '../lib/money'
import { campTone, kpiTone } from '../lib/tone'
import '../styles/city.css'

type Selection = { kind: 'tower'; key: string } | { kind: 'ticket'; uuid: string } | { kind: 'camp'; uuid: string }

/** three.js (r163+) needs WebGL 2. */
function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/** Phones and tablets: lighter rendering (no shadows, no glow, lower resolution). */
const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Run `fn` when the browser is idle (or soon), so building months never freezes the screen. */
const hasIdle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
const idle = (fn: () => void): number => (hasIdle ? window.requestIdleCallback(fn, { timeout: 300 }) : window.setTimeout(fn, 16))
const cancelIdle = (id: number) => (hasIdle ? window.cancelIdleCallback(id) : window.clearTimeout(id))

type Stage = 'data' | 'graphics' | 'first frame'
const WATCHDOG_MS = 10000

/** "Living Site": the dashboard as an animated 3D city. Read-only. */
export default function City3DPage() {
  const navigate = useNavigate()
  const d = useAllData()
  const { canEdit } = useAuthInfo()
  const palette = usePalette()
  const motion = useMemo(() => !reducedMotion(), [])
  const webgl = useMemo(hasWebGL, [])
  const months = useMemo(() => timelineMonths(12), [])
  const aspect = useMemo(() => window.innerWidth / Math.max(1, window.innerHeight), [])
  const lite = useMemo(isTouch, [])
  // The current month first (fast first frame), the other 11 in the background.
  const [cities, setCities] = useState<(City | undefined)[]>([])
  useEffect(() => {
    if (!d.loaded) return
    const max = tideMax(d, months)
    const arr: (City | undefined)[] = new Array(months.length).fill(undefined)
    const last = months.length - 1
    arr[last] = buildCity(d, months[last], undefined, max, aspect)
    setCities([...arr])
    let i = last - 1
    let id = 0
    const step = () => {
      if (i < 0) return
      arr[i] = buildCity(d, months[i], undefined, max, aspect)
      i--
      setCities([...arr])
      id = idle(step)
    }
    id = idle(step)
    return () => cancelIdle(id)
  }, [d, months, aspect])
  const ready = cities.length === months.length && cities.every(Boolean)
  // Fixed size so the orb buffer never has to be rebuilt between months.
  const capacity = useMemo(() => Math.min(800, d.tickets.length) + 8, [d.tickets.length])
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
  const [idx, setIdx] = useState(months.length - 1)
  const [playing, setPlaying] = useState(false)
  const [layers, setLayers] = useState<Layers>(ALL_LAYERS)
  const [sel, setSel] = useState<Selection | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [tour, setTour] = useState<number | null>(null)
  const [sheet, setSheet] = useState<'list' | 'legend' | null>(null)
  const city = cities[idx] ?? cities[months.length - 1]
  const fly = (x: number, z: number, dist = 9) => setFocus((f) => ({ x, z, dist, v: (f?.v ?? 0) + 1 }))

  // Play through the months.
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setIdx((i) => {
        if (i >= months.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 2000)
    return () => window.clearInterval(id)
  }, [playing, months.length])

  // Tour: fly through the month's worst problems.
  useEffect(() => {
    if (tour === null || !city) return
    const stop = city.tour[tour]
    if (!stop) {
      setTour(null)
      return
    }
    fly(stop.x, stop.z, stop.focus ? 15 : city.radius * 1.6)
    const id = window.setTimeout(() => setTour((t) => (t === null ? null : t + 1)), 4500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, city?.month])

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

  const tower = sel?.kind === 'tower' ? city?.towers.find((t) => t.key === sel.key) : undefined
  const towerBlock = tower ? city?.blocks.find((b) => b.contractorUuid === tower.contractorUuid) : undefined
  const ticket = sel?.kind === 'ticket' ? city?.tickets.find((t) => t.uuid === sel.uuid) : undefined
  const camp = sel?.kind === 'camp' ? city?.camps.find((c) => c.uuid === sel.uuid) : undefined
  const stop = tour !== null ? city?.tour[tour] : undefined

  const pickTower = (t: CityTower) => {
    setTour(null)
    setSel({ kind: 'tower', key: t.key })
    fly(t.x, t.z, 11 + t.height * 0.9)
  }
  const pickTicket = (t: CityTicket) => {
    setTour(null)
    setSel({ kind: 'ticket', uuid: t.uuid })
  }
  const pickCamp = (c: CityCamp) => {
    setTour(null)
    setSel({ kind: 'camp', uuid: c.uuid })
    fly(c.x, c.z, 10)
  }
  if (city && stage.current === 'data') stage.current = 'graphics'
  const summary = city
    ? `${monthLabel(city.month)}: ${city.towers.length} work orders across ${city.blocks.length} contractors, site KPI ${pct(city.sky.overall)}, ${city.tide.open} open tickets, ${city.camps.filter((c) => c.status === 'expired' || c.status === 'never').length} camps overdue.`
    : ''

  return (
    <div className="city">
      {city ? (
        <SceneErrorBoundary onError={(m) => setProblem(`The 3D view hit an error: ${m}`)}>
          <CityScene
            city={city}
            capacity={capacity}
            palette={palette}
            layers={layers}
            motion={motion}
            selected={sel?.kind === 'tower' ? sel.key : null}
            focus={focus}
            picks={{ onTower: pickTower, onTicket: pickTicket, onCamp: pickCamp, onNothing: () => setSel(null) }}
            lite={lite}
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
      <div className="city-top">
        <button className="city-btn" onClick={() => navigate('/dashboard')} aria-label="Back to the 2D dashboard">
          <Icon name="chevron-left" size={20} strokeWidth={2.4} /> 2D
        </button>
        <div className="city-title">
          <b>Living site</b>
          <span>{city ? `KPI ${pct(city.sky.overall)}` : ''}</span>
        </div>
        <button className={`city-btn icon${tour !== null ? ' on' : ''}`} aria-label={tour !== null ? 'Stop the tour' : 'Tour the problems'} onClick={() => (tour !== null ? setTour(null) : (setSel(null), setTour(0)))}>
          <Icon name={tour !== null ? 'pause' : 'play'} size={20} fill />
        </button>
        <button className="city-btn icon" aria-label="List everything" onClick={() => setSheet('list')}>
          <Icon name="stack" size={20} />
        </button>
        <button className="city-btn icon" aria-label="What am I looking at?" onClick={() => setSheet('legend')}>
          <Icon name="info" size={20} />
        </button>
        <button className="city-btn icon" aria-label="Reset the view" onClick={() => (setSel(null), setTour(null), setFocus(null))}>
          <Icon name="locate" size={20} />
        </button>
      </div>
      <div className="city-layers" role="group" aria-label="Show on the map">
        {(Object.keys(LAYER_LABEL) as (keyof Layers)[]).map((k) => (
          <button key={k} className={layers[k] ? 'on' : ''} aria-pressed={layers[k]} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}>
            {LAYER_LABEL[k]}
          </button>
        ))}
      </div>

      {/* Tour caption */}
      {stop && (
        <div className={`city-caption ${stop.tone}`}>
          <Icon name={stop.tone === 'bad' ? 'alert' : 'clock'} size={18} fill />
          <span>{stop.text}</span>
          <button onClick={() => navigate(stop.to)}>Open</button>
        </div>
      )}
      {tour !== null && city && city.tour.length === 0 && <div className="city-caption good">Nothing needs attention this month.</div>}

      {/* Bottom: info card or time bar */}
      <div className="city-bottom">
        {tower && towerBlock && (
          <div className="city-card">
            <div className="city-card-head">
              <IconTile text={towerBlock.name} tone={kpiTone(tower.status)} size={52} />
              <div className="city-card-title">
                <b>{tower.subjectLabel}</b>
                <span>
                  <StatusChip tone={kpiTone(tower.status)}>
                    {pct(tower.overall)} · {STATUS_LABEL[tower.status]}
                  </StatusChip>
                </span>
              </div>
              <button className="city-x" aria-label="Close" onClick={() => setSel(null)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="city-floors">
              {FLOORS.map((f, i) => (
                <div key={f.key} className={`city-floor ${kpiTone(tower.floors[i])}`}>
                  <span>{f.label}</span>
                  <b>{pct(tower.floorValues[i])}</b>
                </div>
              ))}
            </div>
            <div className="facts">
              <div className="fact">
                <div className="fact-num">{tower.workers ?? '—'}</div>
                <div className="fact-label">Workers{tower.illegal ? ` · ${tower.illegal} illegal` : ''}</div>
              </div>
              <div className="fact">
                <div className={`fact-num ${towerBlock.openTickets ? 'bad' : ''}`}>{towerBlock.openTickets}</div>
                <div className="fact-label">Open tickets (contractor)</div>
              </div>
              <div className="fact">
                <div className="fact-num">{towerBlock.owed ? sarShort(towerBlock.owed) : '—'}</div>
                <div className="fact-label">SAR owed</div>
              </div>
              <div className="fact">
                <div className={`fact-num ${tower.submissions.every(Boolean) ? 'good' : 'warn'}`}>{tower.submissions.filter(Boolean).length}/3</div>
                <div className="fact-label">WPS · MP · Salary</div>
              </div>
            </div>
            {tower.findings && (
              <div className="city-note">
                Audit close-out: {tower.findings.closed} of {tower.findings.total} findings closed ({tower.findings.status})
              </div>
            )}
            <div className="btn-row">
              <button className="btn primary" onClick={() => navigate(`/contractors/${tower.contractorUuid}`)}>
                Open contractor
              </button>
            </div>
          </div>
        )}
        {ticket && (
          <div className="city-card">
            <div className="city-card-head">
              <IconTile icon="ticket" tone={ticket.ring === 2 ? 'bad' : ticket.ring === 1 ? 'warn' : 'good'} size={52} />
              <div className="city-card-title">
                <b>{ticket.ticketNo}</b>
                <span>{ticket.issue || 'Ticket'}</span>
              </div>
              <button className="city-x" aria-label="Close" onClick={() => setSel(null)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="facts">
              <div className="fact">
                <div className={`fact-num ${ticket.ring === 2 ? 'bad' : ticket.ring === 1 ? 'warn' : 'good'}`}>{ticket.age}d</div>
                <div className="fact-label">Open for</div>
              </div>
              <div className="fact">
                <div className="fact-num">{ticket.workers}</div>
                <div className="fact-label">Workers</div>
              </div>
              <div className="fact" style={{ gridColumn: '1 / -1' }}>
                <div className="fact-num">{ticket.owed ? sar(ticket.owed) : '—'}</div>
                <div className="fact-label">Money owed</div>
              </div>
            </div>
            <div className="btn-row">
              <button className="btn primary" onClick={() => navigate(`/tickets/${ticket.uuid}`)}>
                Open ticket
              </button>
            </div>
          </div>
        )}
        {camp && (
          <div className="city-card">
            <div className="city-card-head">
              <IconTile icon="tent" tone={campTone(camp.status)} size={52} />
              <div className="city-card-title">
                <b>{camp.name}</b>
                <span>
                  <StatusChip tone={campTone(camp.status)}>{CAMP_STATUS_LABEL[camp.status]}</StatusChip>
                </span>
              </div>
              <button className="city-x" aria-label="Close" onClick={() => setSel(null)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="facts">
              <div className="fact">
                <div className={`fact-num ${camp.daysLeft === null || camp.daysLeft < 0 ? 'bad' : camp.daysLeft <= 14 ? 'warn' : 'good'}`}>
                  {camp.daysLeft === null ? '—' : camp.daysLeft < 0 ? `${-camp.daysLeft}d late` : `${camp.daysLeft}d`}
                </div>
                <div className="fact-label">Until next inspection</div>
              </div>
              <div className="fact">
                <div className="fact-num">{camp.lastDate ? shortDate(camp.lastDate) : '—'}</div>
                <div className="fact-label">Last inspected</div>
              </div>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => navigate(`/camps/${camp.uuid}`)}>
                Open camp
              </button>
              {canEdit && (
                <button className="btn primary" onClick={() => navigate(`/new/accommodation?camp=${camp.uuid}`)}>
                  Start inspection
                </button>
              )}
            </div>
          </div>
        )}
        {!tower && !ticket && !camp && (
          <div className="city-time">
            <button className="city-play" disabled={!ready} aria-label={playing ? 'Pause' : 'Play the last 12 months'} onClick={() => (idx >= months.length - 1 && !playing ? (setIdx(0), setPlaying(true)) : setPlaying((p) => !p))}>
              <Icon name={playing ? 'pause' : 'play'} size={22} fill />
            </button>
            <div className="city-scrub">
              <div className="city-month">
                <b>{monthLabel(months[idx])}</b>
                {city && (
                  <span>
                    {ready ? `${city.tide.open} open · ${sarShort(city.blocks.reduce((s, b) => s + b.owed, 0))} SAR owed` : 'Preparing months…'}
                  </span>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={months.length - 1}
                value={idx}
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

      {sheet === 'list' && city && (
        <Modal title={`Everything · ${monthLabel(city.month)}`} onClose={() => setSheet(null)}>
          <div className="sheet-body">
            <CardList title="Contractors" count={city.blocks.length}>
              {city.blocks.map((b) => (
                <ItemRow
                  key={b.contractorUuid}
                  tile={<IconTile text={b.name} tone={kpiTone(b.status)} size={44} />}
                  title={b.name}
                  sub={`KPI ${pct(b.overall)} · ${b.openTickets} open · ${b.owed ? `${sarShort(b.owed)} SAR` : 'no money owed'}`}
                  onOpen={() => {
                    setSheet(null)
                    const t = city.towers.find((x) => x.contractorUuid === b.contractorUuid)
                    if (t) pickTower(t)
                  }}
                />
              ))}
            </CardList>
            {city.camps.length > 0 && (
              <CardList title="Camps" count={city.camps.length}>
                {city.camps.map((c) => (
                  <ItemRow
                    key={c.uuid}
                    tile={<IconTile icon="tent" tone={campTone(c.status)} size={44} />}
                    title={c.name}
                    sub={c.daysLeft === null ? 'Never inspected' : c.daysLeft < 0 ? `${-c.daysLeft} days overdue` : `${c.daysLeft} days left`}
                    onOpen={() => {
                      setSheet(null)
                      pickCamp(c)
                    }}
                  />
                ))}
              </CardList>
            )}
          </div>
        </Modal>
      )}
      {sheet === 'legend' && (
        <Modal title="What am I looking at?" onClose={() => setSheet(null)}>
          <div className="sheet-body city-legend">
            <p>
              <b>Towers</b> are work orders, grouped on a plot per contractor. Height = workers declared.
            </p>
            <p>
              <b>8 glowing floors</b> = the 8 KPIs, bottom to top: {FLOORS.map((f) => f.label).join(', ')}.{' '}
              <span className="good">Green</span> on track, <span className="warn">amber</span> at risk, <span className="bad">red</span> critical, grey no data.
            </p>
            <p>
              <b>Roof beacon</b> = overall KPI ({STATUS_LABEL[kpiStatus(90)]} / {STATUS_LABEL[kpiStatus(75)]} / {STATUS_LABEL[kpiStatus(50)]}); critical towers shoot a red beam.
            </p>
            <p>
              <b>3 roof lights</b> = WPS, manpower and salary declarations (red blinking = missing). A drone lands when all three are in.
            </p>
            <p>
              <b>Orbs</b> are open tickets circling their contractor: low and green = new, middle amber = 11–30 days, high red = over 30 days. Lines join combined tickets.
            </p>
            <p>
              <b>Gold coins</b> = money still owed on tickets. Recovered money flies into the vault.
            </p>
            <p>
              <b>Red smoke</b> = illegal / freelance workers. <b>Cubes</b> at a tower’s base = audit findings (green = closed).
            </p>
            <p>
              <b>Tents</b> are camps; the ring is the time left before the next inspection.
            </p>
            <p>
              <b>The water</b> is the backlog tide: it rises with open tickets. <b>The sky</b> clears when the site KPI is good and turns stormy when it’s critical.
            </p>
            <p>Press ▶ at the bottom to play the last 12 months, or ▶ at the top for a tour of the problems.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
