import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Kit, rng } from './kit/build'
import { C } from './kit/colors'
import { GRID, OCT, SHORE } from '../lib/site'
import { SEA_Y } from './scopes'
import type { Palette } from './theme3d'

// The octagon: a raised land slab with a tiled top (one tile = one grid
// square), the harbour basin in front of the shore, open sea and the mainland
// with mountains behind. Built once; day / night only changes colours.

const LAND_TOP = 0

/** Octagon ∩ land (z ≤ SHORE), clockwise in the x / z plane. */
const LAND: [number, number][] = [
  [-(OCT - GRID), -GRID],
  [OCT - GRID, -GRID],
  [GRID, -(OCT - GRID)],
  [GRID, SHORE],
  [-GRID, SHORE],
  [-GRID, -(OCT - GRID)],
]

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
    // draw wrapped copies so the texture tiles seamlessly
    for (const dx of [-s, 0, s]) {
      g.beginPath()
      g.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.repeat.set(30, 30)
  return t
}

function landGeometry() {
  const shape = new THREE.Shape(LAND.map(([x, z]) => new THREE.Vector2(x, -z)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.22, bevelSegments: 1 })
  g.rotateX(-Math.PI / 2)
  g.computeBoundingBox()
  g.translate(0, LAND_TOP - g.boundingBox!.max.y, 0)
  return g
}

function scenery() {
  const k = new Kit(false)
  const r = rng(5)
  // mainland behind the site and along the coast (darker than the site so the octagon reads)
  k.box(400, 0.3, 200, C.mainland, { y: -0.7, z: SHORE - 100 })
  k.box(400, 0.3, 0.6, C.sandDark, { y: -0.72, z: SHORE + 0.1 })
  // site hoarding along the octagon's land edges (not along the shore)
  for (let i = 0; i < LAND.length; i++) {
    const [ax, az] = LAND[i]
    const [bx, bz] = LAND[(i + 1) % LAND.length]
    if (az === SHORE && bz === SHORE) continue
    const inset = (v: number) => v - Math.sign(v) * 0.25
    const x0 = inset(ax)
    const z0 = inset(az)
    const x1 = inset(bx)
    const z1 = inset(bz)
    const len = Math.hypot(x1 - x0, z1 - z0)
    const ry = Math.atan2(-(z1 - z0), x1 - x0)
    const at = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, ry }
    k.box(len, 0.5, 0.08, C.white, { ...at, y: 0 })
    k.box(len, 0.1, 0.09, C.blue, { ...at, y: 0.4 })
    const n = Math.round(len / 2.5)
    for (let j = 0; j <= n; j++) k.box(0.1, 0.56, 0.12, C.steelDark, { x: x0 + ((x1 - x0) * j) / n, y: 0, z: z0 + ((z1 - z0) * j) / n, ry })
  }
  // access road to the site gate, with power poles
  k.box(2.4, 0.04, 80, C.asphalt, { y: -0.4, z: -GRID - 40 }).box(2.8, 0.03, 80, C.sandDark, { y: -0.41, z: -GRID - 40 })
  for (let z = -GRID - 3; z > -GRID - 80; z -= 2.2) k.patch(-0.06, z, 0.06, z - 1.1, -0.355, C.marking)
  for (let z = -GRID - 6; z > -GRID - 80; z -= 9) k.box(0.14, 3.2, 0.14, C.wood, { x: 2.4, y: -0.4, z }).box(1.0, 0.08, 0.1, C.wood, { x: 2.4, y: 2.5, z })
  // the workers' camp next to the site: rows of cabins, a water tank and a fence
  const cx = -40
  const cz = -36
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const x = cx + i * 3.2
      const z = cz + row * 3.4
      k.box(2.6, 0.9, 1.4, C.white, { x, y: -0.4, z }).box(2.7, 0.1, 1.5, C.blue, { x, y: 0.5, z })
      k.box(0.5, 0.3, 0.02, C.glassDark, { x: x - 0.6, y: 0.0, z: z + 0.71 }).box(0.5, 0.3, 0.02, C.glassDark, { x: x + 0.6, y: 0.0, z: z + 0.71 })
    }
  }
  k.tube(1.0, 2.2, C.steelLight, [cx + 19.5, 0.7, cz + 3], 'y', 10)
  for (const [x0, z0, x1, z1] of [[cx - 2.5, cz - 1.8, cx + 21.5, cz - 1.8], [cx - 2.5, cz + 9.0, cx + 21.5, cz + 9.0], [cx - 2.5, cz - 1.8, cx - 2.5, cz + 9.0], [cx + 21.5, cz - 1.8, cx + 21.5, cz + 9.0]] as const) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    k.box(len, 0.35, 0.05, C.steelLight, { x: (x0 + x1) / 2, y: -0.4, z: (z0 + z1) / 2, ry: Math.atan2(-(z1 - z0), x1 - x0) })
  }
  // dunes and desert shrubs (kept clear of the site and the camp)
  const clear = (x: number, z: number) => Math.abs(x) + Math.abs(z) < OCT + 8 || (Math.abs(x) < 4 && z < -GRID) || (x > cx - 5 && x < cx + 24 && z > cz - 4 && z < cz + 11)
  for (let i = 0; i < 60; i++) {
    const x = (r() - 0.5) * 170
    const z = SHORE - 3 - r() * 90
    if (clear(x, z)) continue
    if (i % 3 === 0) k.dome(2 + r() * 3, C.sandDark, { x, y: -0.42, z }, 7, 0.25)
    else k.ball(0.3 + r() * 0.3, '#8f8152', { x, y: -0.3, z }, [1, 0.7, 1], 0)
  }
  // mountains
  for (let i = 0; i < 16; i++) {
    const x = -95 + i * 12.5 + r() * 6
    const z = -78 - r() * 30
    const h = 9 + r() * 14
    k.cone(7 + r() * 6, h, i % 2 ? C.mountain : C.mountainDark, { x, y: -0.4, z, ry: r() * 3 }, 6)
    k.cone(3 + r() * 2, h * 0.35, C.rockLight, { x: x + 2, y: -0.4, z: z + 4 }, 5)
  }
  // breakwater around the harbour basin (octagon front edges) with a mouth in the middle
  const edges: [number, number, number, number][] = [
    [GRID, SHORE, OCT - GRID, GRID],
    [OCT - GRID, GRID, 3.5, GRID],
    [-3.5, GRID, -(OCT - GRID), GRID],
    [-(OCT - GRID), GRID, -GRID, SHORE],
  ]
  for (const [x0, z0, x1, z1] of edges) {
    k.beam([x0, SEA_Y - 0.4, z0], [x1, SEA_Y - 0.4, z1], 0.9, 0.9, C.concreteDark)
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.round(len / 0.7)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      k.ball(0.38 + r() * 0.18, r() > 0.5 ? C.concreteLight : C.concrete, { x: x0 + (x1 - x0) * t + (r() - 0.5) * 0.3, y: SEA_Y + 0.15, z: z0 + (z1 - z0) * t + (r() - 0.5) * 0.3, ry: r() * 3 }, [1, 0.75, 1], 0)
    }
  }
  for (const x of [-3.5, 3.5]) k.tube(0.3, 1.4, C.white, [x, SEA_Y + 0.7, GRID], 'y', 8).tube(0.32, 0.25, C.navy, [x, SEA_Y + 1.2, GRID], 'y', 8)
  return k.geometry()
}

export default function Ground({ palette, editing, shadows }: { palette: Palette; editing: boolean; shadows: boolean }) {
  const res = useMemo(() => {
    const land = landGeometry()
    const tile = tileTexture(C.sand, C.sandDark, false)
    const grid = tileTexture('', 'rgba(255,255,255,0.9)', true)
    const waves = waveTexture()
    const top = new THREE.MeshLambertMaterial({ map: tile })
    const side = new THREE.MeshLambertMaterial({ color: C.dirt })
    const gridMat = new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.55, depthWrite: false })
    const sea = new THREE.MeshLambertMaterial({ map: waves, color: palette.sea })
    const scene = scenery()
    const sceneMat = new THREE.MeshLambertMaterial({ vertexColors: true })
    const gridGeo = new THREE.ShapeGeometry(new THREE.Shape(LAND.map(([x, z]) => new THREE.Vector2(x, -z))))
    gridGeo.rotateX(-Math.PI / 2)
    // ShapeGeometry UVs are the shape coords → one texture repeat per tile
    return { land, tile, grid, waves, top, side, gridMat, sea, scene, sceneMat, gridGeo }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    res.sea.color.set(palette.sea)
  }, [palette.sea, res])
  useEffect(
    () => () => {
      for (const x of [res.land, res.scene, res.gridGeo, res.tile, res.grid, res.waves, res.top, res.side, res.gridMat, res.sea, res.sceneMat]) x.dispose()
    },
    [res],
  )
  useFrame((_, dt) => {
    res.waves.offset.x += dt * 0.004
    res.waves.offset.y += dt * 0.0025
  })
  return (
    <group>
      <mesh geometry={res.land} material={[res.top, res.side]} receiveShadow={shadows} />
      {editing && <mesh geometry={res.gridGeo} material={res.gridMat} position={[0, LAND_TOP + 0.09, 0]} renderOrder={2} />}
      <mesh geometry={res.scene} material={res.sceneMat} receiveShadow={shadows} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y, 60]} material={res.sea} receiveShadow={shadows}>
        <planeGeometry args={[420, 300]} />
      </mesh>
    </group>
  )
}
