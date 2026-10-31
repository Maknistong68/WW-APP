import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { CityCamp } from '../lib/city'
import type { Palette } from './theme3d'
import { FONT_SEMI } from './fonts'

const toneOf = (p: Palette, c: CityCamp) => (c.status === 'ok' ? p.good : c.status === 'due' ? p.warn : c.status === 'never' ? p.none : p.bad)

/** One camp: a tent, a glowing countdown ring (arc = days left in the cycle) and a scan beam when inspected this month. */
function Camp({ camp, palette, motion, onPick }: { camp: CityCamp; palette: Palette; motion: boolean; onPick: (c: CityCamp) => void }) {
  const tent = useRef<THREE.Mesh>(null!)
  const beam = useRef<THREE.Mesh>(null!)
  const arcMat = useRef<THREE.MeshBasicMaterial>(null!)
  const color = toneOf(palette, camp)
  const arc = useMemo(() => new THREE.RingGeometry(1.25, 1.55, 64, 1, Math.PI / 2, Math.max(0.0001, camp.fraction * Math.PI * 2)), [camp.fraction])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pulse = motion && (camp.status === 'expired' || camp.status === 'never') ? 0.92 + 0.12 * Math.abs(Math.sin(t * (camp.status === 'never' ? 9 : 3))) : 1
    tent.current.scale.set(pulse, pulse, pulse)
    if (arcMat.current) arcMat.current.opacity = camp.status === 'never' && motion ? 0.4 + 0.4 * Math.abs(Math.sin(t * 7)) : 1
    if (beam.current) {
      beam.current.visible = camp.inspectedThisMonth
      beam.current.rotation.y = motion ? t * 1.6 : 0
    }
  })
  return (
    <group position={[camp.x, 0, camp.z]}>
      <mesh
        ref={tent}
        position={[0, 0.55, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          onPick(camp)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <coneGeometry args={[0.95, 1.1, 4]} />
        <meshStandardMaterial color={color} roughness={0.6} emissive={color} emissiveIntensity={palette.dark ? 0.35 : 0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.25, 1.55, 64]} />
        <meshBasicMaterial color={palette.dark ? '#2a3530' : '#d5ddd8'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} geometry={arc}>
        <meshBasicMaterial ref={arcMat} color={color} toneMapped={false} transparent />
      </mesh>
      <mesh ref={beam} position={[0, 1.6, 0]}>
        <coneGeometry args={[1.2, 2.2, 3, 1, true, 0, Math.PI / 2.5]} />
        <meshBasicMaterial color={palette.info} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <Billboard position={[0, 2, 0]}>
        <Text font={FONT_SEMI} fontSize={0.36} color={palette.text} anchorX="center" outlineWidth={0.02} outlineColor={palette.bg}>
          {camp.name}
        </Text>
        <Text font={FONT_SEMI} fontSize={0.28} color={color} anchorX="center" position={[0, -0.38, 0]} outlineWidth={0.015} outlineColor={palette.bg}>
          {camp.daysLeft === null ? 'Never inspected' : camp.daysLeft < 0 ? `${-camp.daysLeft}d overdue` : `${camp.daysLeft}d left`}
        </Text>
      </Billboard>
    </group>
  )
}

export default function Camps({ camps, palette, visible, motion, onPick }: { camps: CityCamp[]; palette: Palette; visible: boolean; motion: boolean; onPick: (c: CityCamp) => void }) {
  if (!visible) return null
  return (
    <group>
      {camps.map((c) => (
        <Camp key={c.uuid} camp={c} palette={palette} motion={motion} onPick={onPick} />
      ))}
    </group>
  )
}
