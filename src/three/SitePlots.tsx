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
  /** Tap on a site (view mode). */
  onTap: (siteIndex: number) => void
  /** Edit mode: grab / move / drop a site. */
  editing: boolean
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
                if (ev.editing || e.delta > 8) return
                e.stopPropagation()
                ev.onTap(i)
              }}
              onPointerDown={(e) => {
                if (!ev.editing) return
                e.stopPropagation()
                ev.onGrab(i, e)
              }}
              onPointerMove={(e) => ev.editing && ev.onMove(e)}
              onPointerUp={(e) => ev.editing && ev.onDrop(e)}
              onPointerCancel={(e) => ev.editing && ev.onDrop(e)}
            >
              <boxGeometry args={[def.w, h, def.d]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
