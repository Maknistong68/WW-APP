import { useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { SITES } from '../lib/site'
import type { SiteRig } from './rig'

export interface SiteGeo {
  solid: THREE.BufferGeometry
  glow: THREE.BufferGeometry
  /** Height of the tallest part (for the tap box). */
  height: number
}

export interface PlotEvents {
  /** view: a tap opens the site card; grab: drag to move (edit, Move tool); pass: taps go to the ground (other tools). */
  mode: 'view' | 'grab' | 'pass'
  /** Tap on a site (view mode). */
  onTap: (siteIndex: number) => void
  onGrab: (siteIndex: number, e: ThreeEvent<PointerEvent>) => void
  onMove: (e: ThreeEvent<PointerEvent>) => void
  onDrop: (e: ThreeEvent<PointerEvent>) => void
}

const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })

/** Every site's static models (one draw call each) plus an invisible tap / drag box. */
export default function SitePlots({ rig, geos, solid, glow, night, shadows, ev }: { rig: SiteRig; geos: (SiteGeo | null)[]; solid: THREE.Material; glow: THREE.Material; night: boolean; shadows: boolean; ev: PlotEvents }) {
  const groups = useRef<(THREE.Group | null)[]>([])
  useFrame((state, dt) => {
    rig.update(state.clock.elapsedTime, dt)
    groups.current.forEach((g, i) => {
      if (!g) return
      g.matrix.copy(rig.matrices[i])
      g.matrixWorldNeedsUpdate = true
    })
  })
  return (
    <group>
      {SITES.map((def, i) => {
        const geo = geos[i]
        if (!geo) return null
        const h = Math.max(1.2, geo.height)
        return (
          <group key={def.id} ref={(g) => (groups.current[i] = g)} matrixAutoUpdate={false}>
            <mesh geometry={geo.solid} material={solid} castShadow={shadows} receiveShadow={shadows} raycast={() => null} />
            <mesh geometry={geo.glow} material={glow} visible={night} raycast={() => null} />
            <mesh
              position={[0, h / 2, 0]}
              visible={false}
              material={hitMat}
              onClick={(e) => {
                if (ev.mode === 'pass' || (ev.mode === 'grab' && e.intersections.some((h) => h.object.userData.mapItem))) return
                e.stopPropagation()
                if (ev.mode === 'view' && e.delta <= 8) ev.onTap(i)
              }}
              onPointerDown={(e) => {
                // a palm / road / block placed on a site is picked before the site itself
                if (ev.mode !== 'grab' || e.intersections.some((h) => h.object.userData.mapItem)) return
                e.stopPropagation()
                ev.onGrab(i, e)
              }}
              onPointerMove={(e) => ev.mode === 'grab' && ev.onMove(e)}
              onPointerUp={(e) => ev.mode === 'grab' && ev.onDrop(e)}
              onPointerCancel={(e) => ev.mode === 'grab' && ev.onDrop(e)}
            >
              <boxGeometry args={[def.w, h, def.d]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
