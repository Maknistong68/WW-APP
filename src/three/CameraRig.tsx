import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { GRID, WORLD } from '../lib/site'

export interface Focus {
  x: number
  z: number
  /** Camera distance from the point. */
  dist: number
  /** Bump to fly again to the same place. */
  v: number
}

const HOME_AZ = 0.28
const EDIT_POLAR = 0.42
/** Landscape: a classic three-quarter view; portrait phones look more from above so the site fills the screen. */
const homePolar = (aspect: number) => (aspect < 0.8 ? 0.56 : 0.74)

/** Where the home view looks: the octagon's land half with the edge of the floating city in front. */
const HOME_Z = -13

/** Distance that fits the land half on screen (phones crop the sides; one finger pans). */
function fitDistance(fov: number, aspect: number) {
  const tv = Math.tan((fov * Math.PI) / 360)
  const th = tv * aspect
  const w = (GRID + 2) / th
  const h = (25 * Math.cos(homePolar(aspect)) + 4) / tv
  return Math.max(aspect < 0.8 ? w * 0.62 : w, h) * 1.02
}

/**
 * Base-builder camera: a high three-quarter view with the sea in front. One
 * finger pans, two fingers zoom / turn (mouse: left pans, right turns). Taps
 * and the tour fly smoothly; edit mode looks more from above. Gentle sway when
 * idle. Reduced motion jumps instead of flying.
 */
export default function CameraRig({ focus, motion, editing }: { focus: Focus | null; motion: boolean; editing: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null!)
  const { camera, clock, size, scene } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  const fov = aspect < 0.8 ? 40 : 30
  const dist = useMemo(() => fitDistance(fov, aspect), [fov, aspect])
  const HOME_POLAR = homePolar(aspect)
  const goal = useRef<{ target: THREE.Vector3; pos: THREE.Vector3 } | null>(null)
  const lastTouch = useRef(-100)
  const tmp = useMemo(() => ({ dir: new THREE.Vector3(), sph: new THREE.Spherical(), d: new THREE.Vector3() }), [])

  const home = (polar = HOME_POLAR) => {
    const target = new THREE.Vector3(0, 0.5, aspect < 0.8 ? HOME_Z + 2 : HOME_Z)
    const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(dist, polar, HOME_AZ)).add(target)
    return { target, pos }
  }

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov
      camera.near = 0.5
      camera.far = dist * 8
      camera.updateProjectionMatrix()
    }

    const h = home()
    camera.position.copy(h.pos)
    camera.lookAt(h.target)
    if (controls.current) controls.current.target.copy(h.target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fov, dist])

  useEffect(() => {
    if (!focus) {
      goal.current = home(editing ? EDIT_POLAR : HOME_POLAR)
      return
    }
    const c = controls.current
    const target = new THREE.Vector3(focus.x, 0.5, focus.z)
    const dir = c ? camera.position.clone().sub(c.target).normalize() : new THREE.Vector3(0, 0.7, 0.7)
    goal.current = { target, pos: target.clone().addScaledVector(dir, focus.dist) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.x, focus?.z, focus?.dist, focus?.v])

  // Edit mode: look more from above (same spot, same zoom).
  useEffect(() => {
    const c = controls.current
    if (!c) return
    // keep any fly-to already under way (e.g. back to the whole site), just change the angle
    const base = goal.current ?? { target: c.target.clone(), pos: camera.position.clone() }
    tmp.sph.setFromVector3(tmp.d.copy(base.pos).sub(base.target))
    tmp.sph.phi = editing ? EDIT_POLAR : HOME_POLAR
    goal.current = { target: base.target.clone(), pos: new THREE.Vector3().setFromSpherical(tmp.sph).add(base.target) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  useFrame((state, dt) => {
    const c = controls.current
    if (!c) return
    const g = goal.current
    if (g) {
      const k = motion ? 1 - Math.exp(-Math.min(dt, 0.1) * 3.2) : 1
      c.target.lerp(g.target, k)
      camera.position.lerp(g.pos, k)
      if (camera.position.distanceTo(g.pos) < 0.05 && c.target.distanceTo(g.target) < 0.05) goal.current = null
    }
    // haze starts past the site and swallows the far desert (the fog is re-made on theme changes)
    if (scene.fog instanceof THREE.Fog && scene.fog.near !== dist * 1.25) {
      scene.fog.near = dist * 1.25
      scene.fog.far = dist * 3.4
    }
    const idle = state.clock.elapsedTime - lastTouch.current > 8
    c.autoRotate = motion && !g && !editing && idle
    c.autoRotateSpeed = 0.35 * Math.sin(state.clock.elapsedTime * 0.12)
    c.update()
    // keep the view over the buildable land (the octagon and the land around it)
    const cx = Math.max(-WORLD, Math.min(WORLD, c.target.x))
    const cz = Math.max(-WORLD, Math.min(GRID, c.target.z))
    if (cx !== c.target.x || cz !== c.target.z || c.target.y !== 0.5) {
      tmp.dir.set(cx - c.target.x, 0.5 - c.target.y, cz - c.target.z)
      c.target.add(tmp.dir)
      camera.position.add(tmp.dir)
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      screenSpacePanning={false}
      minDistance={8}
      maxDistance={dist * 1.9}
      minPolarAngle={0.3}
      maxPolarAngle={1.12}
      minAzimuthAngle={HOME_AZ - 1.25}
      maxAzimuthAngle={HOME_AZ + 1.25}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
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
