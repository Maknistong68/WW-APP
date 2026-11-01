import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Kit, rng } from './kit/build'
import { C } from './kit/colors'
import { GRID, OCT, WORLD } from '../lib/world'
import { SEA_Y } from './scopes'
import type { Palette } from './theme3d'

// The far world: the sea all round, desert dunes and mountains inland, and the
// tile grid while editing. The land, port, basin, pier and floating city come
// from the editable zones (Zones.tsx). Built once; day / night only changes
// colours.

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

function scenery() {
  const k = new Kit(false)
  const r = rng(5)
  // dunes and desert shrubs, out of the way of the octagon and the buildable area's middle
  for (let i = 0; i < 160; i++) {
    const x = (r() - 0.5) * 640
    const z = -4 - r() * 320
    const near = Math.abs(x) < WORLD && z > -WORLD
    if (near && r() > 0.2) continue
    if (Math.abs(x) + Math.abs(z) < OCT + 14 && Math.abs(x) < GRID + 14 && z > -GRID - 14) continue
    if (i % 3 === 0) k.dome(4 + r() * 7, C.sandDark, { x, y: 0, z }, 7, 0.2)
    else k.ball(0.4 + r() * 0.4, '#8f8152', { x, y: 0.1, z }, [1, 0.7, 1], 0)
  }
  // mountains far inland
  for (let i = 0; i < 30; i++) {
    const x = -330 + i * 23 + r() * 10
    const z = -WORLD - 40 - r() * 70
    const h = 22 + r() * 34
    k.cone(16 + r() * 14, h, i % 2 ? C.mountain : C.mountainDark, { x, y: 0, z, ry: r() * 3 }, 6)
    k.cone(7 + r() * 5, h * 0.35, C.rockLight, { x: x + 5, y: 0, z: z + 8 }, 5)
  }
  return k.geometry()
}

export default function Ground({ palette, editing, shadows, motion }: { palette: Palette; editing: boolean; shadows: boolean; motion: boolean }) {
  const res = useMemo(() => {
    const grid = tileTexture('', 'rgba(255,255,255,0.9)', true)
    grid.repeat.set(WORLD * 2, WORLD + GRID)
    const waves = waveTexture()
    waves.repeat.set(120, 120)
    const gridMat = new THREE.MeshBasicMaterial({ map: grid, transparent: true, opacity: 0.35, depthWrite: false })
    const sea = new THREE.MeshLambertMaterial({ map: waves, color: palette.sea })
    const scene = scenery()
    const sceneMat = new THREE.MeshLambertMaterial({ vertexColors: true })
    return { grid, waves, gridMat, sea, scene, sceneMat }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    res.sea.color.set(palette.sea)
  }, [palette.sea, res])
  useEffect(
    () => () => {
      for (const x of [res.scene, res.grid, res.waves, res.gridMat, res.sea, res.sceneMat]) x.dispose()
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
      {editing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, (GRID - WORLD) / 2]} material={res.gridMat} renderOrder={2} raycast={() => null}>
          <planeGeometry args={[WORLD * 2, WORLD + GRID]} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y, 100]} material={res.sea} receiveShadow={shadows}>
        <planeGeometry args={[1400, 1400]} />
      </mesh>
    </group>
  )
}
