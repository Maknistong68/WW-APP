import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import Text from './SafeText'
import { Kit } from './kit/build'
import { springStep, type Spring } from './kit/spring'
import { FONT_BOLD, FONT_SEMI } from './fonts'
import { statusColor, type Palette } from './theme3d'
import type { SiteRig } from './rig'
import type { OfficeHealth } from '../lib/site'
import { pct, type KpiStatus } from '../lib/kpi'

export interface BarOffice {
  key: string
  site: number
  at: [number, number]
  /** "SAMA", "Al Fahad 823" */
  name: string
  off: boolean
}

// A game-style health bar over each site office: full = 100 % compliance,
// empty = 0 %. Bars keep the same size on screen (readable on a phone), are
// drawn on top of everything, fill with a springy overshoot and pop when the
// status changes. Names show when zoomed in or selected.

const BAR_W = 2.0
const BAR_H = 0.3
const INNER = BAR_W - 0.14
const BAR_Y = 1.75
const NAME_PX = 0.075 // show names when one pixel is less than this many world units

function barGeometries() {
  const frame = new Kit(false)
  frame.rbox(BAR_W + 0.16, BAR_H + 0.16, 0.04, 0.1, '#ffffff', { y: -(BAR_H + 0.16) / 2, z: -0.02 })
  frame.rbox(BAR_W, BAR_H, 0.05, 0.07, '#1a222d', { y: -BAR_H / 2 })
  const fill = new Kit(false)
  fill.box(1, BAR_H - 0.1, 0.02, '#c9c9c9', { x: 0.5, y: -(BAR_H - 0.1) / 2, z: 0.035 })
  fill.box(1, (BAR_H - 0.1) * 0.42, 0.022, '#ffffff', { x: 0.5, y: 0.0, z: 0.036 })
  const notch = new Kit(false)
  for (let i = 1; i < 10; i++) notch.box(0.014, BAR_H - 0.1, 0.01, '#1a222d', { x: -INNER / 2 + (INNER * i) / 10, y: -(BAR_H - 0.1) / 2, z: 0.05 })
  // the fill runs from x = 0 to 1 (scaled by the KPI), centred on y = 0, lighter top half
  return { frame: frame.geometry(), fill: fill.geometry(), notch: notch.geometry() }
}

const overlay = () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, depthTest: false, depthWrite: false, transparent: true })

export default function HealthBars({
  rig,
  offices,
  health,
  palette,
  motion,
  selected,
  onPick,
}: {
  rig: SiteRig
  offices: BarOffice[]
  health: Map<string, OfficeHealth>
  palette: Palette
  motion: boolean
  selected: string | null
  onPick: (key: string) => void
}) {
  const { camera, size } = useThree()
  const n = offices.length
  const meshes = useMemo(() => {
    const geos = barGeometries()
    const mk = (geo: THREE.BufferGeometry, order: number) => {
      const mesh = new THREE.InstancedMesh(geo, overlay(), Math.max(1, n))
      mesh.frustumCulled = false
      mesh.renderOrder = order
      return mesh
    }
    const frame = mk(geos.frame, 20)
    const fill = mk(geos.fill, 21)
    const notch = mk(geos.notch, 22)
    fill.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3).fill(1), 3)
    return { frame, fill, notch }
  }, [n])
  useEffect(
    () => () => {
      for (const m of [meshes.frame, meshes.fill, meshes.notch]) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
        m.dispose()
      }
    },
    [meshes],
  )

  const anim = useMemo(() => offices.map(() => ({ fill: { x: 0, v: 0 } as Spring, pop: { x: 0, v: 0 } as Spring, status: '' as KpiStatus | '', col: new THREE.Color(palette.none) })), [n]) // eslint-disable-line react-hooks/exhaustive-deps
  const labels = useRef<(THREE.Object3D | null)[]>([])
  const names = useRef<(THREE.Object3D | null)[]>([])
  const tmp = useMemo(
    () => ({ a: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(), left: new THREE.Vector3(), m: new THREE.Matrix4(), s: new THREE.Vector3(), p: new THREE.Vector3(), target: new THREE.Color() }),
    [],
  )
  const persp = camera as THREE.PerspectiveCamera
  const pick = useRef(onPick)
  pick.current = onPick

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    rig.update(t, dt)
    const tan = Math.tan(((persp.fov ?? 40) * Math.PI) / 360)
    tmp.up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    tmp.right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    offices.forEach((o, i) => {
      const h = health.get(o.key)
      const a = anim[i]
      const status = h?.status ?? 'none'
      if (a.status !== status) {
        if (a.status !== '' && motion) a.pop.v = 7
        a.status = status
      }
      const target = h?.fill ?? 0
      if (motion) {
        springStep(a.fill, target, dt, 90, 9)
        springStep(a.pop, 0, dt, 220, 10)
        a.col.lerp(tmp.target.set(statusColor(palette, status)), 1 - Math.exp(-dt * 6))
      } else {
        a.fill.x = target
        a.pop.x = 0
        a.col.set(statusColor(palette, status))
      }
      tmp.a.set(o.at[0], BAR_Y, o.at[1]).applyMatrix4(rig.matrices[o.site])
      const d = camera.position.distanceTo(tmp.a)
      const wpp = (2 * d * tan) / Math.max(1, size.height)
      const sel = selected === o.key
      const grow = (sel ? 1.25 : 1) * (1 + a.pop.x * 0.18)
      const s = Math.min(6, Math.max(0.35, ((size.width < 600 ? 50 : 62) * wpp) / BAR_W)) * grow * Math.min(1, rig.scale(o.site))
      tmp.p.copy(tmp.a).addScaledVector(tmp.up, (BAR_H / 2 + 0.1) * s)
      tmp.m.compose(tmp.p, camera.quaternion, tmp.s.set(s, s * (1 - a.pop.x * 0.12), s))
      meshes.frame.setMatrixAt(i, tmp.m)
      meshes.notch.setMatrixAt(i, tmp.m)
      const f = Math.max(0.0001, Math.min(1.03, a.fill.x))
      // fill grows from the left edge of the inner bar
      tmp.left.copy(tmp.p).addScaledVector(tmp.right, (-INNER / 2) * s)
      tmp.m.compose(tmp.left, camera.quaternion, tmp.s.set(INNER * f * s, s, s))
      meshes.fill.setMatrixAt(i, tmp.m)
      const pulse = status === 'bad' && motion ? 0.82 + 0.18 * Math.abs(Math.sin(t * 3)) : 1
      meshes.fill.setColorAt(i, tmp.target.copy(a.col).multiplyScalar(pulse))
      const lab = labels.current[i]
      if (lab) {
        lab.position.copy(tmp.a).addScaledVector(tmp.up, (BAR_H + 0.22) * s)
        lab.scale.setScalar(s)
      }
      const nm = names.current[i]
      if (nm) {
        nm.visible = sel || wpp < NAME_PX
        nm.position.copy(tmp.a).addScaledVector(tmp.up, -0.05 * s)
        nm.scale.setScalar(s)
      }
    })
    for (const m of [meshes.frame, meshes.fill, meshes.notch]) {
      m.count = n
      m.instanceMatrix.needsUpdate = true
    }
    if (meshes.fill.instanceColor) meshes.fill.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <primitive
        object={meshes.frame}
        onClick={(e: { instanceId?: number; delta: number; stopPropagation: () => void }) => {
          if (e.instanceId === undefined || e.delta > 8) return
          e.stopPropagation()
          const o = offices[e.instanceId]
          if (o) pick.current(o.key)
        }}
      />
      <primitive object={meshes.fill} />
      <primitive object={meshes.notch} />
      {offices.map((o, i) => {
        const h = health.get(o.key)
        const text = h && h.overall !== null ? `${pct(h.overall)}${o.off ? ' · off' : ''}` : 'No data'
        return (
          <group key={o.key}>
            <Billboard ref={(g) => (labels.current[i] = g)}>
              <Text font={FONT_BOLD} fontSize={0.42} color="#ffffff" anchorX="center" anchorY="bottom" outlineWidth={0.07} outlineColor="#141b24" renderOrder={23}>
                {text}
                <meshBasicMaterial depthTest={false} depthWrite={false} toneMapped={false} transparent />
              </Text>
            </Billboard>
            <Billboard ref={(g) => (names.current[i] = g)} visible={false}>
              <Text font={FONT_SEMI} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="top" outlineWidth={0.06} outlineColor="#141b24" renderOrder={23}>
                {o.name}
                <meshBasicMaterial depthTest={false} depthWrite={false} toneMapped={false} transparent />
              </Text>
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}
