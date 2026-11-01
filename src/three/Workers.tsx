import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Kit, rng } from './kit/build'
import { C } from './kit/colors'
import { shuttle } from './kit/machines'
import { SITES } from '../lib/site'
import { QUAY } from '../lib/world'
import type { SiteRig } from './rig'
import type { Built, WorkerSpec } from './scopes'

// Generic site workers (vest + helmet; no faces, no names). They walk their
// beat or work on the spot. Each site shows as many figures as its manpower
// count asks for (one figure = a round number of people, set by the page);
// a site with no count yet shows its small default crew.

let figure: THREE.BufferGeometry | null = null
function workerGeometry() {
  if (figure) return figure
  const k = new Kit()
  k.box(0.07, 0.17, 0.06, C.navy, { x: 0, z: -0.04 }).box(0.07, 0.17, 0.06, C.navy, { x: 0, z: 0.04 })
  k.rbox(0.11, 0.18, 0.17, 0.03, C.orange, { y: 0.17 })
  k.box(0.115, 0.03, 0.175, C.white, { y: 0.25 })
  k.box(0.05, 0.15, 0.05, C.orange, { y: 0.19, z: -0.11 }).box(0.05, 0.15, 0.05, C.orange, { y: 0.19, z: 0.11 })
  k.ball(0.055, C.skin, { y: 0.41 }, [1, 1, 1], 0)
  k.dome(0.068, C.white, { y: 0.42 }, 8, 0.85)
  k.box(0.02, 0.012, 0.15, C.white, { x: 0.06, y: 0.425 })
  figure = k.geometry()
  figure.scale(1.25, 1.25, 1.25)
  return figure
}

const GROUND = 0.07

/** `n` workers for one site: its own crew first, then copies of the ground crew nearby, then people spread over the site. */
export function crewOf(site: number, b: Built, n: number | null, lite: boolean): WorkerSpec[] {
  const base = b.workers
  if (n === null) return base.filter((_, i) => !lite || i % 2 === 0)
  const def = SITES[site]
  const x1 = def.w / 2 - 0.45
  const z0 = -def.d / 2 + 0.45
  // coast sites: only the part on the quay
  const z1 = def.terrain === 'coast' ? QUAY - (def.home.gz + def.d / 2) - 0.45 : def.d / 2 - 0.45
  const cx = (x: number) => Math.max(-x1, Math.min(x1, x))
  const cz = (z: number) => Math.max(z0, Math.min(z1, z))
  const ground = base.filter((w) => w.y === undefined && w.z <= z1 && (w.bz ?? w.z) <= z1)
  const r = rng(site * 97 + 13)
  const out: WorkerSpec[] = []
  for (let k = 0; k < n; k++) {
    if (k < base.length) {
      out.push(base[k])
      continue
    }
    if (ground.length && k < base.length + ground.length * 3) {
      const w = ground[k % ground.length]
      const a = k * 2.399
      const rad = 0.35 + 0.22 * Math.floor((k - base.length) / ground.length)
      const dx = Math.cos(a) * rad
      const dz = Math.sin(a) * rad
      out.push({ ...w, x: cx(w.x + dx), z: cz(w.z + dz), bx: w.bx === undefined ? undefined : cx(w.bx + dx), bz: w.bz === undefined ? undefined : cz(w.bz + dz), phase: (k * 0.37) % 1 })
      continue
    }
    const x = cx(-x1 + r() * 2 * x1)
    const z = cz(z0 + r() * (z1 - z0))
    out.push(r() < 0.45 ? { x, z } : { x, z, bx: cx(x + (r() - 0.5) * 3), bz: cz(z + (r() - 0.5) * 3), period: 7 + r() * 6, phase: r() })
  }
  return out
}

export default function Workers({
  rig,
  builds,
  crews,
  motion,
  material,
  lite,
  blobs,
  shadows,
}: {
  rig: SiteRig
  builds: Built[]
  /** Figures per site (null = no manpower count: the default crew). */
  crews: (number | null)[]
  motion: boolean
  material: THREE.Material
  lite: boolean
  blobs: boolean
  shadows: boolean
}) {
  const crewKey = crews.join(',')
  const { mesh, blob, list } = useMemo(() => {
    const list: { site: number; w: WorkerSpec; seed: number }[] = []
    builds.forEach((b, site) => crewOf(site, b, crews[site] ?? null, lite).forEach((w, i) => list.push({ site, w, seed: site * 7 + i })))
    const mesh = new THREE.InstancedMesh(workerGeometry(), material, Math.max(1, list.length))
    mesh.frustumCulled = false
    mesh.castShadow = shadows
    const blob = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.16, 10).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false }),
      Math.max(1, list.length),
    )
    blob.frustumCulled = false
    blob.renderOrder = 1
    return { mesh, blob, list }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builds, material, lite, shadows, crewKey])

  useEffect(
    () => () => {
      mesh.dispose()
      blob.geometry.dispose()
      ;(blob.material as THREE.Material).dispose()
      blob.dispose()
    },
    [mesh, blob],
  )

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), sh: new THREE.Matrix4() }), [])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    rig.update(t, dt)
    const tt = motion ? t : 1.0
    list.forEach(({ site, w, seed }, i) => {
      let x = w.x
      let z = w.z
      let yaw = (seed * 2.4) % (Math.PI * 2)
      let bob = 0
      let bend = 0
      if (w.bx !== undefined && w.bz !== undefined) {
        const mv = shuttle(tt, w.period ?? 8, 0.12, w.phase ?? (seed % 10) / 10)
        x += (w.bx - w.x) * mv.u
        z += (w.bz - w.z) * mv.u
        const out = mv.seg === 0 || mv.seg === 1
        yaw = Math.atan2(-(w.bz - w.z) * (out ? 1 : -1), (w.bx - w.x) * (out ? 1 : -1))
        if ((mv.seg === 0 || mv.seg === 2) && motion) bob = Math.abs(Math.sin(tt * 9 + seed)) * 0.04
      } else if (motion) {
        bend = 0.35 * Math.max(0, Math.sin(tt * 3.2 + seed))
      }
      tmp.m.compose(tmp.p.set(x, (w.y ?? GROUND) + bob, z), tmp.q.setFromEuler(tmp.e.set(0, yaw, -bend, 'YXZ')), tmp.s)
      tmp.m.premultiply(rig.matrices[site])
      mesh.setMatrixAt(i, tmp.m)
      if (blobs) {
        tmp.sh.makeTranslation(x, (w.y ?? GROUND) + 0.012, z).premultiply(rig.matrices[site])
        blob.setMatrixAt(i, tmp.sh)
      }
    })
    mesh.count = list.length
    mesh.instanceMatrix.needsUpdate = true
    blob.count = blobs ? list.length : 0
    blob.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <primitive object={mesh} />
      {blobs && <primitive object={blob} />}
    </group>
  )
}
