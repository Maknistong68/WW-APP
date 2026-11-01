import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import Text from './SafeText'
import { Kit, rng } from './kit/build'
import { C } from './kit/colors'
import { FONT_BOLD, FONT_SEMI } from './fonts'
import { FLOATING_CITY, GRID, OCT, OCTAGON_LAND, SHORE, WORLD } from '../lib/site'
import { roadRibbon } from '../lib/mapItems'
import { SEA_Y } from './scopes'
import type { Palette } from './theme3d'

// The world: flat desert land behind the coast (the octagon's land half is
// tiled, the mainland around it darker), the sea in front, the octagon line
// (site hoarding on land, breakwater at sea) and the floating-city half
// highlighted but left empty. Built once; day / night only changes colours.

function tileTexture(base: string, line: string, strong: boolean) {
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  if (!strong) {
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
  }
  g.strokeStyle = line
  g.lineWidth = strong ? 3 : 2
  g.strokeRect(0, 0, s, s)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function waveTexture() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = '#d9e6f0'
  g.fillRect(0, 0, s, s)
  g.fillStyle = '#ffffff'
  const r = rng(11)
  for (let i = 0; i < 14; i++) {
    const x = r() * s
    const y = r() * s
    const rx = 9 + r() * 8
    const ry = 1.6 + r() * 1.4
    // wrapped copies so the texture tiles seamlessly
    for (const dx of [-s, 0, s]) {
      g.beginPath()
      g.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.repeat.set(40, 40)
  return t
}

/** A flat polygon in the x / z plane at height y (UVs = world units, one texture repeat per tile). */
function flat(poly: [number, number][], y: number) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))))
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

function scenery() {
  const k = new Kit(false)
  const r = rng(5)
  // the land behind the coast, level with the site; its edge drops to the sea
  k.box(520, 1.6, 300, C.mainland, { y: -1.6, z: SHORE - 150 })
  k.box(520, 0.08, 0.5, C.sandDark, { y: SEA_Y - 0.02, z: SHORE + 0.2 })
  // site hoarding along the octagon's land edges (not along the shore)
  for (let i = 0; i < OCTAGON_LAND.length; i++) {
    const [ax, az] = OCTAGON_LAND[i]
    const [bx, bz] = OCTAGON_LAND[(i + 1) % OCTAGON_LAND.length]
    if (az === SHORE && bz === SHORE) continue
    const inset = (v: number) => v - Math.sign(v) * 0.25
    const x0 = inset(ax)
    const z0 = az === SHORE ? az - 0.3 : inset(az)
    const x1 = inset(bx)
    const z1 = bz === SHORE ? bz - 0.3 : inset(bz)
    const len = Math.hypot(x1 - x0, z1 - z0)
    const ry = Math.atan2(-(z1 - z0), x1 - x0)
    const at = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, ry }
    k.box(len, 0.55, 0.08, C.white, { ...at, y: 0 })
    k.box(len, 0.1, 0.09, C.blue, { ...at, y: 0.45 })
    const n = Math.round(len / 2.5)
    for (let j = 0; j <= n; j++) k.box(0.1, 0.6, 0.12, C.steelDark, { x: x0 + ((x1 - x0) * j) / n, y: 0, z: z0 + ((z1 - z0) * j) / n, ry })
  }
  // breakwater along the octagon's sea edges, with the harbour mouth in front
  const sea: [number, number][] = [
    [GRID, SHORE],
    [GRID, OCT - GRID],
    [OCT - GRID, GRID],
    [4, GRID],
  ]
  const seaL: [number, number][] = sea.map(([x, z]) => [-x, z] as [number, number]).reverse()
  for (const line of [sea, seaL]) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, z0] = line[i]
      const [x1, z1] = line[i + 1]
      k.beam([x0, SEA_Y - 0.5, z0], [x1, SEA_Y - 0.5, z1], 1.1, 1.1, C.concreteDark)
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.round(len / 0.75)
      for (let j = 0; j <= n; j++) {
        const t = j / n
        k.ball(0.42 + r() * 0.2, r() > 0.5 ? C.concreteLight : C.concrete, { x: x0 + (x1 - x0) * t + (r() - 0.5) * 0.3, y: SEA_Y + 0.15, z: z0 + (z1 - z0) * t + (r() - 0.5) * 0.3, ry: r() * 3 }, [1, 0.75, 1], 0)
      }
    }
  }
  for (const x of [-4, 4]) k.tube(0.35, 1.6, C.white, [x, SEA_Y + 0.8, GRID], 'y', 8).tube(0.37, 0.3, C.navy, [x, SEA_Y + 1.4, GRID], 'y', 8)
  // dunes and desert shrubs, out of the way of the buildable area's middle
  for (let i = 0; i < 90; i++) {
    const x = (r() - 0.5) * 300
    const z = SHORE - 4 - r() * 150
    const near = Math.abs(x) < WORLD && z > -WORLD
    if (near && r() > 0.25) continue
    if (Math.abs(x) + Math.abs(z) < OCT + 6 && Math.abs(x) < GRID + 6 && z > -GRID - 6) continue
    if (i % 3 === 0) k.dome(2.5 + r() * 4, C.sandDark, { x, y: 0, z }, 7, 0.22)
    else k.ball(0.35 + r() * 0.35, '#8f8152', { x, y: 0.1, z }, [1, 0.7, 1], 0)
  }
  // mountains far behind
  for (let i = 0; i < 22; i++) {
    const x = -160 + i * 15 + r() * 8
    const z = -WORLD - 22 - r() * 40
    const h = 12 + r() * 20
    k.cone(9 + r() * 8, h, i % 2 ? C.mountain : C.mountainDark, { x, y: 0, z, ry: r() * 3 }, 6)
    k.cone(4 + r() * 3, h * 0.35, C.rockLight, { x: x + 3, y: 0, z: z + 5 }, 5)
  }
  return k.geometry()
}

/** The floating-city half: a soft tint, a dashed outline and its name. Nothing is built there yet. */
function FloatingCity({ palette, motion }: { palette: Palette; motion: boolean }) {
  const res = useMemo(() => {
    const fill = flat(FLOATING_CITY, SEA_Y + 0.04)
    // a bold dashed border on the water (thick dashes, readable from far away)
    const tris: number[] = []
    const ring = [...FLOATING_CITY, FLOATING_CITY[0]]
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      for (let t = 0; t < len; t += 2.4) {
        const t1 = Math.min(len, t + 1.4)
        tris.push(...roadRibbon([[ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len], [ax + ((bx - ax) * t1) / len, az + ((bz - az) * t1) / len]], 0.45, 0))
      }
    }
    const pos: number[] = []
    for (let i = 0; i < tris.length; i += 2) pos.push(tris[i], SEA_Y + 0.09, tris[i + 1])
    const dashes = new THREE.BufferGeometry()
    dashes.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return { fill, dashes }
  }, [])
  useEffect(
    () => () => {
      res.fill.dispose()
      res.dashes.dispose()
    },
    [res],
  )
  const mat = useRef<THREE.MeshBasicMaterial>(null!)
  const base = palette.dark ? 0.3 : 0.34
  useFrame((state) => {
    if (mat.current) mat.current.opacity = motion ? base + 0.06 * Math.sin(state.clock.elapsedTime * 1.2) : base
  })
  return (
    <group>
      <mesh geometry={res.fill} renderOrder={1}>
        <meshBasicMaterial ref={mat} color={palette.dark ? '#5fd8ff' : '#c9fbff'} transparent opacity={base} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={res.dashes} renderOrder={2}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <Billboard position={[0, 3.2, GRID * 0.32]}>
        <Text font={FONT_BOLD} fontSize={2.4} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.08} outlineColor="#0f3552">
          Floating city
        </Text>
        <Text font={FONT_SEMI} fontSize={1.3} color="#e8fbff" anchorX="center" anchorY="top" outlineWidth={0.07} outlineColor="#0f3552" position={[0, -0.2, 0]}>
          Not built yet
        </Text>
      </Billboard>
    </group>
  )
}

export default function Ground({ palette, editing, shadows, motion }: { palette: Palette; editing: boolean; shadows: boolean; motion: boolean }) {
  const res = useMemo(() => {
    const tile = tileTexture(C.sand, C.sandDark, false)
    const grid = tileTexture('', 'rgba(255,255,255,0.9)', true)
    grid.repeat.set(WORLD * 2, WORLD - SHORE)
    const waves = waveTexture()
    const octagon = flat(OCTAGON_LAND, 0.012)
    const top = new THREE.MeshLambertMaterial({ map: tile, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    const gridMat = new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.4, depthWrite: false })
    const sea = new THREE.MeshLambertMaterial({ map: waves, color: palette.sea })
    const scene = scenery()
    const sceneMat = new THREE.MeshLambertMaterial({ vertexColors: true })
    return { tile, grid, waves, octagon, top, gridMat, sea, scene, sceneMat }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    res.sea.color.set(palette.sea)
  }, [palette.sea, res])
  useEffect(
    () => () => {
      for (const x of [res.octagon, res.scene, res.tile, res.grid, res.waves, res.top, res.gridMat, res.sea, res.sceneMat]) x.dispose()
    },
    [res],
  )
  useFrame((_, dt) => {
    if (!motion) return
    res.waves.offset.x += dt * 0.003
    res.waves.offset.y += dt * 0.002
  })
  return (
    <group>
      <mesh geometry={res.scene} material={res.sceneMat} receiveShadow={shadows} />
      <mesh geometry={res.octagon} material={res.top} receiveShadow={shadows} />
      {editing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, (SHORE - WORLD) / 2]} material={res.gridMat} renderOrder={2}>
          <planeGeometry args={[WORLD * 2, WORLD - SHORE]} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y, 140]} material={res.sea} receiveShadow={shadows}>
        <planeGeometry args={[600, 300]} />
      </mesh>
      <FloatingCity palette={palette} motion={motion} />
    </group>
  )
}
