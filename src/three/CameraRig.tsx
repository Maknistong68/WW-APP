import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export interface Focus {
  x: number
  z: number
  /** Camera distance from the point. */
  dist: number
  /** Bump to fly again to the same place. */
  v: number
}

/**
 * Orbit / pinch / pan with limits, a slow idle spin, and smooth fly-to for
 * taps and the tour. Reduced motion → jumps instead of flying.
 */
export default function CameraRig({ radius, inner, focus, motion }: { radius: number; inner: number; focus: Focus | null; motion: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null!)
  const { camera, clock, size } = useThree()
  const portrait = size.width / Math.max(1, size.height) < 0.8
  const goal = useRef<{ target: THREE.Vector3; pos: THREE.Vector3 } | null>(null)
  const lastTouch = useRef(-100)
  // Frame the built-up area: higher and closer on phones (the grid is taller than wide there).
  const home = () => ({
    target: new THREE.Vector3(0, 1, portrait ? inner * 0.12 : 0),
    pos: portrait ? new THREE.Vector3(inner * 0.55, inner * 1.75, inner * 1.55) : new THREE.Vector3(inner * 1.15, inner * 1.05, inner * 1.45),
  })

  useEffect(() => {
    const h = home()
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = portrait ? 52 : 42
      camera.updateProjectionMatrix()
    }
    camera.position.copy(h.pos)
    camera.lookAt(h.target)
    if (controls.current) controls.current.target.copy(h.target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inner, portrait])

  useEffect(() => {
    if (!focus) {
      goal.current = home()
      return
    }
    const target = new THREE.Vector3(focus.x, 1.5, focus.z)
    const dir = new THREE.Vector3(focus.x, 0, focus.z).normalize()
    if (dir.lengthSq() < 0.01) dir.set(0.6, 0, 0.8)
    const pos = target.clone().add(new THREE.Vector3(dir.x * focus.dist * 0.75, focus.dist * 0.7, dir.z * focus.dist * 0.75 + focus.dist * 0.35))
    goal.current = { target, pos }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.x, focus?.z, focus?.dist, focus?.v])

  useFrame((state, dt) => {
    const c = controls.current
    if (!c) return
    const g = goal.current
    if (g) {
      const k = motion ? 1 - Math.exp(-Math.min(dt, 0.1) * 3) : 1
      c.target.lerp(g.target, k)
      camera.position.lerp(g.pos, k)
      if (camera.position.distanceTo(g.pos) < 0.05 && c.target.distanceTo(g.target) < 0.05) goal.current = null
    }
    c.autoRotate = motion && !g && state.clock.elapsedTime - lastTouch.current > 8
    c.update()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      autoRotateSpeed={0.35}
      minDistance={4}
      maxDistance={radius * 3.2}
      maxPolarAngle={Math.PI * 0.46}
      minPolarAngle={0.15}
      onStart={() => {
        lastTouch.current = Number.POSITIVE_INFINITY
        goal.current = null
      }}
      onEnd={() => {
        lastTouch.current = clock.elapsedTime
      }}
    />
  )
}
