import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { CityBlock } from '../lib/city'
import { statusColor, type Palette } from './theme3d'
import { FONT_BOLD, FONT_SEMI } from './fonts'

/** The floating island, one plot per contractor (tinted by its KPI) and its name painted on the street. */
export function Island({ radius, blocks, palette }: { radius: number; blocks: CityBlock[]; palette: Palette }) {
  return (
    <group>
      <mesh position={[0, -0.9, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius * 0.86, 1.8, 72, 1]} />
        <meshStandardMaterial color={palette.islandSide} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <circleGeometry args={[radius, 72]} />
        <meshStandardMaterial color={palette.island} roughness={0.95} />
      </mesh>
      {blocks.map((b) => {
        const tint = new THREE.Color(palette.plot).lerp(new THREE.Color(statusColor(palette, b.status)), b.status === 'none' ? 0 : 0.22)
        return (
          <group key={b.contractorUuid}>
            <mesh position={[b.x, 0.06, b.z]} receiveShadow>
              <boxGeometry args={[b.w, 0.12, b.d]} />
              <meshStandardMaterial color={tint} roughness={0.9} />
            </mesh>
            <Text
              font={FONT_BOLD}
              position={[b.x, 0.22, b.z + b.d / 2 + 0.45]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.42}
              maxWidth={b.w + 1.6}
              color={palette.text}
              anchorX="center"
              anchorY="middle"
              textAlign="center"
            >
              {b.name}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

/**
 * The backlog tide: water around the island rises and falls with the number
 * of open tickets (scaled to the busiest month), plus a tide gauge.
 */
export function Tide({ radius, level, open, palette, visible, motion }: { radius: number; level: number; open: number; palette: Palette; visible: boolean; motion: boolean }) {
  const water = useRef<THREE.Mesh>(null!)
  const marker = useRef<THREE.Group>(null!)
  const y = useRef(-1.6)
  // A full disc: at low tide it sits under the island; in the worst month it floods the streets.
  const geo = useMemo(() => new THREE.CircleGeometry(radius * 2.4, 96), [radius])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  const gaugeAt = useMemo(() => {
    const a = Math.PI * 0.3
    return [Math.cos(a) * (radius - 1.5), Math.sin(a) * (radius - 1.5)] as const
  }, [radius])
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const k = motion ? 1 - Math.exp(-Math.min(dt, 0.1) * 3) : 1
    const target = -1.6 + level * 1.76
    y.current += (target - y.current) * k
    water.current.position.y = y.current
    if (motion) {
      const p = geo.attributes.position.array as Float32Array
      for (let i = 0; i < p.length; i += 3) {
        const x = base[i]
        const yy = base[i + 1]
        p[i + 2] = Math.sin(x * 0.45 + t * 1.2) * 0.08 + Math.cos(yy * 0.5 + t * 0.9) * 0.08
      }
      geo.attributes.position.needsUpdate = true
    }
    if (marker.current) marker.current.position.y = y.current
  })
  if (!visible) return null
  return (
    <group>
      <mesh ref={water} geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={palette.water} transparent opacity={palette.dark ? 0.55 : 0.6} roughness={0.15} metalness={0.2} emissive={palette.water} emissiveIntensity={palette.dark ? 0.25 : 0} />
      </mesh>
      <group position={[gaugeAt[0], 0, gaugeAt[1]]}>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 3.6, 10]} />
          <meshStandardMaterial color={palette.dark ? '#cfd8d3' : '#45524b'} />
        </mesh>
        {[0, 0.25, 0.5, 0.75, 1].map((m) => (
          <mesh key={m} position={[0.12, -1.6 + m * 1.76, 0]}>
            <boxGeometry args={[0.22, 0.03, 0.03]} />
            <meshBasicMaterial color={palette.muted} />
          </mesh>
        ))}
        <group ref={marker}>
          <mesh>
            <sphereGeometry args={[0.16, 14, 10]} />
            <meshBasicMaterial color={palette.water} toneMapped={false} />
          </mesh>
          <Billboard position={[0, 0.9, 0]}>
            <Text font={FONT_BOLD} fontSize={0.4} color={palette.text} anchorX="center" outlineWidth={0.02} outlineColor={palette.bg}>
              {`${open} open`}
            </Text>
            <Text font={FONT_SEMI} fontSize={0.26} color={palette.muted} anchorX="center" position={[0, -0.36, 0]} outlineWidth={0.015} outlineColor={palette.bg}>
              backlog tide
            </Text>
          </Billboard>
        </group>
      </group>
    </group>
  )
}
