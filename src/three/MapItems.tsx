import { useEffect, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Kit } from './kit/build'
import { C } from './kit/colors'
import { BLOCK_SIZE, ROAD_WIDTH, roadRibbon, type MapItem, type XZ } from '../lib/mapItems'

// What the Admin draws on the map: roads and highways (one merged mesh, with
// lane markings and lamp posts), palm trees (instanced), workers' camps and
// villages (instanced blocks). Rebuilt only when the items change.

export interface ItemEvents {
  /** Move tool: grab an item (point = -1 for the whole item). */
  canGrab: boolean
  onGrab: (uuid: string, point: number, e: ThreeEvent<PointerEvent>) => void
  onMove: (e: ThreeEvent<PointerEvent>) => void
  onDrop: (e: ThreeEvent<PointerEvent>) => void
}

const Y = { shoulder: 0.03, road: 0.04, mark: 0.05 }
const ASPHALT = { road: '#5a5e65', highway: '#3e4147' }

const tmpC = new THREE.Color()

/** Flat triangles (x, z pairs) → positions / normals / colours at height y, always facing up. */
function pushFlat(out: { p: number[]; n: number[]; c: number[] }, tris: number[], y: number, color: string) {
  tmpC.set(color)
  for (let i = 0; i < tris.length; i += 6) {
    let [ax, az, bx, bz, cx, cz] = tris.slice(i, i + 6)
    // keep the face up (+y): (b-a) × (c-a) must point up
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) [bx, bz, cx, cz] = [cx, cz, bx, bz]
    out.p.push(ax, y, az, bx, y, bz, cx, y, cz)
    for (let k = 0; k < 3; k++) {
      out.n.push(0, 1, 0)
      out.c.push(tmpC.r, tmpC.g, tmpC.b)
    }
  }
}

function geometryOf(o: { p: number[]; n: number[]; c: number[] }) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3))
  g.computeBoundingSphere()
  return g
}

/** Points every `gap` along a line, with the direction there. */
function along(points: XZ[], gap: number, offset = 0): { x: number; z: number; dx: number; dz: number }[] {
  const out: { x: number; z: number; dx: number; dz: number }[] = []
  let carry = offset
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 1e-6) continue
    const dx = (bx - ax) / len
    const dz = (bz - az) / len
    let t = carry
    while (t < len) {
      out.push({ x: ax + dx * t, z: az + dz * t, dx, dz })
      t += gap
    }
    carry = t - len
  }
  return out
}

function buildRoads(items: MapItem[]) {
  const surface = { p: [] as number[], n: [] as number[], c: [] as number[] }
  const ranges: { start: number; end: number; uuid: string }[] = []
  const deco = { p: [] as number[], n: [] as number[], c: [] as number[] }
  const props = new Kit()
  const glow = new Kit(false)
  for (const it of items) {
    if (it.kind !== 'road' && it.kind !== 'highway') continue
    const pts = it.points ?? []
    const w = ROAD_WIDTH[it.kind]
    pushFlat(deco, roadRibbon(pts, w + (it.kind === 'highway' ? 1.0 : 0.35), 8), Y.shoulder, it.kind === 'highway' ? C.concreteDark : C.concrete)
    const start = surface.p.length / 9
    pushFlat(surface, roadRibbon(pts, w, 12), Y.road, ASPHALT[it.kind])
    ranges.push({ start, end: surface.p.length / 9, uuid: it.uuid })
    if (it.kind === 'highway') {
      // edge lines, dashed centre line, lamp posts down the side
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i]
        const [bx, bz] = pts[i + 1]
        const len = Math.hypot(bx - ax, bz - az)
        if (len < 1e-6) continue
        const nx = -(bz - az) / len
        const nz = (bx - ax) / len
        for (const side of [-1, 1]) {
          const o = side * (w / 2 - 0.22)
          pushFlat(deco, roadRibbon([[ax + nx * o, az + nz * o], [bx + nx * o, bz + nz * o]], 0.1, 0), Y.mark, C.marking)
        }
      }
      for (const s of along(pts, 2.2, 0.6)) pushFlat(deco, roadRibbon([[s.x, s.z], [s.x + s.dx * 1.1, s.z + s.dz * 1.1]], 0.12, 0), Y.mark, C.marking)
      for (const s of along(pts, 10, 3)) {
        const ox = -s.dz * (w / 2 + 0.5)
        const oz = s.dx * (w / 2 + 0.5)
        const x = s.x + ox
        const z = s.z + oz
        props.box(0.1, 2.6, 0.1, C.steel, { x, z }).beam([x, 2.55, z], [x - ox * 0.45, 2.6, z - oz * 0.45], 0.06, 0.06, C.steel)
        glow.box(0.32, 0.06, 0.18, C.lamp, { x: x - ox * 0.45, y: 2.52, z: z - oz * 0.45 })
      }
    }
  }
  return { surface: geometryOf(surface), deco: geometryOf(deco), props: props.geometry(), glow: glow.geometry(), ranges }
}

let palm: THREE.BufferGeometry | null = null
function palmGeometry() {
  if (palm) return palm
  const k = new Kit()
  const segs = 5
  for (let i = 0; i < segs; i++) {
    const y = i * 0.5
    const lean = i * i * 0.025
    k.cyl(0.12 - i * 0.012, 0.14 - i * 0.012, 0.52, i % 2 ? '#9b6c45' : '#8a5d3a', { x: lean, y }, 7)
  }
  const top: [number, number, number] = [segs * segs * 0.025, segs * 0.5, 0]
  // fronds: flat leaves around the top, drooping outwards
  const L = 1.35
  for (let f = 0; f < 8; f++) {
    const a = (f / 8) * Math.PI * 2 + 0.2
    const d = 0.38 + (f % 2) * 0.16
    const cx = top[0] + (L / 2) * Math.cos(d) * Math.cos(a)
    const cy = top[1] - (L / 2) * Math.sin(d)
    const cz = top[2] - (L / 2) * Math.cos(d) * Math.sin(a)
    k.box(L, 0.04, 0.36, f % 2 ? '#5d8c3c' : '#4d7a33', { x: cx, y: cy, z: cz, ry: a, rz: -d })
  }
  k.ball(0.13, '#7a5a2e', { x: top[0] + 0.1, y: top[1] - 0.1, z: 0.08 }, [1, 1, 1], 0)
  k.ball(0.12, '#7a5a2e', { x: top[0] - 0.08, y: top[1] - 0.12, z: -0.08 }, [1, 1, 1], 0)
  palm = k.geometry()
  return palm
}

const blockCache = new Map<string, { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry }>()
function blockGeometry(kind: 'camp' | 'village') {
  const hit = blockCache.get(kind)
  if (hit) return hit
  const k = new Kit()
  const g = new Kit(false)
  const [W, D] = BLOCK_SIZE[kind]
  const fence = (w: number, d: number, color: string) => {
    for (const [x0, z0, x1, z1] of [
      [-w / 2, -d / 2, w / 2, -d / 2],
      [-w / 2, d / 2, w / 2, d / 2],
      [-w / 2, -d / 2, -w / 2, d / 2],
      [w / 2, -d / 2, w / 2, d / 2],
    ]) {
      k.beam([x0, 0.2, z0], [x1, 0.2, z1], 0.06, 0.4, color)
    }
  }
  if (kind === 'camp') {
    k.patch(-W / 2, -D / 2, W / 2, D / 2, 0.02, '#cdb894')
    fence(W - 0.2, D - 0.2, C.steelLight)
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) {
        const x = -W / 2 + 1.6 + i * 2.35
        const z = -D / 2 + 1.3 + row * 2.0
        k.box(2.0, 0.85, 1.1, C.white, { x, z }).box(2.1, 0.1, 1.2, C.blue, { x, y: 0.85, z })
        for (const dx of [-0.5, 0.5]) {
          k.box(0.42, 0.26, 0.02, C.glassDark, { x: x + dx, y: 0.36, z: z + 0.56 })
          g.box(0.38, 0.22, 0.02, C.windowGlow, { x: x + dx, y: 0.38, z: z + 0.575 })
        }
      }
    }
    k.box(2.2, 1.0, 1.6, C.cream, { x: W / 2 - 1.5, z: D / 2 - 1.3 }).box(2.3, 0.1, 1.7, C.navy, { x: W / 2 - 1.5, y: 1.0, z: D / 2 - 1.3 })
    k.tube(0.55, 1.6, C.steelLight, [W / 2 - 1.2, 0.8, -D / 2 + 1.2], 'y', 10)
    k.box(0.05, 1.8, 0.05, C.steelLight, { x: -W / 2 + 0.6, z: D / 2 - 0.6 }).box(0.5, 0.3, 0.02, C.orange, { x: -W / 2 + 0.85, y: 1.45, z: D / 2 - 0.6 })
  } else {
    k.patch(-W / 2, -D / 2, W / 2, D / 2, 0.02, '#e6d3ab')
    fence(W - 0.1, D - 0.1, '#e9dcc0')
    const houses: [number, number, number, number, number, string][] = [
      [-2.8, -2.6, 2.4, 2.0, 1.1, C.cream],
      [0.3, -2.8, 2.0, 1.8, 1.4, C.white],
      [3.0, -2.4, 1.8, 2.2, 1.0, '#f1dcb6'],
      [-2.9, 0.6, 2.0, 2.4, 1.3, C.white],
      [0.4, 0.4, 2.6, 2.0, 1.0, '#f1dcb6'],
      [3.1, 1.0, 1.8, 1.8, 1.5, C.cream],
      [-1.4, 3.1, 2.4, 1.6, 0.9, C.white],
      [2.0, 3.3, 2.2, 1.4, 1.1, C.cream],
    ]
    for (const [x, z, w, d, h, col] of houses) {
      k.box(w, h, d, col, { x, z }).box(w + 0.06, 0.12, d + 0.06, '#d8c39a', { x, y: h, z })
      k.box(0.3, 0.5, 0.02, '#7a5a3a', { x: x - w / 4, z: z + d / 2 + 0.005 })
      k.box(0.36, 0.26, 0.02, C.glassDark, { x: x + w / 5, y: h * 0.45, z: z + d / 2 + 0.005 })
      g.box(0.32, 0.22, 0.02, C.windowGlow, { x: x + w / 5, y: h * 0.45 + 0.02, z: z + d / 2 + 0.02 })
    }
    k.dome(0.6, C.white, { x: 0.3, y: 1.4, z: -2.8 }, 10, 0.9)
  }
  const out = { solid: k.geometry(), glow: g.geometry() }
  blockCache.set(kind, out)
  return out
}

const Yaxis = new THREE.Vector3(0, 1, 0)

export default function MapItems({
  items,
  drawing,
  drawingKind,
  selected,
  solid,
  glow,
  night,
  shadows,
  ev,
}: {
  items: MapItem[]
  /** A road being drawn (preview). */
  drawing: XZ[] | null
  drawingKind: 'road' | 'highway'
  selected: { uuid: string; point: number } | null
  solid: THREE.Material
  glow: THREE.Material
  night: boolean
  shadows: boolean
  ev: ItemEvents
}) {
  const roads = useMemo(() => buildRoads(items), [items])
  useEffect(
    () => () => {
      roads.surface.dispose()
      roads.deco.dispose()
      roads.props.dispose()
      roads.glow.dispose()
    },
    [roads],
  )
  const roadMat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  const decoMat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [])
  useEffect(
    () => () => {
      roadMat.dispose()
      decoMat.dispose()
    },
    [roadMat, decoMat],
  )

  // palms: one instance per tree point
  const trees = useMemo(() => {
    const list: { uuid: string; point: number; x: number; z: number }[] = []
    for (const it of items) if (it.kind === 'trees') (it.points ?? []).forEach(([x, z], point) => list.push({ uuid: it.uuid, point, x, z }))
    return list
  }, [items])
  const treeMesh = useMemo(() => {
    const cap = Math.max(64, Math.ceil(trees.length / 128) * 128)
    const m = new THREE.InstancedMesh(palmGeometry(), solid, cap)
    m.userData.mapItem = true
    m.frustumCulled = false
    m.castShadow = shadows
    return m
    // capacity only grows in steps, so planting doesn't rebuild the mesh every tap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.max(64, Math.ceil(trees.length / 128) * 128), solid, shadows])
  useEffect(
    () => () => {
      treeMesh.dispose()
    },
    [treeMesh],
  )
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    trees.forEach((t, i) => {
      const h = Math.abs(Math.sin(t.x * 12.9898 + t.z * 78.233) * 43758.5453) % 1
      q.setFromAxisAngle(Yaxis, h * Math.PI * 2)
      const k = 0.85 + h * 0.35
      treeMesh.setMatrixAt(i, m.compose(p.set(t.x, 0.02, t.z), q, s.set(k, k, k)))
    })
    treeMesh.count = trees.length
    treeMesh.instanceMatrix.needsUpdate = true
    treeMesh.computeBoundingSphere()
  }, [trees, treeMesh])

  // camps and villages
  const blocks = useMemo(() => {
    const by = { camp: [] as MapItem[], village: [] as MapItem[] }
    for (const it of items) if (it.kind === 'camp' || it.kind === 'village') by[it.kind].push(it)
    return (['camp', 'village'] as const).map((kind) => {
      const geo = blockGeometry(kind)
      const list = by[kind]
      const solidMesh = new THREE.InstancedMesh(geo.solid, solid, Math.max(1, list.length))
      const glowMesh = new THREE.InstancedMesh(geo.glow, glow, Math.max(1, list.length))
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      list.forEach((it, i) => {
        m.compose(new THREE.Vector3(it.x ?? 0, 0.02, it.z ?? 0), q.setFromAxisAngle(Yaxis, (-(it.rot ?? 0) * Math.PI) / 2), new THREE.Vector3(1, 1, 1))
        solidMesh.setMatrixAt(i, m)
        glowMesh.setMatrixAt(i, m)
      })
      solidMesh.count = list.length
      glowMesh.count = list.length
      solidMesh.userData.mapItem = true
      for (const x of [solidMesh, glowMesh]) {
        x.frustumCulled = false
        x.instanceMatrix.needsUpdate = true
      }
      solidMesh.castShadow = shadows
      solidMesh.receiveShadow = shadows
      return { kind, list, solidMesh, glowMesh }
    })
  }, [items, solid, glow, shadows])
  useEffect(
    () => () => {
      for (const b of blocks) {
        b.solidMesh.dispose()
        b.glowMesh.dispose()
      }
    },
    [blocks],
  )

  // preview of the road being drawn
  const preview = useMemo(() => {
    if (!drawing || drawing.length === 0) return null
    const o = { p: [] as number[], n: [] as number[], c: [] as number[] }
    if (drawing.length > 1) pushFlat(o, roadRibbon(drawing, ROAD_WIDTH[drawingKind], 10), Y.mark + 0.02, '#ffffff')
    return o.p.length ? geometryOf(o) : null
  }, [drawing, drawingKind])
  useEffect(() => () => preview?.dispose(), [preview])

  const grab = (uuid: string, point: number) => (e: ThreeEvent<PointerEvent>) => {
    if (!ev.canGrab) return
    e.stopPropagation()
    ev.onGrab(uuid, point, e)
  }
  const handlers = {
    // a tap on an item in the Move tool selects it; it mustn't also count as a tap on the ground
    onClick: (e: ThreeEvent<MouseEvent>) => ev.canGrab && e.stopPropagation(),
    onPointerMove: (e: ThreeEvent<PointerEvent>) => ev.canGrab && ev.onMove(e),
    onPointerUp: (e: ThreeEvent<PointerEvent>) => ev.canGrab && ev.onDrop(e),
    onPointerCancel: (e: ThreeEvent<PointerEvent>) => ev.canGrab && ev.onDrop(e),
  }
  const sel = selected ? items.find((i) => i.uuid === selected.uuid) : undefined
  const selLine = sel && (sel.kind === 'road' || sel.kind === 'highway') ? sel : undefined

  return (
    <group>
      <mesh geometry={roads.deco} material={decoMat} receiveShadow={shadows} raycast={() => null} />
      <mesh
        geometry={roads.surface}
        material={roadMat}
        userData={{ mapItem: true }}
        receiveShadow={shadows}
        onPointerDown={(e) => {
          if (!ev.canGrab || e.faceIndex == null) return
          const r = roads.ranges.find((x) => e.faceIndex! >= x.start && e.faceIndex! < x.end)
          if (r) grab(r.uuid, -1)(e)
        }}
        {...handlers}
      />
      <mesh geometry={roads.props} material={solid} castShadow={shadows} raycast={() => null} />
      <mesh geometry={roads.glow} material={glow} visible={night} raycast={() => null} />
      <primitive
        object={treeMesh}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (e.instanceId === undefined) return
          const t = trees[e.instanceId]
          if (t) grab(t.uuid, t.point)(e)
        }}
        {...handlers}
      />
      {blocks.map((b) => (
        <group key={b.kind}>
          <primitive
            object={b.solidMesh}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              if (e.instanceId === undefined) return
              const it = b.list[e.instanceId]
              if (it) grab(it.uuid, -1)(e)
            }}
            {...handlers}
          />
          <primitive object={b.glowMesh} visible={night} />
        </group>
      ))}
      {preview && (
        <mesh geometry={preview} renderOrder={8}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {drawing?.map(([x, z], i) => (
        <mesh key={`d${i}`} position={[x, 0.25, z]} renderOrder={9} raycast={() => null}>
          <sphereGeometry args={[0.32, 12, 8]} />
          <meshBasicMaterial color={i === drawing.length - 1 ? '#ffffff' : '#dff6ff'} toneMapped={false} />
        </mesh>
      ))}
      {selLine?.points?.map(([x, z], i) => (
        <mesh key={`h${i}`} position={[x, 0.3, z]} renderOrder={9} userData={{ mapItem: true }} onPointerDown={grab(selLine.uuid, i)} {...handlers}>
          <sphereGeometry args={[selected?.point === i ? 0.62 : 0.5, 14, 10]} />
          <meshBasicMaterial color={selected?.point === i ? '#7cf29a' : '#ffffff'} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
