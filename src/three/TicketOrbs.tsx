import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { CityBlock, CityTicket } from '../lib/city'
import type { Palette } from './theme3d'

const o = new THREE.Object3D()
const c = new THREE.Color()

interface Orb {
  t: CityTicket
  /** 0..1 grow-in */
  s: number
  ring: number
  color: THREE.Color
  pos: THREE.Vector3
  /** Set when the ticket closed: the orb flies up and fades. */
  leaving: number | null
}

/**
 * Open tickets orbit their contractor's block on three rings by age:
 * inner/low = 0–10 days (green), middle = 11–30 (amber), outer/high = over 30
 * (red). Size = workers affected. Closed tickets fly off into the sky;
 * combined tickets are joined to their main ticket by a thin line.
 */
export default function TicketOrbs({
  tickets,
  blocks,
  capacity,
  palette,
  visible,
  motion,
  onPick,
}: {
  tickets: CityTicket[]
  blocks: CityBlock[]
  capacity: number
  palette: Palette
  visible: boolean
  motion: boolean
  onPick: (t: CityTicket) => void
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const lines = useRef<THREE.LineSegments>(null!)
  const orbs = useRef(new Map<string, Orb>())
  const order = useRef<Orb[]>([])
  const blockOf = useMemo(() => new Map(blocks.map((b) => [b.contractorUuid, b])), [blocks])
  const ringColor = (r: number) => (r === 2 ? palette.bad : r === 1 ? palette.warn : palette.good)
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 6), 3))
    return g
  }, [capacity])

  useLayoutEffect(() => {
    for (let i = 0; i < capacity; i++) mesh.current.setColorAt(i, c.set(palette.good))
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    ;(mesh.current.material as THREE.Material).needsUpdate = true
  }, [capacity, palette])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const k = motion ? 1 - Math.exp(-Math.min(dt, 0.1) * 4) : 1
    const now = new Set(tickets.map((x) => x.uuid))
    for (const x of tickets) {
      const orb = orbs.current.get(x.uuid)
      if (!orb) orbs.current.set(x.uuid, { t: x, s: motion ? 0 : 1, ring: x.ring, color: new THREE.Color(ringColor(x.ring)), pos: new THREE.Vector3(), leaving: null })
      else {
        orb.t = x
        orb.leaving = null
      }
    }
    for (const [id, orb] of orbs.current) {
      if (!now.has(id) && orb.leaving === null) orb.leaving = motion ? t : t - 10
      if (orb.leaving !== null && t - orb.leaving > 1.4) orbs.current.delete(id)
    }
    order.current = [...orbs.current.values()].slice(0, capacity)
    const pos = new Map<string, THREE.Vector3>()
    order.current.forEach((orb, i) => {
      const b = blockOf.get(orb.t.contractorUuid)
      const cx = b?.x ?? 0
      const cz = b?.z ?? 0
      const base = b ? Math.max(b.w, b.d) / 2 + 0.55 : 1.5
      orb.ring += (orb.t.ring - orb.ring) * k
      const r = base + orb.ring * 0.6
      const speed = motion ? 0.22 / (1 + orb.ring * 0.6) : 0
      const ang = orb.t.angle + t * speed
      let y = 0.7 + orb.ring * 0.8 + (motion ? 0.12 * Math.sin(t * 1.4 + orb.t.angle * 3) : 0)
      let scale = orb.t.size
      if (orb.leaving !== null) {
        const p = Math.min(1, (t - orb.leaving) / 1.4)
        y += p * 6
        scale *= 1 - p
      } else {
        orb.s += (1 - orb.s) * k
        scale *= orb.s
      }
      orb.pos.set(cx + Math.cos(ang) * r, y, cz + Math.sin(ang) * r)
      pos.set(orb.t.uuid, orb.pos)
      o.position.copy(orb.pos)
      o.scale.setScalar(visible ? Math.max(0.0001, scale) : 0.0001)
      o.updateMatrix()
      mesh.current.setMatrixAt(i, o.matrix)
      orb.color.lerp(c.set(orb.leaving !== null ? palette.good : ringColor(orb.t.ring)), k)
      mesh.current.setColorAt(i, orb.color)
    })
    mesh.current.count = order.current.length
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true

    // combined tickets → line to their main ticket
    const arr = lineGeo.attributes.position.array as Float32Array
    let n = 0
    if (visible)
      for (const orb of order.current) {
        const parent = orb.t.parentUuid && pos.get(orb.t.parentUuid)
        if (!parent || orb.leaving !== null || n >= capacity) continue
        arr.set([orb.pos.x, orb.pos.y, orb.pos.z, parent.x, parent.y, parent.z], n * 6)
        n++
      }
    lineGeo.setDrawRange(0, n * 2)
    lineGeo.attributes.position.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, capacity]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          const orb = order.current[e.instanceId ?? -1]
          if (orb && orb.leaving === null) onPick(orb.t)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[1, 20, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <lineSegments ref={lines} geometry={lineGeo}>
        <lineBasicMaterial color={palette.info} transparent opacity={0.6} />
      </lineSegments>
    </group>
  )
}
