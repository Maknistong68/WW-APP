import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { SITES, samePlace, sizeOf, snapPlace, type Fit, type Layout, type OfficeHealth, type Place } from '../lib/site'
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
  onCreated: () => void
  onFirstFrame: () => void
  onLost: () => void
}

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

  // Edit mode: drag a site over the ground plane, snapped to tiles.
  const drag = useRef<{ i: number; grab: { ox: number; oz: number }; place: Place; pointer: number } | null>(null)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const [drop, setDrop] = useState<{ x: number; z: number; v: number } | null>(null)
  const cb = useRef(props)
  cb.current = props
  const ev = {
    editing: props.editing,
    onTap: (i: number) => cb.current.onTapSite(SITES[i].id),
    onGrab: (i: number, e: ThreeEvent<PointerEvent>) => {
      const def = SITES[i]
      const p = cb.current.layout[def.id]
      if (!e.ray.intersectPlane(plane, hit)) return
      drag.current = { i, grab: { ox: hit.x - p.gx, oz: hit.z - p.gz }, place: p, pointer: e.pointerId }
      ;(e.target as unknown as Element).setPointerCapture?.(e.pointerId)
      if (controls) controls.enabled = false
      cb.current.onEditGrab(def.id)
      invalidate()
    },
    onMove: (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointer || !e.ray.intersectPlane(plane, hit)) return
      const def = SITES[d.i]
      const np = snapPlace(def, d.place, hit.x, hit.z, d.grab)
      if (!samePlace(np, d.place)) {
        d.place = np
        cb.current.onEditMove(def.id, np)
      }
      invalidate()
    },
    onDrop: (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current
      if (!d) return
      ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
      if (controls) controls.enabled = true
      rig.drop(d.i)
      const def = SITES[d.i]
      const s = sizeOf(def, d.place.rot)
      setDrop((x) => ({ x: d.place.gx + s.w / 2, z: d.place.gz + s.d / 2, v: (x?.v ?? 0) + 1 }))
      cb.current.onEditDrop(def.id)
      drag.current = null
      invalidate()
    },
  }
  useEffect(() => {
    if (!props.editing && controls) controls.enabled = true
  }, [props.editing, controls])

  const night = palette.dark
  const near = lite ? 130 : 95
  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, near, near * 2.3]} />
      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemi]} />
      <directionalLight
        position={[22, 42, 28]}
        intensity={palette.sunI}
        color={palette.sun}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      <Ground palette={palette} editing={props.editing} shadows={shadows} />
      <SitePlots rig={rig} geos={geos} solid={mats.solid} glow={mats.glow} night={night} shadows={shadows} ev={ev} />
      {builds && <Fleet rig={rig} builds={builds} motion={motion} material={mats.solid} blobs={!shadows} shadows={shadows} />}
      {builds && <Workers rig={rig} builds={builds} motion={motion} material={mats.solid} lite={lite || degraded} blobs={!shadows} shadows={shadows} />}
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
      camera={{ fov: 30, near: 0.5, far: 1000, position: [20, 60, 70] }}
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
