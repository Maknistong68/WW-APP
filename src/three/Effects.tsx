import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SiteRig } from './rig'
import type { Built, FxSpec } from './scopes'

// Dust from digging, steam from fresh asphalt and the plant, slurry spray from
// the dredger, welding sparks on the pipeline; and at night, pools of light
// under the floodlights (no real lights, so it stays cheap).

const PUFFS = 5
const SPARKS = 7
const COLOR: Record<FxSpec['kind'], string> = { dust: '#d9b98a', steam: '#ffffff', spray: '#d8c39a', spark: '#fff2a8' }
const RISE: Record<FxSpec['kind'], number> = { dust: 0.9, steam: 1.6, spray: 1.4, spark: 0 }

export default function Effects({ rig, builds, motion, puffs, night }: { rig: SiteRig; builds: Built[]; motion: boolean; puffs: boolean; night: boolean }) {
  const res = useMemo(() => {
    const smoke: { site: number; fx: FxSpec }[] = []
    const sparks: { site: number; fx: FxSpec }[] = []
    const lights: { site: number; p: [number, number, number] }[] = []
    builds.forEach((b, site) => {
      for (const fx of b.fx) (fx.kind === 'spark' ? sparks : smoke).push({ site, fx })
      for (const p of b.lights) lights.push({ site, p })
    })
    const puffMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), Math.max(1, smoke.length * PUFFS))
    puffMesh.frustumCulled = false
    puffMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, smoke.length * PUFFS) * 3), 3)
    const c = new THREE.Color()
    smoke.forEach((s, i) => {
      for (let k = 0; k < PUFFS; k++) puffMesh.setColorAt(i * PUFFS + k, c.set(COLOR[s.fx.kind]))
    })
    const sparkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: COLOR.spark, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), Math.max(1, sparks.length * SPARKS))
    sparkMesh.frustumCulled = false
    const poolMesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      Math.max(1, lights.length),
    )
    poolMesh.frustumCulled = false
    poolMesh.renderOrder = 3
    const coneMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 14, 1, true).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color: '#ffe7a6', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      Math.max(1, lights.length),
    )
    coneMesh.frustumCulled = false
    coneMesh.renderOrder = 4
    return { smoke, sparks, lights, puffMesh, sparkMesh, poolMesh, coneMesh }
  }, [builds])

  useEffect(
    () => () => {
      for (const m of [res.puffMesh, res.sparkMesh, res.poolMesh, res.coneMesh]) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
        m.dispose()
      }
    },
    [res],
  )

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), [])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    rig.update(t, dt)
    if (puffs && motion) {
      res.smoke.forEach(({ site, fx }, i) => {
        const size = fx.size ?? 1
        for (let k = 0; k < PUFFS; k++) {
          const age = (t * (fx.kind === 'steam' ? 0.35 : 0.5) + k / PUFFS + i * 0.13) % 1
          const sway = Math.sin((t + k) * 1.3) * 0.15 * age
          tmp.v.set(fx.x + sway + age * 0.25, fx.y + age * RISE[fx.kind] * size, fx.z + sway * 0.6).applyMatrix4(rig.matrices[site])
          const r = (0.12 + age * 0.32) * size * Math.sin(Math.PI * Math.min(1, age * 1.15))
          tmp.m.compose(tmp.v, tmp.q.identity(), tmp.s.setScalar(Math.max(0.0001, r) * rig.scale(site)))
          res.puffMesh.setMatrixAt(i * PUFFS + k, tmp.m)
        }
      })
      res.puffMesh.count = res.smoke.length * PUFFS
      res.sparks.forEach(({ site, fx }, i) => {
        const burst = Math.sin(t * 2.1 + i) > -0.2
        for (let k = 0; k < SPARKS; k++) {
          const a = (t * 3 + k * 0.37) % 1
          const ang = k * 2.4 + Math.floor(t * 12) * 0.7
          tmp.v.set(fx.x + Math.cos(ang) * a * 0.35, fx.y + a * 0.25 - a * a * 0.4, fx.z + Math.sin(ang) * a * 0.35).applyMatrix4(rig.matrices[site])
          tmp.m.compose(tmp.v, tmp.q.identity(), tmp.s.setScalar(burst ? (1 - a) * 1.2 : 0.0001))
          res.sparkMesh.setMatrixAt(i * SPARKS + k, tmp.m)
        }
      })
      res.sparkMesh.count = res.sparks.length * SPARKS
      res.puffMesh.instanceMatrix.needsUpdate = true
      res.sparkMesh.instanceMatrix.needsUpdate = true
    } else {
      res.puffMesh.count = 0
      res.sparkMesh.count = 0
    }
    if (night) {
      res.lights.forEach(({ site, p }, i) => {
        tmp.v.set(p[0], 0.1, p[2]).applyMatrix4(rig.matrices[site])
        const sc = rig.scale(site)
        tmp.m.compose(tmp.v, tmp.q.identity(), tmp.s.set(1.6 * sc, 1, 1.6 * sc))
        res.poolMesh.setMatrixAt(i, tmp.m)
        tmp.v.set(p[0], p[1], p[2]).applyMatrix4(rig.matrices[site])
        tmp.m.compose(tmp.v, tmp.q.identity(), tmp.s.set(1.5 * sc, p[1] * sc, 1.5 * sc))
        res.coneMesh.setMatrixAt(i, tmp.m)
      })
      res.poolMesh.count = res.lights.length
      res.coneMesh.count = res.lights.length
      res.poolMesh.instanceMatrix.needsUpdate = true
      res.coneMesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {puffs && <primitive object={res.puffMesh} />}
      {puffs && <primitive object={res.sparkMesh} />}
      {night && <primitive object={res.poolMesh} />}
      {night && <primitive object={res.coneMesh} />}
    </group>
  )
}
