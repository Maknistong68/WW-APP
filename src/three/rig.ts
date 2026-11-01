import * as THREE from 'three'
import { SITES, toWorld, type Layout } from '../lib/site'
import { springStep, type Spring } from './kit/spring'

const Y = new THREE.Vector3(0, 1, 0)
const tmpP = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3()

/**
 * Where every site is drawn this frame: it glides to its place in the layout,
 * pops in with a bounce when the view opens, lifts and bobs while being moved
 * in edit mode and squashes when dropped. Everything that sits on a site
 * (machines, workers, bars, effects) reads `matrices`.
 */
export class SiteRig {
  readonly matrices = SITES.map(() => new THREE.Matrix4())
  layout: Layout
  motion: boolean
  editing = false
  /** Index of the site being moved (edit mode). */
  selected = -1
  private x = SITES.map(() => 0)
  private z = SITES.map(() => 0)
  private ry = SITES.map(() => 0)
  private lift = SITES.map(() => 0)
  private pop: Spring[] = SITES.map(() => ({ x: 0, v: 0 }))
  private sq: Spring[] = SITES.map(() => ({ x: 0, v: 0 }))
  private start: number[] = SITES.map(() => 0)
  private last = -1
  private t0 = -1

  constructor(layout: Layout, motion: boolean) {
    this.layout = layout
    this.motion = motion
    SITES.forEach((def, i) => {
      const w = toWorld(def, layout[def.id])
      this.x[i] = w.x
      this.z[i] = w.z
      this.ry[i] = w.ry
      if (!motion) this.pop[i].x = 1
    })
  }

  /** Squash-and-stretch when a site is dropped. */
  drop(i: number) {
    if (this.motion) this.sq[i].v = -4
  }

  /** Current pop-in scale (0 → 1). */
  scale(i: number) {
    return this.pop[i].x
  }

  /** Once per frame (extra calls in the same frame are ignored). */
  update(t: number, dt: number) {
    if (t === this.last) return
    this.last = t
    if (this.t0 < 0) {
      this.t0 = t
      SITES.forEach((def, i) => {
        const w = toWorld(def, this.layout[def.id])
        this.start[i] = t + 0.1 + Math.hypot(w.x, w.z) * 0.03
      })
    }
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 14)
    const kl = 1 - Math.exp(-Math.min(dt, 0.1) * 10)
    SITES.forEach((def, i) => {
      const place = this.layout[def.id]
      const w = toWorld(def, place)
      const liftTo = this.editing && i === this.selected ? 0.7 + 0.08 * Math.sin(t * 4) : 0
      if (!this.motion) {
        this.x[i] = w.x
        this.z[i] = w.z
        this.ry[i] = w.ry
        this.lift[i] = this.editing && i === this.selected ? 0.6 : 0
      } else {
        this.x[i] += (w.x - this.x[i]) * k
        this.z[i] += (w.z - this.z[i]) * k
        let d = w.ry - this.ry[i]
        d = Math.atan2(Math.sin(d), Math.cos(d))
        this.ry[i] += d * k
        this.lift[i] += (liftTo - this.lift[i]) * kl
        if (t >= this.start[i]) springStep(this.pop[i], 1, dt, 150, 10)
        springStep(this.sq[i], 0, dt, 260, 9)
      }
      const s = this.pop[i].x
      const q = this.sq[i].x
      tmpP.set(this.x[i], this.lift[i], this.z[i])
      tmpQ.setFromAxisAngle(Y, this.ry[i])
      tmpS.set(Math.max(1e-4, s * (1 - q * 0.5)), Math.max(1e-4, s * (1 + q)), Math.max(1e-4, s * (1 - q * 0.5)))
      this.matrices[i].compose(tmpP, tmpQ, tmpS)
    })
  }
}
