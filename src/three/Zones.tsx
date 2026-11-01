import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import Text from './SafeText'
import { Kit, rng } from './kit/build'
import { C } from './kit/colors'
import { FONT_BOLD, FONT_SEMI } from './fonts'
import { SEA_Y } from './scopes'
import { ROAD_WIDTH, blockSize, isBlock, isLine, isZone, type MapItem, type XZ, type ZoneKind } from '../lib/mapItems'
import { COAST, OCTAGON, OCTAGON_LAND, centroid, clipToRect, rectsOverlap, type Rect } from '../lib/world'
import { cityBlocks, inCity, industryLots, isWater, landPieces, nearRoad, onLand, quayOf, rectOf, zonesOf, type Lot, type RoadLine, type Zones as ZoneSet } from '../lib/zones'
import { SITES, footprint, type Layout } from '../lib/site'
import type { ItemEvents } from './MapItems'

// The city around the sites, drawn from the editable zones: the mainland and
// the port land (with the harbour basin cut out and quay walls on every water
// edge), the entrance pier, the industrial zone's street-grid lots, cranes and
// container yards along the basin, the floating city as a pale silhouette, and
// the octagon's boundary line. Context only — kept pale ("white model") so the
// real, KPI-coloured sites stand out. Rebuilt when the zones change; the
// heavier fill waits until a drag settles.

/** White-model palette for the context (not status colours). */
const M = {
  lot: '#e6d6b2',
  wall: '#efebe3',
  wallShade: '#e1dbcf',
  roof: '#d6d0c3',
  solar: '#5f7390',
  tank: '#ebe8e1',
  gravel: '#d8c7a2',
  deck: '#b7cfdd',
  tower: '#d7e5ee',
  towerShade: '#c9dbe6',
  crane: '#c9d4de',
  paving: '#dad9d2',
  coping: '#b9b8b0',
  band: '#5f646b',
  boxes: ['#6d8fb3', '#d9d4c8', '#8a8fb0', '#9aa5ad', '#7ea1a8', '#5d7aa0'],
}

const ryOf = (ax: number, az: number, bx: number, bz: number) => Math.atan2(-(bz - az), bx - ax)

/** A flat polygon (facing up) at height y. */
function flatPoly(k: Kit, poly: XZ[], y: number, color: string) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))))
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  k.add(g, color, new THREE.Matrix4())
  g.dispose()
}

/** A polygon of land from y = -1.6 up to 0 (its sides are the quay walls). */
function landPoly(k: Kit, poly: XZ[], color: string) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 1.6, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, -1.6, 0)
  k.add(g, color, new THREE.Matrix4())
  g.dispose()
}

const ring = (r: Rect): XZ[] => [
  [r.x0, r.z0],
  [r.x1, r.z0],
  [r.x1, r.z1],
  [r.x0, r.z1],
]

/** Coping, a dark fender band and bollards on every stretch of edge that faces water; rock armour on the pier. */
function quayEdges(k: Kit, zs: ZoneSet, poly: XZ[], rocks: boolean, r: () => number) {
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i]
    const [bx, bz] = poly[(i + 1) % poly.length]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 0.5) continue
    const dx = (bx - ax) / len
    const dz = (bz - az) / len
    const ry = ryOf(ax, az, bx, bz)
    const n = Math.max(1, Math.round(len / 2))
    for (let s = 0; s < n; s++) {
      const t = ((s + 0.5) / n) * len
      const mx = ax + dx * t
      const mz = az + dz * t
      // which side is water?
      const side = [1, -1].find((sg) => isWater(zs, mx - dz * 0.9 * sg, mz + dx * 0.9 * sg) && onLand(zs, mx + dz * 0.9 * sg, mz - dx * 0.9 * sg))
      if (side === undefined) continue
      const ox = -dz * side
      const oz = dx * side
      const seg = len / n
      k.box(seg, 0.08, 0.45, M.coping, { x: mx - ox * 0.22, y: 0, z: mz - oz * 0.22, ry })
      k.box(seg, 0.22, 0.05, M.band, { x: mx + ox * 0.02, y: SEA_Y + 0.12, z: mz + oz * 0.02, ry })
      if (rocks) {
        for (let j = 0; j < 2; j++) {
          const u = t + (j - 0.5) * seg * 0.5
          k.ball(0.45 + r() * 0.25, r() > 0.5 ? C.concreteLight : C.concrete, { x: ax + dx * u + ox * (0.6 + r() * 0.3), y: SEA_Y + 0.1, z: az + dz * u + oz * (0.6 + r() * 0.3), ry: r() * 3 }, [1, 0.75, 1], 0)
        }
      } else if (s % 3 === 1) {
        k.tube(0.09, 0.16, C.black, [mx - ox * 0.3, 0.12, mz - oz * 0.3], 'y', 6)
      }
    }
  }
}

function buildLand(zs: ZoneSet) {
  const k = new Kit(false)
  const r = rng(17)
  const { mainland, port } = landPieces(zs)
  const slab = (p: Rect, color: string) => k.box(p.x1 - p.x0, 1.6, p.z1 - p.z0, color, { x: (p.x0 + p.x1) / 2, y: -1.6, z: (p.z0 + p.z1) / 2 })
  for (const p of mainland) slab(p, C.mainland)
  // the octagon's land half in lighter sand: the site
  for (const p of mainland) {
    const poly = clipToRect(OCTAGON_LAND, p)
    if (poly.length >= 3) flatPoly(k, poly, 0.012, C.sand)
  }
  // beach where the mainland meets the sea
  k.box(920, 0.08, 0.6, C.sandDark, { y: SEA_Y - 0.02, z: COAST + 0.25 })
  for (const p of port) slab(p, M.paving)
  for (const p of zs.pier) landPoly(k, p, M.paving)
  for (const p of port) quayEdges(k, zs, ring(p), false, r)
  for (const p of zs.pier) quayEdges(k, zs, p, true, r)
  return k.geometry()
}

/** The floating city: decks with canals between them and a few squares of water, low pale buildings. */
function buildCity(polys: XZ[][]) {
  const k = new Kit(true)
  for (const poly of polys) {
    for (const b of cityBlocks(poly)) {
      const w = b.x1 - b.x0
      const d = b.z1 - b.z0
      const cx = (b.x0 + b.x1) / 2
      const cz = (b.z0 + b.z1) / 2
      k.box(w, -SEA_Y + 0.3, d, M.deck, { x: cx, y: SEA_Y - 0.3, z: cz })
      const n = b.h.length
      const cols = n === 1 ? 1 : 2
      const rows = n <= 2 ? 1 : 2
      const pw = (w - 1.2) / cols
      const pd = (d - 1.2) / rows
      b.h.forEach((h, i) => {
        const x = b.x0 + 0.6 + pw * ((i % cols) + 0.5)
        const z = b.z0 + 0.6 + pd * (Math.floor(i / cols) + 0.5)
        k.box(pw - 0.5, h, pd - 0.5, i % 2 ? M.towerShade : M.tower, { x, z })
      })
    }
  }
  return k.geometry()
}

function buildLots(lots: Lot[]) {
  const k = new Kit(true)
  for (const l of lots) {
    const r = rng(l.seed)
    const w = l.x1 - l.x0
    const d = l.z1 - l.z0
    const cx = (l.x0 + l.x1) / 2
    const cz = (l.z0 + l.z1) / 2
    k.patch(l.x0, l.z0, l.x1, l.z1, 0.02, M.lot)
    switch (l.kind) {
      case 'warehouse': {
        const n = r() < 0.5 ? 1 : 2
        const sd = (d - 2) / n - 0.6
        for (let i = 0; i < n; i++) {
          const z = l.z0 + 1 + (i + 0.5) * ((d - 2) / n)
          const h = 1.3 + r() * 0.9
          k.box(w - 1.6, h, sd, M.wall, { x: cx, z }).box(w - 1.5, 0.12, sd + 0.1, M.roof, { x: cx, y: h, z })
          for (let x = l.x0 + 1.6; x < l.x1 - 1.4; x += 1.6) k.box(0.7, 0.6, 0.04, M.band, { x, z: z + sd / 2 + 0.01 })
        }
        break
      }
      case 'factory': {
        const h = 2.2 + r() * 1.4
        k.box(w * 0.55, h, d * 0.62, M.wall, { x: l.x0 + w * 0.32, z: cz }).box(w * 0.55 + 0.1, 0.12, d * 0.62 + 0.1, M.roof, { x: l.x0 + w * 0.32, y: h, z: cz })
        k.box(w * 0.3, 1.1, d * 0.34, M.wallShade, { x: l.x1 - w * 0.2, z: l.z0 + d * 0.28 })
        const sh = 5 + r() * 2.5
        k.tube(0.32, sh, M.tank, [l.x1 - w * 0.22, sh / 2, l.z1 - d * 0.24], 'y', 8, 0.24)
        if (r() > 0.4) k.tube(0.28, sh * 0.8, M.tank, [l.x1 - w * 0.36, (sh * 0.8) / 2, l.z1 - d * 0.24], 'y', 8, 0.2)
        break
      }
      case 'solar': {
        for (let z = l.z0 + 1; z < l.z1 - 1; z += 1.6) k.box(w - 1.6, 0.06, 0.95, M.solar, { x: cx, y: 0.32, z: z + 0.5, rx: -0.42 })
        k.box(0.8, 0.5, 0.6, M.wallShade, { x: l.x1 - 0.8, z: l.z1 - 0.6 })
        break
      }
      case 'tanks': {
        const n = 2 + Math.floor(r() * 3)
        for (let i = 0; i < n; i++) {
          const rad = 1.2 + r() * 0.8
          const h = 1.5 + r() * 1.6
          const x = l.x0 + w * (i % 2 ? 0.72 : 0.28)
          const z = l.z0 + d * (i < 2 ? 0.3 : 0.72)
          k.tube(rad, h, M.tank, [x, h / 2, z], 'y', 14).dome(rad, M.tank, { x, y: h, z }, 12, 0.25)
        }
        break
      }
      default: {
        k.patch(l.x0 + 0.6, l.z0 + 0.6, l.x1 - 0.6, l.z1 - 0.6, 0.03, M.gravel)
        for (let i = 0; i < 6; i++) {
          const x = l.x0 + 1.5 + r() * (w - 3)
          const z = l.z0 + 1.5 + r() * (d - 3)
          if (i % 3 === 0) {
            for (let j = 0; j < 3; j++) k.tube(0.18, 2.2, M.band, [x, 0.2 + (j === 2 ? 0.3 : 0), z + (j === 2 ? 0 : j * 0.4 - 0.2)], 'x', 8)
          } else k.box(1.4, 0.4 + r() * 0.6, 0.8, M.boxes[Math.floor(r() * M.boxes.length)], { x, z, ry: r() < 0.5 ? 0 : Math.PI / 2 })
        }
      }
    }
  }
  return k.geometry()
}

/** A ship-to-shore crane silhouette: legs on the quay, boom over the water. */
function crane(k: Kit, x: number, qz: number) {
  const legs: [number, number][] = [
    [x - 1.6, qz - 3],
    [x + 1.6, qz - 3],
    [x - 1.6, qz - 0.6],
    [x + 1.6, qz - 0.6],
  ]
  for (const [lx, lz] of legs) k.box(0.28, 4.6, 0.28, M.crane, { x: lx, z: lz })
  for (const z of [qz - 3, qz - 0.6]) k.box(3.5, 0.3, 0.3, M.crane, { x, y: 4.4, z })
  for (const lx of [x - 1.6, x + 1.6]) k.box(0.3, 0.3, 2.7, M.crane, { x: lx, y: 1.4, z: qz - 1.8 })
  k.box(0.7, 0.45, 15, M.crane, { x, y: 4.8, z: qz + 1 })
  k.box(1.8, 1.0, 2.0, C.white, { x, y: 5.25, z: qz - 4.4 })
  k.beam([x, 4.8, qz - 2.5], [x, 7.2, qz - 1.2], 0.18, 0.18, M.crane).beam([x, 7.2, qz - 1.2], [x, 5.2, qz + 7.5], 0.08, 0.08, C.steelDark)
}

/** Cranes along the basin's north quay and container yards on the port land, kept clear of sites, roads and the water's edge. */
function buildPort(zs: ZoneSet, blockers: Rect[], roads: RoadLine[]) {
  const k = new Kit(true)
  const q = quayOf(zs)
  if (q) {
    for (let x = q.x0 + 6; x <= q.x1 - 6; x += 12) {
      const span = { x0: x - 4, z0: q.z - 6, x1: x + 4, z1: q.z + 6 }
      if (!blockers.some((b) => rectsOverlap(b, span)) && onLand(zs, x, q.z - 1)) crane(k, x, q.z)
    }
  }
  const r = rng(29)
  for (const p of landPieces(zs).port) {
    for (let x = p.x0 + 1.5; x + 5.6 <= p.x1 - 1.5; x += 7) {
      for (let z = p.z0 + 1.2; z + 3 <= p.z1 - 1.2; z += 4.5) {
        const cell = { x0: x, z0: z, x1: x + 5.6, z1: z + 3 }
        const corners: XZ[] = [
          [cell.x0 - 2.5, cell.z0 - 2.5],
          [cell.x1 + 2.5, cell.z0 - 2.5],
          [cell.x1 + 2.5, cell.z1 + 2.5],
          [cell.x0 - 2.5, cell.z1 + 2.5],
        ]
        if (corners.some(([cx, cz]) => !onLand(zs, cx, cz))) continue
        const grown = { x0: cell.x0 - 1, z0: cell.z0 - 1, x1: cell.x1 + 1, z1: cell.z1 + 1 }
        if (blockers.some((b) => rectsOverlap(b, grown)) || nearRoad(cell, roads)) continue
        // a block of containers: 2 rows × 2, stacked 1–3 high
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 4; j++) {
            const h = 1 + Math.floor(r() * 3)
            for (let s = 0; s < h; s++) k.box(2.6, 0.55, 0.62, M.boxes[Math.floor(r() * M.boxes.length)], { x: x + 1.4 + i * 2.8, y: s * 0.55, z: z + 0.4 + j * 0.72 })
          }
        }
      }
    }
  }
  return k.geometry()
}

/** The octagon's boundary: a bright dashed line on land and water (dashes) with marker posts and buoys (marks). */
function buildOutline(zs: ZoneSet) {
  const dashes = new Kit(false)
  const marks = new Kit(true)
  let carry = 0
  for (let i = 0; i < OCTAGON.length; i++) {
    const [ax, az] = OCTAGON[i]
    const [bx, bz] = OCTAGON[(i + 1) % OCTAGON.length]
    const len = Math.hypot(bx - ax, bz - az)
    const dx = (bx - ax) / len
    const dz = (bz - az) / len
    const ry = ryOf(ax, az, bx, bz)
    for (let t = carry; t < len; t += 4) {
      const x = ax + dx * (t + 1.2)
      const z = az + dz * (t + 1.2)
      const solid = onLand(zs, x, z) || inCity(zs, x, z)
      dashes.box(2.4, 0.04, 0.6, '#ffffff', { x, y: solid ? 0.06 : SEA_Y + 0.05, z, ry })
      if (Math.round(t / 4) % 4 === 0) {
        if (solid) marks.box(0.25, 1.3, 0.25, C.white, { x, z }).box(0.3, 0.25, 0.3, C.blue, { x, y: 1.3, z })
        else marks.tube(0.42, 0.8, C.white, [x, SEA_Y + 0.3, z], 'y', 10).tube(0.3, 0.35, C.blue, [x, SEA_Y + 0.85, z], 'y', 8)
      }
    }
    carry = (4 - ((len - carry) % 4)) % 4
  }
  return { dashes: dashes.geometry(), marks: marks.geometry() }
}

// ---------------------------------------------------------------------------
// Labels and the zone editor
// ---------------------------------------------------------------------------

const LABEL: Record<ZoneKind, [string, string?]> = {
  industry: ['Industrial zone'],
  port: ['Port'],
  basin: ['Harbour basin'],
  pier: ['Entrance pier'],
  city: ['Floating city', 'Not built yet'],
}

/** Where a zone's name and move handle go. The port's sits at its west end, clear of the basin. */
export function zoneAnchor(item: MapItem): XZ {
  const pts = item.points ?? []
  if (item.kind === 'port') {
    const r = rectOf(pts)
    return [r.x0 + Math.min(14, (r.x1 - r.x0) / 4), (r.z0 + r.z1) / 2]
  }
  if (item.kind === 'basin') {
    const r = rectOf(pts)
    return [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]
  }
  return centroid(pts)
}

/** Keep a billboard about `px` pixels tall whatever the zoom. */
function screenScale(camera: THREE.Camera, height: number, p: THREE.Vector3, px: number) {
  const d = camera.position.distanceTo(p)
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 40
  return { d, s: (px * 2 * d * Math.tan((fov * Math.PI) / 360)) / Math.max(1, height) }
}

function ZoneLabels({ zones, always }: { zones: MapItem[]; always: boolean }) {
  const { camera, size } = useThree()
  const refs = useRef<(THREE.Object3D | null)[]>([])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    refs.current.forEach((g) => {
      if (!g) return
      const { d, s } = screenScale(camera, size.height, g.getWorldPosition(tmp), 18)
      // in view mode the names show only from far away (the site names take over up close)
      g.visible = always || d > 150
      g.scale.setScalar(s)
    })
  })
  return (
    <group>
      {zones.map((z, i) => {
        const [x, zz] = zoneAnchor(z)
        const [title, sub] = LABEL[z.kind as ZoneKind]
        return (
          <Billboard key={z.uuid} ref={(g) => (refs.current[i] = g)} position={[x, always ? 2.2 : 3, zz]}>
            <Text font={FONT_BOLD} fontSize={1} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.07} outlineColor="#0f3552" renderOrder={12}>
              {title}
              <meshBasicMaterial depthTest={false} depthWrite={false} toneMapped={false} transparent />
            </Text>
            {sub && (
              <Text font={FONT_SEMI} fontSize={0.6} color="#e8fbff" anchorX="center" anchorY="top" outlineWidth={0.06} outlineColor="#0f3552" position={[0, -0.1, 0]} renderOrder={12}>
                {sub}
                <meshBasicMaterial depthTest={false} depthWrite={false} toneMapped={false} transparent />
              </Text>
            )}
          </Billboard>
        )
      })}
    </group>
  )
}

const SEL = '#7cf29a'

/** Zones tool: every zone's outline and a move handle; the picked zone shows its corners. */
function ZoneEditor({ zones, selected, ev }: { zones: MapItem[]; selected: { uuid: string; point: number } | null; ev: ItemEvents }) {
  const { camera, size } = useThree()
  const lines = useMemo(() => {
    const pts: number[] = []
    for (const z of zones) {
      const p = z.points ?? []
      for (let i = 0; i < p.length; i++) {
        const a = p[i]
        const b = p[(i + 1) % p.length]
        pts.push(a[0], 0.25, a[1], b[0], 0.25, b[1])
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [zones])
  useEffect(() => () => lines.dispose(), [lines])
  const sel = selected ? zones.find((z) => z.uuid === selected.uuid) : undefined
  const fill = useMemo(() => {
    if (!sel?.points || sel.points.length < 3) return null
    const g = new THREE.ShapeGeometry(new THREE.Shape(sel.points.map(([x, z]) => new THREE.Vector2(x, -z))))
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0.22, 0)
    return g
  }, [sel])
  useEffect(() => () => fill?.dispose(), [fill])

  const handles = useRef<(THREE.Object3D | null)[]>([])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    for (const h of handles.current) {
      if (!h) continue
      h.scale.setScalar(Math.max(0.5, screenScale(camera, size.height, h.getWorldPosition(tmp), 14).s))
    }
  })
  const grab = (uuid: string, point: number) => (e: ThreeEvent<PointerEvent>) => {
    if (!ev.canGrab) return
    e.stopPropagation()
    ev.onGrab(uuid, point, e)
  }
  const on = {
    onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
    onPointerMove: (e: ThreeEvent<PointerEvent>) => ev.canGrab && ev.onMove(e),
    onPointerUp: (e: ThreeEvent<PointerEvent>) => ev.canGrab && ev.onDrop(e),
    onPointerCancel: (e: ThreeEvent<PointerEvent>) => ev.canGrab && ev.onDrop(e),
  }
  let n = 0
  return (
    <group>
      <lineSegments geometry={lines} renderOrder={6} raycast={() => null}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest={false} depthWrite={false} />
      </lineSegments>
      {fill && (
        <mesh geometry={fill} renderOrder={5} raycast={() => null}>
          <meshBasicMaterial color={SEL} transparent opacity={0.16} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {zones.map((z) => {
        const [x, zz] = zoneAnchor(z)
        const on2 = selected?.uuid === z.uuid && selected.point < 0
        const i = n++
        return (
          <mesh key={z.uuid} ref={(m) => (handles.current[i] = m)} position={[x, 0.6, zz]} renderOrder={9} userData={{ mapItem: true }} onPointerDown={grab(z.uuid, -1)} {...on}>
            <cylinderGeometry args={[1, 1, 0.3, 24]} />
            <meshBasicMaterial color={on2 ? SEL : '#ffffff'} depthTest={false} toneMapped={false} />
          </mesh>
        )
      })}
      {sel?.points?.map(([x, z], p) => {
        const i = n++
        return (
          <mesh key={`c${p}`} ref={(m) => (handles.current[i] = m)} position={[x, 0.6, z]} renderOrder={10} userData={{ mapItem: true }} onPointerDown={grab(sel.uuid, p)} {...on}>
            <sphereGeometry args={[0.75, 14, 10]} />
            <meshBasicMaterial color={selected?.point === p ? SEL : '#ffffff'} depthTest={false} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

/** A value that follows `key` only after it has stopped changing for `ms` (heavy rebuilds wait for a drag to settle). */
function useSettled<T>(value: T, key: string, ms: number): T {
  const [v, setV] = useState({ key, value })
  useEffect(() => {
    if (key === v.key) return
    const id = window.setTimeout(() => setV({ key, value }), ms)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms])
  return v.value
}

function useGeometry<T extends THREE.BufferGeometry>(make: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(make, deps)
  useEffect(() => () => g.dispose(), [g])
  return g
}

export default function Zones({
  items,
  layout,
  solid,
  glow,
  shadows,
  editing,
  zoneTool,
  selected,
  ev,
}: {
  items: MapItem[]
  /** Sites where they're drawn (coast sites on the quay). */
  layout: Layout
  solid: THREE.Material
  glow: THREE.Material
  shadows: boolean
  editing: boolean
  zoneTool: boolean
  selected: { uuid: string; point: number } | null
  ev: ItemEvents
}) {
  const zoneItems = useMemo(() => items.filter((i) => isZone(i.kind)), [items])
  const zoneKey = JSON.stringify(zoneItems)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const zs = useMemo(() => zonesOf(zoneItems), [zoneKey])
  const land = useGeometry(() => buildLand(zs), [zs])
  const outline = useMemo(() => buildOutline(zs), [zs])
  useEffect(
    () => () => {
      outline.dashes.dispose()
      outline.marks.dispose()
    },
    [outline],
  )
  const wait = editing ? 300 : 0
  const city = useSettled(zs.city, JSON.stringify(zs.city), wait)
  const cityGeo = useGeometry(() => buildCity(city), [city])

  // what the industrial lots and the port yards must keep clear of
  const fill = useMemo(() => {
    const blockers: Rect[] = SITES.filter((s) => layout[s.id]).map((s) => footprint(s, layout[s.id]))
    const roads: RoadLine[] = []
    for (const i of items) {
      if (isBlock(i.kind)) {
        const [w, d] = blockSize(i)
        blockers.push({ x0: (i.x ?? 0) - w / 2, z0: (i.z ?? 0) - d / 2, x1: (i.x ?? 0) + w / 2, z1: (i.z ?? 0) + d / 2 })
      } else if (isLine(i.kind) && i.points) roads.push({ points: i.points, width: ROAD_WIDTH[i.kind] })
    }
    return { zs, blockers, roads }
  }, [zs, items, layout])
  const settled = useSettled(fill, JSON.stringify([zoneKey, fill.blockers, fill.roads]), wait)
  const lots = useGeometry(() => buildLots(industryLots(settled.zs, settled.blockers, settled.roads)), [settled])
  const port = useGeometry(() => buildPort(settled.zs, settled.blockers, settled.roads), [settled])

  return (
    <group>
      <mesh geometry={land} material={solid} receiveShadow={shadows} raycast={() => null} />
      <mesh geometry={cityGeo} material={solid} castShadow={shadows} receiveShadow={shadows} raycast={() => null} />
      <mesh geometry={lots} material={solid} castShadow={shadows} receiveShadow={shadows} raycast={() => null} />
      <mesh geometry={port} material={solid} castShadow={shadows} receiveShadow={shadows} raycast={() => null} />
      <mesh geometry={outline.dashes} material={glow} renderOrder={1} raycast={() => null} />
      <mesh geometry={outline.marks} material={solid} castShadow={shadows} raycast={() => null} />
      <ZoneLabels zones={zoneItems} always={zoneTool} />
      {zoneTool && <ZoneEditor zones={zoneItems} selected={selected} ev={ev} />}
    </group>
  )
}
