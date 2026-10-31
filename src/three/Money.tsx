import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { CityBlock } from '../lib/city'
import { sarShort } from '../lib/money'
import type { Palette } from './theme3d'
import { FONT_BOLD } from './fonts'

const o = new THREE.Object3D()
const MAX = 40
const FLY = 14

/**
 * Money owed (tickets only): a gold coin stack on each contractor's plot
 * (height ∝ √SAR). When the month has recovered money, coins fly from the
 * plots into the vault.
 */
export default function Money({
  blocks,
  recovered,
  month,
  vault,
  palette,
  visible,
  motion,
}: {
  blocks: CityBlock[]
  recovered: number
  month: string
  vault: [number, number, number]
  palette: Palette
  visible: boolean
  motion: boolean
}) {
  const coins = useRef<THREE.InstancedMesh>(null!)
  const flying = useRef<THREE.InstancedMesh>(null!)
  const shown = useRef(new Map<string, number>())
  const flight = useRef<{ month: string; start: number }>({ month: '', start: -10 })
  const from = useMemo(() => {
    const owing = blocks.filter((b) => b.owed > 0)
    const src = owing.length ? owing : blocks
    return Array.from({ length: FLY }, (_, i) => src[i % Math.max(1, src.length)])
  }, [blocks])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const k = motion ? 1 - Math.exp(-Math.min(dt, 0.1) * 4) : 1
    blocks.forEach((b, i) => {
      const cur = shown.current.get(b.contractorUuid) ?? 0
      const next = cur + ((visible ? b.coins : 0) - cur) * k
      shown.current.set(b.contractorUuid, next)
      const full = Math.floor(next)
      const part = next - full
      for (let q = 0; q < MAX; q++) {
        const s = q < full ? 1 : q === full ? part : 0
        o.position.set(b.x + b.w / 2 - 0.4, 0.2 + q * 0.11, b.z + b.d / 2 - 0.4)
        o.rotation.set(0, q * 0.4, 0)
        o.scale.set(s || 0.0001, s || 0.0001, s || 0.0001)
        o.updateMatrix()
        coins.current.setMatrixAt(i * MAX + q, o.matrix)
      }
    })
    coins.current.instanceMatrix.needsUpdate = true

    // recovered money flies to the vault once per month change
    if (flight.current.month !== month) flight.current = { month, start: recovered > 0 && motion ? t : -10 }
    const p = (t - flight.current.start) / 1.8
    for (let i = 0; i < FLY; i++) {
      const b = from[i]
      const live = visible && b && p >= 0 && p < 1 && i < Math.max(3, Math.min(FLY, Math.round(Math.sqrt(recovered / 2000))))
      const q = Math.max(0, Math.min(1, p - i * 0.03))
      const sx = b ? b.x + b.w / 2 - 0.4 : 0
      const sz = b ? b.z + b.d / 2 - 0.4 : 0
      o.position.set(sx + (vault[0] - sx) * q, 1 + Math.sin(q * Math.PI) * 4 + (vault[1] - 1) * q, sz + (vault[2] - sz) * q)
      o.rotation.set(t * 6, 0, t * 4)
      o.scale.setScalar(live ? 1 : 0.0001)
      o.updateMatrix()
      flying.current.setMatrixAt(i, o.matrix)
    }
    flying.current.instanceMatrix.needsUpdate = true
  })

  const gold = <meshStandardMaterial color={palette.gold} metalness={0.75} roughness={0.28} emissive={palette.gold} emissiveIntensity={palette.dark ? 0.25 : 0.05} />
  return (
    <group>
      <instancedMesh key={`coins${blocks.length}`} ref={coins} args={[undefined, undefined, Math.max(1, blocks.length) * MAX]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.09, 20]} />
        {gold}
      </instancedMesh>
      <instancedMesh ref={flying} args={[undefined, undefined, FLY]}>
        <cylinderGeometry args={[0.26, 0.26, 0.07, 16]} />
        {gold}
      </instancedMesh>
      {visible && (
        <group position={vault}>
          <mesh castShadow position={[0, 0.55, 0]}>
            <boxGeometry args={[1.6, 1.1, 1.2]} />
            <meshStandardMaterial color={palette.gold} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.6, 0.61]}>
            <circleGeometry args={[0.3, 24]} />
            <meshStandardMaterial color={palette.dark ? '#3a2d0a' : '#7a5a10'} metalness={0.8} roughness={0.3} />
          </mesh>
          <Billboard position={[0, 1.8, 0]}>
            <Text font={FONT_BOLD} fontSize={0.42} color={palette.text} anchorX="center" outlineWidth={0.02} outlineColor={palette.bg}>
              {`Recovered ${sarShort(recovered)} SAR`}
            </Text>
          </Billboard>
        </group>
      )}
    </group>
  )
}
