import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// A tiny modelling kit: chunky low-poly primitives with vertex colours, merged
// into ONE geometry per site / machine part (one draw call each). Faces are
// flat-shaded for the toy look, and vertices near the ground are darkened a
// little (fake ambient occlusion) so things sit on the ground.

export interface At {
  x?: number
  y?: number
  z?: number
  rx?: number
  ry?: number
  rz?: number
}

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpV = new THREE.Vector3()
const tmpS = new THREE.Vector3()
const tmpC = new THREE.Color()
const nm = new THREE.Matrix3()
const UP = new THREE.Vector3(0, 1, 0)

const roundCache = new Map<string, THREE.BufferGeometry>()
function rounded(w: number, h: number, d: number, r: number) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`
  let g = roundCache.get(key)
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2, h / 2, d / 2) * 0.999)
    roundCache.set(key, g)
  }
  return g
}

const BOX = new THREE.BoxGeometry(1, 1, 1)
const IDENT = new THREE.Matrix4()

export class Kit {
  private pos: number[] = []
  private nor: number[] = []
  private col: number[] = []
  /** Ground-contact darkening (off for parts that float, e.g. crane jibs). */
  ao: boolean
  /** World y of this kit's local origin, so AO works for parts built off the ground. */
  baseY: number

  constructor(ao = true, baseY = 0) {
    this.ao = ao
    this.baseY = baseY
  }

  get triangles() {
    return this.pos.length / 9
  }

  /** Add any geometry with a transform and a flat colour. */
  add(geo: THREE.BufferGeometry, color: string, m: THREE.Matrix4, shade = 1): this {
    const g = geo.index ? geo.toNonIndexed() : geo
    const p = g.getAttribute('position')
    tmpC.set(color).multiplyScalar(shade)
    nm.getNormalMatrix(m)
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const n = new THREE.Vector3()
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i).applyMatrix4(m)
      b.fromBufferAttribute(p, i + 1).applyMatrix4(m)
      c.fromBufferAttribute(p, i + 2).applyMatrix4(m)
      // flat normal per face (low-poly look)
      n.subVectors(c, b).cross(tmpV.subVectors(a, b)).normalize()
      for (const v of [a, b, c]) {
        this.pos.push(v.x, v.y, v.z)
        this.nor.push(n.x, n.y, n.z)
        const k = this.ao ? 0.74 + 0.26 * Math.min(1, Math.max(0, (v.y + this.baseY) / 0.55)) : 1
        this.col.push(tmpC.r * k, tmpC.g * k, tmpC.b * k)
      }
    }
    if (g !== geo) g.dispose()
    return this
  }

  private place(at: At, sx: number, sy: number, sz: number, lift: number) {
    tmpE.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0)
    tmpQ.setFromEuler(tmpE)
    tmpV.set(at.x ?? 0, at.y ?? 0, at.z ?? 0)
    tmpS.set(sx, sy, sz)
    const m = new THREE.Matrix4().compose(tmpV, tmpQ, new THREE.Vector3(1, 1, 1))
    return m.multiply(tmpM.makeTranslation(0, lift, 0)).multiply(new THREE.Matrix4().makeScale(tmpS.x, tmpS.y, tmpS.z))
  }

  /** Box standing on `at.y` (rotations about its bottom centre). */
  box(w: number, h: number, d: number, color: string, at: At = {}, shade = 1): this {
    return this.add(BOX, color, this.place(at, w, h, d, h / 2), shade)
  }

  /** Rounded box standing on `at.y`. */
  rbox(w: number, h: number, d: number, r: number, color: string, at: At = {}, shade = 1): this {
    const m = this.place(at, 1, 1, 1, h / 2)
    return this.add(rounded(w, h, d, r), color, m, shade)
  }

  /** Cylinder (or frustum) standing on `at.y`. */
  cyl(rTop: number, rBot: number, h: number, color: string, at: At = {}, seg = 8, shade = 1): this {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1)
    this.add(g, color, this.place(at, 1, 1, 1, h / 2), shade)
    g.dispose()
    return this
  }

  cone(r: number, h: number, color: string, at: At = {}, seg = 8, shade = 1): this {
    const g = new THREE.ConeGeometry(r, h, seg, 1)
    this.add(g, color, this.place(at, 1, 1, 1, h / 2), shade)
    g.dispose()
    return this
  }

  /** Cylinder centred at `c` along an axis (wheels, drums, pipes, tanks). `rEnd` = radius at the +axis end. */
  tube(r: number, len: number, color: string, c: [number, number, number], axis: 'x' | 'y' | 'z' = 'y', seg = 8, rEnd = r, shade = 1): this {
    const g = new THREE.CylinderGeometry(rEnd, r, len, seg, 1)
    if (axis === 'x') g.rotateZ(-Math.PI / 2)
    if (axis === 'z') g.rotateX(Math.PI / 2)
    g.translate(c[0], c[1], c[2])
    this.add(g, color, IDENT, shade)
    g.dispose()
    return this
  }

  /** Low-poly sphere centred at `at` (scaled per axis). */
  ball(r: number, color: string, at: At = {}, scale: [number, number, number] = [1, 1, 1], detail = 0, shade = 1): this {
    const g = new THREE.IcosahedronGeometry(r, detail)
    const m = this.place(at, scale[0], scale[1], scale[2], 0)
    this.add(g, color, m, shade)
    g.dispose()
    return this
  }

  /** Half sphere (dome) sitting on `at.y`. */
  dome(r: number, color: string, at: At = {}, seg = 8, sy = 1): this {
    const g = new THREE.SphereGeometry(r, seg, 3, 0, Math.PI * 2, 0, Math.PI / 2)
    this.add(g, color, this.place(at, 1, sy, 1, 0))
    g.dispose()
    return this
  }

  /** Flat horizontal patch (road markings, ground stains, painted shadows). */
  patch(x0: number, z0: number, x1: number, z1: number, y: number, color: string, shade = 1): this {
    const m = new THREE.Matrix4().makeTranslation((x0 + x1) / 2, y, (z0 + z1) / 2).multiply(new THREE.Matrix4().makeScale(Math.abs(x1 - x0), 1, Math.abs(z1 - z0)))
    return this.add(FLAT, color, m, shade)
  }

  /** A box beam from A to B (girders, booms, lattice members). */
  beam(a: [number, number, number], b: [number, number, number], w: number, h: number, color: string, shade = 1): this {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const len = va.distanceTo(vb)
    if (len < 1e-5) return this
    const dir = vb.clone().sub(va).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir)
    const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(w, len, h))
    return this.add(BOX, color, m, shade)
  }

  /** A round rod from A to B (pipes, cables, poles). */
  rod(a: [number, number, number], b: [number, number, number], r: number, color: string, seg = 6, shade = 1): this {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const len = va.distanceTo(vb)
    if (len < 1e-5) return this
    const q = new THREE.Quaternion().setFromUnitVectors(UP, vb.clone().sub(va).normalize())
    const g = new THREE.CylinderGeometry(r, r, 1, seg, 1)
    this.add(g, color, new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1)), shade)
    g.dispose()
    return this
  }

  /** A ramp: full height at -x, zero at +x (slopes, spoil heaps, embankments). */
  wedge(w: number, h: number, d: number, color: string, at: At = {}, shade = 1): this {
    return this.add(WEDGE, color, this.place(at, w, h, d, 0), shade)
  }

  /** Another kit's geometry, transformed (prefabs). */
  merge(other: Kit, at: At = {}): this {
    const g = other.geometry()
    const m = this.place(at, 1, 1, 1, 0)
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const c = g.getAttribute('color')
    const v = new THREE.Vector3()
    const nn = new THREE.Vector3()
    nm.getNormalMatrix(m)
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m)
      nn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize()
      this.pos.push(v.x, v.y, v.z)
      this.nor.push(nn.x, nn.y, nn.z)
      this.col.push(c.getX(i), c.getY(i), c.getZ(i))
    }
    g.dispose()
    return this
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

// y-up unit quad (2 triangles), facing up
const FLAT = (() => {
  const g = new THREE.PlaneGeometry(1, 1)
  g.rotateX(-Math.PI / 2)
  return g
})()

// unit wedge: a box whose top +x edge is pulled down to the floor
const WEDGE = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed()
  g.translate(0, 0.5, 0)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5 && p.getX(i) > 0) p.setY(i, 0)
  return g
})()

/** Deterministic pseudo-random numbers for one site (same look on every device). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}
