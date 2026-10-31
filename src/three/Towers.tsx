import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { CityTower } from '../lib/city'
import { pulseSpeed, statusColor, type Palette } from './theme3d'
import type { Layers } from './layers'

const o = new THREE.Object3D()
const c = new THREE.Color()

interface Anim {
  h: number
  bands: THREE.Color[]
  beacon: THREE.Color
  smoke: number
}

/**
 * Each work order is a tower: height = workers, 8 glowing floor bands = the
 * 8 KPI items, a beacon on the roof = overall KPI (critical ones pulse fast
 * and shoot a red beam), a helipad with 3 lights = WPS / manpower / salary
 * (a drone lands when all three are in), close-out cubes at the base.
 */
export default function Towers({
  towers,
  palette,
  layers,
  motion,
  selected,
  onPick,
}: {
  towers: CityTower[]
  palette: Palette
  layers: Layers
  motion: boolean
  selected: string | null
  onPick: (t: CityTower) => void
}) {
  const N = towers.length
  const core = useRef<THREE.InstancedMesh>(null!)
  const bands = useRef<THREE.InstancedMesh>(null!)
  const beacons = useRef<THREE.InstancedMesh>(null!)
  const beams = useRef<THREE.InstancedMesh>(null!)
  const pads = useRef<THREE.InstancedMesh>(null!)
  const drones = useRef<THREE.InstancedMesh>(null!)
  const cubes = useRef<THREE.InstancedMesh>(null!)
  const smoke = useRef<THREE.Points>(null!)
  const ring = useRef<THREE.Mesh>(null!)
  const anim = useRef(new Map<string, Anim>())

  const SMOKE_PER = 24
  const smokeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * SMOKE_PER * 3), 3))
    return g
  }, [N])

  // Instance colours must exist before the first draw so the shader compiles with them.
  useLayoutEffect(() => {
    for (const m of [bands.current, beacons.current, pads.current, cubes.current]) {
      if (!m) continue
      for (let i = 0; i < m.count; i++) m.setColorAt(i, c.set(palette.none))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      ;(m.material as THREE.Material).needsUpdate = true
    }
  }, [N, palette])

  useFrame((state, dt) => {
    const k = motion ? 1 - Math.exp(-Math.min(dt, 0.1) * 4) : 1
    const t = state.clock.elapsedTime
    const sel = towers.find((tw) => tw.key === selected)
    if (ring.current) {
      ring.current.visible = !!sel
      if (sel) {
        ring.current.position.set(sel.x, 0.14, sel.z)
        ring.current.scale.setScalar(motion ? 1 + 0.06 * Math.sin(t * 4) : 1)
      }
    }
    const smokePos = smokeGeo.attributes.position as THREE.BufferAttribute
    towers.forEach((tw, i) => {
      let a = anim.current.get(tw.key)
      if (!a) {
        a = { h: 0.05, bands: Array.from({ length: 8 }, () => new THREE.Color(palette.none)), beacon: new THREE.Color(palette.none), smoke: 0 }
        anim.current.set(tw.key, a)
      }
      a.h += (tw.height - a.h) * k
      a.smoke += ((layers.workers ? Math.min(SMOKE_PER, tw.illegal * 3) : 0) - a.smoke) * k

      // core
      o.position.set(tw.x, a.h / 2, tw.z)
      o.rotation.set(0, 0, 0)
      o.scale.set(1.25, a.h, 1.25)
      o.updateMatrix()
      core.current.setMatrixAt(i, o.matrix)

      // 8 KPI floors
      const fh = a.h / 8
      for (let f = 0; f < 8; f++) {
        const target = layers.floors ? (tw.floors[f] === 'none' ? palette.noData : statusColor(palette, tw.floors[f])) : palette.core
        a.bands[f].lerp(c.set(target), k)
        o.position.set(tw.x, fh * (f + 0.5), tw.z)
        o.scale.set(1.42, Math.max(0.02, fh * 0.58), 1.42)
        o.updateMatrix()
        bands.current.setMatrixAt(i * 8 + f, o.matrix)
        bands.current.setColorAt(i * 8 + f, a.bands[f])
      }

      // beacon + critical beam
      const sp = pulseSpeed(tw.status)
      const pulse = motion && sp ? 0.85 + 0.3 * Math.sin(t * sp) : 1
      a.beacon.lerp(c.set(statusColor(palette, tw.status)), k)
      o.position.set(tw.x, a.h + 0.32, tw.z)
      o.scale.setScalar(0.32 * pulse)
      o.updateMatrix()
      beacons.current.setMatrixAt(i, o.matrix)
      beacons.current.setColorAt(i, a.beacon)
      const beam = tw.status === 'bad' && layers.floors ? (motion ? 0.7 + 0.3 * Math.sin(t * 3 + i) : 1) : 0
      o.position.set(tw.x, a.h + 0.3 + 4, tw.z)
      o.scale.set(beam, beam ? 8 : 0.0001, beam)
      o.updateMatrix()
      beams.current.setMatrixAt(i, o.matrix)

      // helipad: WPS / manpower / salary
      for (let p = 0; p < 3; p++) {
        const ok = tw.submissions[p]
        const blink = ok || !motion ? 1 : 0.55 + 0.45 * Math.round((Math.sin(t * 6 + p) + 1) / 2)
        o.position.set(tw.x - 0.36 + p * 0.36, a.h + 0.05, tw.z + 0.46)
        o.scale.setScalar(layers.submissions ? 0.12 * blink : 0.0001)
        o.updateMatrix()
        pads.current.setMatrixAt(i * 3 + p, o.matrix)
        pads.current.setColorAt(i * 3 + p, c.set(ok ? palette.good : palette.bad))
      }
      const all = tw.submissions.every(Boolean)
      const hover = motion ? 0.25 + 0.12 * Math.sin(t * 2.2 + i) : 0.2
      o.position.set(tw.x, a.h + 0.45 + hover, tw.z - 0.05)
      o.rotation.set(0, motion ? t * 1.5 + i : 0, 0)
      o.scale.set(all && layers.submissions ? 0.42 : 0.0001, 0.08, all && layers.submissions ? 0.42 : 0.0001)
      o.updateMatrix()
      drones.current.setMatrixAt(i, o.matrix)
      o.rotation.set(0, 0, 0)

      // close-out cubes around the base
      const f = tw.findings
      for (let q = 0; q < 12; q++) {
        const show = layers.closeout && f && q < Math.min(12, f.total)
        const closed = !!f && q < f.closed
        const ang = (q / 12) * Math.PI * 2
        const flash = f && f.status === 'overdue' && !closed && motion ? 0.75 + 0.35 * Math.abs(Math.sin(t * 5)) : 1
        o.position.set(tw.x + Math.cos(ang) * 1.1, closed ? 0.06 : 0.2, tw.z + Math.sin(ang) * 1.1)
        o.scale.setScalar(show ? (closed ? 0.12 : 0.2 * flash) : 0.0001)
        o.updateMatrix()
        cubes.current.setMatrixAt(i * 12 + q, o.matrix)
        cubes.current.setColorAt(i * 12 + q, c.set(closed ? palette.good : palette.bad))
      }

      // illegal / freelance workers: red smoke from the roof
      for (let s = 0; s < SMOKE_PER; s++) {
        const idx = (i * SMOKE_PER + s) * 3
        if (s < Math.round(a.smoke)) {
          const ph = (s * 0.37 + i * 0.13) % 1
          const life = motion ? (t * 0.35 + ph) % 1 : ph
          smokePos.array[idx] = tw.x + Math.sin(s * 12.9 + t * 0.6) * 0.25 * life
          smokePos.array[idx + 1] = a.h + 0.4 + life * 2.4
          smokePos.array[idx + 2] = tw.z + Math.cos(s * 7.1 + t * 0.5) * 0.25 * life
        } else {
          smokePos.array[idx + 1] = -50
        }
      }
    })
    for (const m of [core.current, bands.current, beacons.current, beams.current, pads.current, drones.current, cubes.current]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    smokePos.needsUpdate = true
  })

  const pick = (per: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const tw = towers[Math.floor((e.instanceId ?? 0) / per)]
    if (tw) onPick(tw)
  }
  const hover = (on: boolean) => () => {
    document.body.style.cursor = on ? 'pointer' : ''
  }

  return (
    <group>
      <instancedMesh key={`core${N}`} ref={core} args={[undefined, undefined, N]} castShadow receiveShadow onClick={pick(1)} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.core} roughness={0.8} metalness={0.05} />
      </instancedMesh>
      <instancedMesh key={`bands${N}`} ref={bands} args={[undefined, undefined, N * 8]} onClick={pick(8)}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh key={`beacon${N}`} ref={beacons} args={[undefined, undefined, N]}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh key={`beam${N}`} ref={beams} args={[undefined, undefined, N]}>
        <cylinderGeometry args={[0.18, 0.32, 1, 16, 1, true]} />
        <meshBasicMaterial color={palette.bad} transparent opacity={palette.dark ? 0.32 : 0.22} depthWrite={false} side={THREE.DoubleSide} blending={palette.dark ? THREE.AdditiveBlending : THREE.NormalBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh key={`pads${N}`} ref={pads} args={[undefined, undefined, N * 3]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh key={`drones${N}`} ref={drones} args={[undefined, undefined, N]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.dark ? '#cfd8d3' : '#33403a'} metalness={0.4} roughness={0.4} />
      </instancedMesh>
      <instancedMesh key={`cubes${N}`} ref={cubes} args={[undefined, undefined, N * 12]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <points key={`smoke${N}`} ref={smoke} geometry={smokeGeo}>
        <pointsMaterial color={palette.bad} size={0.16} transparent opacity={0.75} depthWrite={false} sizeAttenuation />
      </points>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.2, 1.5, 48]} />
        <meshBasicMaterial color={palette.brand} toneMapped={false} />
      </mesh>
    </group>
  )
}
