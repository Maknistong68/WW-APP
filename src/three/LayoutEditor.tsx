import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SITES, SITE_BY_ID, footprint, type Fit, type Layout } from '../lib/site'
import type { Palette } from './theme3d'

/**
 * Edit-mode overlay: every site's footprint as a faint outline, the selected
 * site's footprint glowing green when it fits (red when it doesn't), and a
 * dust ring where a site was dropped.
 */
export default function LayoutEditor({ layout, selected, fit, palette, motion, drop }: { layout: Layout; selected: string | null; fit: Fit | null; palette: Palette; motion: boolean; drop: { x: number; z: number; v: number } | null }) {
  const outlines = useMemo(() => {
    const pts: number[] = []
    for (const def of SITES) {
      const r = footprint(def, layout[def.id])
      const y = 0.12
      const c = [
        [r.x0, r.z0],
        [r.x1, r.z0],
        [r.x1, r.z1],
        [r.x0, r.z1],
      ]
      for (let i = 0; i < 4; i++) {
        const a = c[i]
        const b = c[(i + 1) % 4]
        pts.push(a[0], y, a[1], b[0], y, b[1])
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [layout])
  useEffect(() => () => outlines.dispose(), [outlines])

  const def = selected ? SITE_BY_ID.get(selected) : undefined
  const rect = def ? footprint(def, layout[def.id]) : null
  const area = useRef<THREE.Mesh>(null!)
  const areaMat = useRef<THREE.MeshBasicMaterial>(null!)
  const ring = useRef<THREE.Mesh>(null!)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!)
  const dropStart = useRef(-10)
  const lastDrop = useRef(0)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (areaMat.current) areaMat.current.opacity = motion ? 0.38 + 0.14 * Math.sin(t * 5) : 0.45
    if (drop && drop.v !== lastDrop.current) {
      lastDrop.current = drop.v
      dropStart.current = t
    }
    if (ring.current && ringMat.current && drop) {
      const a = (t - dropStart.current) / 0.6
      ring.current.visible = motion && a >= 0 && a < 1
      ring.current.position.set(drop.x, 0.14, drop.z)
      ring.current.scale.setScalar(1 + a * 5)
      ringMat.current.opacity = 0.6 * (1 - a)
    }
  })

  return (
    <group>
      <lineSegments geometry={outlines} renderOrder={5}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.75} depthWrite={false} />
      </lineSegments>
      {rect && (
        <mesh ref={area} rotation={[-Math.PI / 2, 0, 0]} position={[(rect.x0 + rect.x1) / 2, 0.11, (rect.z0 + rect.z1) / 2]} renderOrder={6}>
          <planeGeometry args={[rect.x1 - rect.x0, rect.z1 - rect.z0]} />
          <meshBasicMaterial ref={areaMat} color={fit?.ok ? palette.good : palette.bad} transparent opacity={0.45} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={7}>
        <ringGeometry args={[0.6, 0.85, 32]} />
        <meshBasicMaterial ref={ringMat} color="#e8d2a8" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
