import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { GRID, SITES, WORLD, samePlace, sizeOf, snapPlace, type Fit, type Layout, type OfficeHealth, type Place } from '../lib/site'
import Zones from './Zones'
import { moveItem, movePoint, type MapItem, type XZ } from '../lib/mapItems'
import MapItems from './MapItems'
import { buildSite, type Built } from './scopes'
import { SiteRig } from './rig'
import Ground from './Ground'
import SitePlots, { type SiteGeo } from './SitePlots'
import Fleet from './Fleet'
import Workers from './Workers'
import Effects from './Effects'
import HealthBars, { type BarOffice } from './HealthBars'
import LayoutEditor from './LayoutEditor'
import CameraRig, { type Focus } from './CameraRig'
import { FirstFrame } from './SceneGuard'
import type { Palette } from './theme3d'

export interface SceneProps {
  /** Where the sites are drawn (coast sites already on the basin quay). */
  layout: Layout
  offices: BarOffice[]
  health: Map<string, OfficeHealth>
  palette: Palette
  motion: boolean
  /** Phones: no shadow maps, fewer workers, no effects, 30 fps when idle. */
  lite: boolean
  selectedOffice: string | null
  focus: Focus | null
  editing: boolean
  editSelected: string | null
  editFit: Fit | null
  onTapSite: (siteId: string) => void
  onPickOffice: (key: string) => void
  onNothing: () => void
  onEditGrab: (siteId: string) => void
  onEditMove: (siteId: string, place: Place) => void
  onEditDrop: (siteId: string) => void
  /** Worker figures per site (null = no manpower count yet). */
  crews: (number | null)[]
  /** Map items (roads, highways, palms, camps, villages, zones) and the edit tool. */
  items: MapItem[]
  tool: EditTool
  drawing: XZ[] | null
  drawingKind: 'road' | 'highway'
  itemSelected: { uuid: string; point: number } | null
  onGroundTap: (x: number, z: number) => void
  onItemGrab: (uuid: string, point: number) => void
  onItemChange: (item: MapItem) => void
  onItemDrop: () => void
  onCreated: () => void
  onFirstFrame: () => void
  onLost: () => void
}

export type EditTool = 'move' | 'road' | 'trees' | 'camp' | 'village' | 'zone'

const hasIdle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
const idle = (fn: () => void): number => (hasIdle ? window.requestIdleCallback(fn, { timeout: 120 }) : window.setTimeout(fn, 16))
const cancelIdle = (id: number) => (hasIdle ? window.cancelIdleCallback(id) : window.clearTimeout(id))

/** `?stats` / `#…?stats`: draw calls and triangles for checking the phone budget. */
const STATS = typeof window !== 'undefined' && /[?&]stats\b/.test(window.location.search + window.location.hash)

function Stats() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const frames = useRef({ n: 0, t: 0 })
  useEffect(() => {
    // test helper: where a ground point is on screen (CSS px)
    ;(window as unknown as { __site3dWhere: unknown }).__site3dWhere = (x: number, z: number) => {
      const v = new THREE.Vector3(x, 0, z).project(camera)
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height }
    }
  }, [camera, size])
  useFrame((state) => {
    const f = frames.current
    f.n++
    if (state.clock.elapsedTime - f.t > 1) {
      ;(window as unknown as { __site3d: unknown }).__site3d = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, programs: gl.info.programs?.length ?? 0, fps: f.n / (state.clock.elapsedTime - f.t) }
      f.n = 0
      f.t = state.clock.elapsedTime
    }
  })
  return null
}

/** 30 fps when idle on phones (touch input still renders at full rate). */
function Ticker({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const id = window.setInterval(() => invalidate(), 1000 / fps)
    return () => window.clearInterval(id)
  }, [fps, invalidate])
  return null
}

const SUN = new THREE.Vector3(34, 64, 14).normalize().multiplyScalar(240)

/** The sun: its shadow box follows what the camera looks at and grows as it zooms out, so shadows stay sharp up close. */
function Sun({ palette, shadows }: { palette: SceneProps['palette']; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null!)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  useFrame(() => {
    const l = light.current
    if (!l) return
    const t = controls?.target
    const tx = t?.x ?? 0
    const tz = t?.z ?? 0
    const ext = Math.max(40, Math.min(150, Math.round(camera.position.distanceTo(t ?? l.target.position) * 0.5 / 10) * 10))
    // move in whole shadow texels so the edges don't shimmer
    const texel = (ext * 2) / 2048
    const sx = Math.round(tx / texel) * texel
    const sz = Math.round(tz / texel) * texel
    l.position.set(sx + SUN.x, SUN.y, sz + SUN.z)
    l.target.position.set(sx, 0, sz)
    l.target.updateMatrixWorld()
    const cam = l.shadow.camera
    if (cam.right !== ext) {
      cam.left = -ext
      cam.right = ext
      cam.top = ext
      cam.bottom = -ext
      cam.updateProjectionMatrix()
    }
  })
  return (
    <directionalLight
      ref={light}
      position={[SUN.x, SUN.y, SUN.z]}
      intensity={palette.sunI}
      color={palette.sun}
      castShadow={shadows}
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-80}
      shadow-camera-right={80}
      shadow-camera-top={80}
      shadow-camera-bottom={-80}
      shadow-camera-near={1}
      shadow-camera-far={520}
      shadow-bias={-0.0006}
      shadow-normalBias={0.03}
    />
  )
}

function World(props: SceneProps & { degraded: boolean; shadows: boolean }) {
  const { palette, motion, lite, degraded, shadows } = props
  const invalidate = useThree((s) => s.invalidate)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const rig = useMemo(() => new SiteRig(props.layout, motion), []) // eslint-disable-line react-hooks/exhaustive-deps
  rig.layout = props.layout
  rig.editing = props.editing
  rig.selected = props.editSelected ? SITES.findIndex((s) => s.id === props.editSelected) : -1

  const mats = useMemo(
    () => ({
      solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    }),
    [],
  )
  useEffect(
    () => () => {
      mats.solid.dispose()
      mats.glow.dispose()
    },
    [mats],
  )

  // Build the sites one by one in idle time, so the first frame is quick and they pop in.
  const [geos, setGeos] = useState<(SiteGeo | null)[]>(() => SITES.map(() => null))
  const [builds, setBuilds] = useState<Built[] | null>(null)
  const made = useRef<THREE.BufferGeometry[]>([])
  useEffect(() => {
    const out: Built[] = []
    const g: (SiteGeo | null)[] = SITES.map(() => null)
    let i = 0
    let id = 0
    let alive = true
    const step = () => {
      if (!alive) return
      const b = buildSite(SITES[i])
      const solid = b.solid.geometry()
      const glow = b.glow.geometry()
      made.current.push(solid, glow)
      g[i] = { solid, glow, height: solid.boundingBox ? solid.boundingBox.max.y : 1.5 }
      out.push(b)
      setGeos([...g])
      invalidate()
      i++
      if (i < SITES.length) id = idle(step)
      else setBuilds(out)
    }
    id = idle(step)
    return () => {
      alive = false
      cancelIdle(id)
      for (const geo of made.current) geo.dispose()
      made.current = []
    }
  }, [invalidate])

  // Edit mode: drag a site (snapped to tiles) or a map item over the ground plane.
  type Drag =
    | { type: 'site'; i: number; grab: { ox: number; oz: number }; place: Place; pointer: number }
    | { type: 'item'; start: MapItem; point: number; from: XZ; last: string; pointer: number }
  const drag = useRef<Drag | null>(null)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const [drop, setDrop] = useState<{ x: number; z: number; v: number } | null>(null)
  const cb = useRef(props)
  cb.current = props
  const capture = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as unknown as Element).setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
  }
  const release = (e: ThreeEvent<PointerEvent>) => {
    ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
  }
  const moving = props.editing && props.tool === 'move'
  const ev = {
    mode: (!props.editing ? 'view' : moving ? 'grab' : 'pass') as 'view' | 'grab' | 'pass',
    onTap: (i: number) => cb.current.onTapSite(SITES[i].id),
    onGrab: (i: number, e: ThreeEvent<PointerEvent>) => {
      const def = SITES[i]
      const p = cb.current.layout[def.id]
      if (!e.ray.intersectPlane(plane, hit)) return
      drag.current = { type: 'site', i, grab: { ox: hit.x - p.gx, oz: hit.z - p.gz }, place: p, pointer: e.pointerId }
      capture(e)
      cb.current.onEditGrab(def.id)
      invalidate()
    },
    onMove: (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointer || !e.ray.intersectPlane(plane, hit)) return
      if (d.type === 'site') {
        const def = SITES[d.i]
        const np = snapPlace(def, d.place, hit.x, hit.z, d.grab)
        if (!samePlace(np, d.place)) {
          d.place = np
          cb.current.onEditMove(def.id, np)
        }
      } else {
        const dx = hit.x - d.from[0]
        const dz = hit.z - d.from[1]
        const pt = d.start.points?.[d.point]
        const next = d.point >= 0 && pt ? movePoint(d.start, d.point, pt[0] + dx, pt[1] + dz) : moveItem(d.start, dx, dz)
        const key = JSON.stringify(next)
        if (key !== d.last) {
          d.last = key
          cb.current.onItemChange(next)
        }
      }
      invalidate()
    },
    onDrop: (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current
      if (!d) return
      release(e)
      if (d.type === 'site') {
        rig.drop(d.i)
        const def = SITES[d.i]
        const s = sizeOf(def, d.place.rot)
        setDrop((x) => ({ x: d.place.gx + s.w / 2, z: d.place.gz + s.d / 2, v: (x?.v ?? 0) + 1 }))
        cb.current.onEditDrop(def.id)
      } else {
        cb.current.onItemDrop()
      }
      drag.current = null
      invalidate()
    },
  }
  const itemEv = {
    canGrab: moving,
    onGrab: (uuid: string, point: number, e: ThreeEvent<PointerEvent>) => {
      const start = cb.current.items.find((i) => i.uuid === uuid)
      if (!start || !e.ray.intersectPlane(plane, hit)) return
      drag.current = { type: 'item', start, point, from: [hit.x, hit.z], last: JSON.stringify(start), pointer: e.pointerId }
      capture(e)
      cb.current.onItemGrab(uuid, point)
      invalidate()
    },
    onMove: ev.onMove,
    onDrop: ev.onDrop,
  }
  const zoneTool = props.editing && props.tool === 'zone'
  const zoneEv = { ...itemEv, canGrab: zoneTool }
  useEffect(() => {
    if (!props.editing && controls) controls.enabled = true
  }, [props.editing, controls])

  const night = palette.dark
  const near = lite ? 520 : 420
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, near, near * 2.4]} />
      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemi]} />
      <Sun palette={palette} shadows={shadows} />
      <Ground palette={palette} editing={props.editing} shadows={shadows} motion={motion} />
      <Zones
        items={props.items}
        layout={props.layout}
        solid={mats.solid}
        glow={mats.glow}
        shadows={shadows}
        editing={props.editing}
        zoneTool={zoneTool}
        selected={zoneTool ? props.itemSelected : null}
        ev={zoneEv}
      />
      <MapItems
        items={props.items}
        drawing={props.editing ? props.drawing : null}
        drawingKind={props.drawingKind}
        selected={props.editing ? props.itemSelected : null}
        solid={mats.solid}
        glow={mats.glow}
        night={night}
        shadows={shadows}
        ev={itemEv}
      />
      {props.editing && (
        // taps on the ground: add a road point, plant a palm, place a block, or clear the selection (over water too)
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, (GRID - WORLD) / 2]}
          visible={false}
          onClick={(e) => {
            if (e.delta > 8) return
            e.stopPropagation()
            cb.current.onGroundTap(e.point.x, e.point.z)
          }}
        >
          <planeGeometry args={[WORLD * 2 + 20, WORLD + GRID + 20]} />
          <meshBasicMaterial />
        </mesh>
      )}
      <SitePlots rig={rig} geos={geos} solid={mats.solid} glow={mats.glow} night={night} shadows={shadows} ev={ev} />
      {builds && <Fleet rig={rig} builds={builds} motion={motion} material={mats.solid} blobs={!shadows} shadows={shadows} />}
      {builds && <Workers rig={rig} builds={builds} crews={props.crews} motion={motion} material={mats.solid} lite={lite || degraded} blobs={!shadows} shadows={shadows} />}
      {builds && <Effects rig={rig} builds={builds} motion={motion} puffs={!lite && !degraded} night={night} />}
      <HealthBars rig={rig} offices={props.offices} health={props.health} palette={palette} motion={motion} selected={props.selectedOffice} onPick={(k) => cb.current.onPickOffice(k)} />
      {props.editing && <LayoutEditor layout={props.layout} selected={props.editSelected} fit={props.editFit} palette={palette} motion={motion} drop={drop} />}
      <CameraRig focus={props.focus} motion={motion} editing={props.editing} />
    </>
  )
}

export default function SiteScene(props: SceneProps) {
  const [degraded, setDegraded] = useState(false)
  const { lite, motion } = props
  const shadows = !lite && !degraded
  return (
    <Canvas
      flat
      shadows={shadows}
      frameloop={!motion || lite ? 'demand' : 'always'}
      dpr={[1, degraded ? 1 : lite ? 1.5 : 1.75]}
      camera={{ fov: 30, near: 0.5, far: 2600, position: [60, 220, 200] }}
      gl={{ antialias: true, preserveDrawingBuffer: import.meta.env.MODE === 'development' }}
      onPointerMissed={() => props.onNothing()}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          props.onLost()
        })
        props.onCreated()
      }}
      aria-label="3D view of the site"
    >
      <FirstFrame onFrame={props.onFirstFrame} />
      <PerformanceMonitor onDecline={() => setDegraded(true)} flipflops={2} />
      {motion && lite && <Ticker fps={30} />}
      {STATS && <Stats />}
      {/* Anything that loads (fonts…) must never hold up the whole scene. */}
      <Suspense fallback={null}>
        <World {...props} degraded={degraded} shadows={shadows} />
      </Suspense>
    </Canvas>
  )
}
