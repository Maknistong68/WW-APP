import { useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, PerformanceMonitor, Stars } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { City, CityCamp, CityTicket, CityTower } from '../lib/city'
import Towers from './Towers'
import TicketOrbs from './TicketOrbs'
import Money from './Money'
import Camps from './Camps'
import { Island, Tide } from './Island'
import CameraRig, { type Focus } from './CameraRig'
import type { Layers } from './layers'
import type { Palette } from './theme3d'

/** Sky colour follows the site's overall KPI: clear, haze or storm. */
function Sky({ color }: { color: string }) {
  const { scene } = useThree()
  const cur = useRef(new THREE.Color(color))
  useFrame((_, dt) => {
    cur.current.lerp(new THREE.Color(color), 1 - Math.exp(-dt * 2))
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color()
    ;(scene.background as THREE.Color).copy(cur.current)
    if (scene.fog) scene.fog.color.copy(cur.current)
  })
  return null
}

export interface ScenePicks {
  onTower: (t: CityTower) => void
  onTicket: (t: CityTicket) => void
  onCamp: (c: CityCamp) => void
  onNothing: () => void
}

export default function CityScene({
  city,
  capacity,
  palette,
  layers,
  motion,
  selected,
  focus,
  picks,
}: {
  city: City
  capacity: number
  palette: Palette
  layers: Layers
  motion: boolean
  selected: string | null
  focus: Focus | null
  picks: ScenePicks
}) {
  const [degraded, setDegraded] = useState(false)
  const r = city.radius
  const vault: [number, number, number] = [0, 0, -(city.inner + 2.6)]
  return (
    <Canvas
      shadows
      dpr={[1, degraded ? 1 : 1.75]}
      camera={{ fov: 42, near: 0.5, far: 600, position: [r, r, r * 1.2] }}
      gl={{ antialias: true, preserveDrawingBuffer: import.meta.env.DEV }}
      onPointerMissed={picks.onNothing}
      aria-label="3D view of the site"
    >
      <PerformanceMonitor onDecline={() => setDegraded(true)} flipflops={2} />
      <Sky color={palette.sky[city.sky.status]} />
      <fog attach="fog" args={[palette.sky[city.sky.status], r * 2.2, r * 5]} />
      <hemisphereLight args={[palette.dark ? '#7c96b8' : '#ffffff', palette.dark ? '#0b100e' : '#b9c7bf', palette.dark ? 0.45 : 1.0]} />
      <directionalLight
        castShadow
        position={[r * 0.8, r * 1.6, r * 0.5]}
        intensity={palette.dark ? 0.55 : 1.6}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-r}
        shadow-camera-right={r}
        shadow-camera-top={r}
        shadow-camera-bottom={-r}
        shadow-camera-far={r * 4}
      />
      {palette.dark && <Stars radius={r * 4} depth={40} count={1800} factor={4} fade speed={motion ? 0.6 : 0} />}

      <Island radius={r} blocks={city.blocks} palette={palette} />
      <Towers towers={city.towers} palette={palette} layers={degraded ? { ...layers, workers: false } : layers} motion={motion} selected={selected} onPick={picks.onTower} />
      <TicketOrbs tickets={city.tickets} blocks={city.blocks} capacity={capacity} palette={palette} visible={layers.tickets} motion={motion} onPick={picks.onTicket} />
      <Money blocks={city.blocks} recovered={city.recovered} month={city.month} vault={vault} palette={palette} visible={layers.money} motion={motion} />
      <Camps camps={city.camps} palette={palette} visible={layers.camps} motion={motion} onPick={picks.onCamp} />
      <Tide radius={r} level={city.tide.level} open={city.tide.open} palette={palette} visible={layers.tide} motion={motion} />
      {!palette.dark && <ContactShadows position={[0, 0.02, 0]} scale={r * 2} blur={2.4} opacity={0.35} far={6} />}

      <CameraRig radius={r} inner={city.inner} focus={focus} motion={motion} />
      {palette.dark && !degraded && (
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.55} intensity={0.9} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
