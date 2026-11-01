import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { machineType, shuttle, type MachineKind, type MachineSpec, type Motion, type PartPose } from './kit/machines'
import type { SiteRig } from './rig'
import type { Built } from './scopes'

const STILL: Motion = { u: 0, seg: 3, k: 0 }
const Y = new THREE.Vector3(0, 1, 0)
const GROUND = 0.07

interface Group {
  kind: MachineKind
  items: { site: number; spec: MachineSpec }[]
  meshes: THREE.InstancedMesh[]
  joints: THREE.Matrix4[]
  parts: THREE.Matrix4[]
  poses: PartPose[]
}

const blankPose = (): PartPose => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 })

/**
 * Every machine on every site: one instanced mesh per machine part (shared by
 * all machines of that kind) and one per-frame pass that drives, digs, lifts
 * and swings them. Reduced motion freezes them in a working pose.
 */
export default function Fleet({ rig, builds, motion, material, blobs, shadows }: { rig: SiteRig; builds: Built[]; motion: boolean; material: THREE.Material; blobs: boolean; shadows: boolean }) {
  const { groups, blob, blobCount } = useMemo(() => {
    const byKind = new Map<MachineKind, { site: number; spec: MachineSpec }[]>()
    builds.forEach((b, site) => {
      for (const spec of b.machines) {
        const list = byKind.get(spec.kind) ?? []
        list.push({ site, spec })
        byKind.set(spec.kind, list)
      }
    })
    const groups: Group[] = []
    let blobCount = 0
    for (const [kind, items] of byKind) {
      const type = machineType(kind)
      const meshes = type.parts.map((p) => {
        const m = new THREE.InstancedMesh(p.geo, material, items.length)
        m.frustumCulled = false
        m.castShadow = shadows
        m.receiveShadow = shadows
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        return m
      })
      const joints = type.parts.map((p) => {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.tilt ?? [0, 0, 0])))
        return new THREE.Matrix4().compose(new THREE.Vector3(...p.pivot), q, new THREE.Vector3(1, 1, 1))
      })
      groups.push({ kind, items, meshes, joints, parts: type.parts.map(() => new THREE.Matrix4()), poses: type.parts.map(blankPose) })
      if (!type.floats) blobCount += items.length
    }
    const blobGeo = new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2)
    const blob = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.2, depthWrite: false }), Math.max(1, blobCount))
    blob.frustumCulled = false
    blob.renderOrder = 1
    return { groups, blob, blobCount }
  }, [builds, material, shadows])

  useEffect(
    () => () => {
      for (const g of groups) for (const m of g.meshes) m.dispose()
      blob.geometry.dispose()
      ;(blob.material as THREE.Material).dispose()
      blob.dispose()
    },
    [groups, blob],
  )

  const tmp = useMemo(
    () => ({ base: new THREE.Matrix4(), local: new THREE.Matrix4(), pose: new THREE.Matrix4(), sh: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3() }),
    [],
  )

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    rig.update(t, dt)
    const tt = motion ? t : 2.2
    let b = 0
    for (const g of groups) {
      const type = machineType(g.kind)
      g.items.forEach((item, j) => {
        const s = item.spec
        let x = s.x
        let z = s.z
        let yaw = s.yaw
        let mv = STILL
        if (s.path) {
          mv = shuttle(tt, s.path.period, s.path.pause ?? 0.15, s.phase ?? 0)
          x += (s.path.bx - s.x) * mv.u
          z += (s.path.bz - s.z) * mv.u
        } else if (s.loop) {
          const a = Math.PI * 2 * (tt / s.loop.period + (s.phase ?? 0))
          x += Math.cos(a) * s.loop.r
          z += Math.sin(a) * s.loop.r
          yaw = Math.atan2(-Math.cos(a), -Math.sin(a))
        }
        const size = s.size ?? 1
        tmp.local.compose(tmp.p.set(x, s.y ?? GROUND, z), tmp.q.setFromAxisAngle(Y, yaw), tmp.s.set(size, size, size))
        tmp.base.multiplyMatrices(rig.matrices[item.site], tmp.local)
        for (const p of g.poses) Object.assign(p, BLANK)
        type.pose(tt, s, mv, g.poses)
        type.parts.forEach((part, pi) => {
          const o = g.poses[pi]
          tmp.pose.compose(tmp.p.set(o.x, o.y, o.z), tmp.q.setFromEuler(tmp.e.set(o.rx, o.ry, o.rz)), tmp.s.set(o.sx, o.sy, o.sz))
          g.parts[pi].multiplyMatrices(part.parent < 0 ? tmp.base : g.parts[part.parent], g.joints[pi]).multiply(tmp.pose)
          g.meshes[pi].setMatrixAt(j, g.parts[pi])
        })
        if (blobs && !type.floats && type.shadow) {
          tmp.sh.compose(tmp.p.set(0, 0.012, 0), tmp.q.identity(), tmp.s.set(type.shadow[0], 1, type.shadow[1]))
          blob.setMatrixAt(b++, tmp.sh.premultiply(tmp.base))
        }
      })
      for (const m of g.meshes) m.instanceMatrix.needsUpdate = true
    }
    blob.count = blobs ? Math.min(b, blobCount) : 0
    blob.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {groups.flatMap((g) => g.meshes.map((m, i) => <primitive key={`${g.kind}-${i}`} object={m} />))}
      {blobs && <primitive object={blob} />}
    </group>
  )
}

const BLANK = blankPose()
