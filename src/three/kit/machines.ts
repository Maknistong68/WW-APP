import * as THREE from 'three'
import { Kit } from './build'
import { C } from './colors'

// Construction machines as data: rigid parts with pivots, plus a pose function
// that moves the joints over time. Each part is ONE geometry shared by every
// machine of that kind (instanced), so a whole fleet costs a few draw calls.
// Local frame: forward = +x, up = +y, origin on the ground at the machine's centre.

export type MachineKind =
  | 'excavator'
  | 'dozer'
  | 'dumper'
  | 'roller'
  | 'paver'
  | 'grader'
  | 'mixer'
  | 'tanker'
  | 'flatbed'
  | 'towerCrane'
  | 'crawlerCrane'
  | 'crawlerCraneBox'
  | 'pipelayer'
  | 'sts'
  | 'dredger'
  | 'tug'
  | 'ship'
  | 'boat'
  | 'hoist'

export interface MachineSpec {
  kind: MachineKind
  x: number
  z: number
  yaw: number
  /** Ground height of the base (decks, water). */
  y?: number
  size?: number
  /** Shuttle to (bx, bz) and back (reversing, like real site machines). */
  path?: { bx: number; bz: number; period: number; pause?: number }
  /** Circle of radius r around (x, z). */
  loop?: { r: number; period: number }
  /** 0–1 offset so machines don't move in sync. */
  phase?: number
  /** Kind-specific numbers (crane angles, drops…). */
  p?: number[]
}

/** Where a shuttling machine is: seg 0 = going out, 1 = stopped at the far end, 2 = coming back, 3 = stopped at home. */
export interface Motion {
  u: number
  seg: 0 | 1 | 2 | 3
  k: number
}

export interface PartPose {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  sx: number
  sy: number
  sz: number
}

export interface PartDef {
  geo: THREE.BufferGeometry
  parent: number
  /** Joint position in the parent's frame. */
  pivot: [number, number, number]
  /** Fixed joint orientation, applied before the pose rotation. */
  tilt?: [number, number, number]
}

export interface MachineType {
  parts: PartDef[]
  pose: (t: number, s: MachineSpec, mv: Motion, out: PartPose[]) => void
  /** Blob shadow size (along x, along z); none for boats. */
  shadow?: [number, number]
  floats?: boolean
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const smooth = (x: number) => x * x * (3 - 2 * x)
/** Piecewise smooth keyframes: c in 0–1, pts sorted by time. */
export function kf(c: number, pts: [number, number][]): number {
  if (c <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i]
    if (c <= t1) {
      const [t0, v0] = pts[i - 1]
      return v0 + (v1 - v0) * smooth((c - t0) / Math.max(1e-6, t1 - t0))
    }
  }
  return pts[pts.length - 1][1]
}
const frac = (x: number) => x - Math.floor(x)
const cyc = (t: number, period: number, s: MachineSpec) => frac(t / period + (s.phase ?? 0))

/** Shuttle progress: out, wait, back, wait. */
export function shuttle(t: number, period: number, pause: number, phase: number): Motion {
  const c = frac(t / period + phase)
  const move = (1 - 2 * pause) / 2
  if (c < move) return { u: smooth(c / move), seg: 0, k: c / move }
  if (c < move + pause) return { u: 1, seg: 1, k: (c - move) / pause }
  if (c < 2 * move + pause) return { u: 1 - smooth((c - move - pause) / move), seg: 2, k: (c - move - pause) / move }
  return { u: 0, seg: 3, k: (c - 2 * move - pause) / pause }
}

const geo = (k: Kit) => k.geometry()
const wheels = (k: Kit, xs: number[], r: number, track: number, w = 0.11) => {
  for (const x of xs) for (const z of [-track, track]) k.tube(r, w, C.tyre, [x, r, z], 'z', 8).tube(r * 0.5, w + 0.01, C.steelLight, [x, r, z], 'z', 6)
}
const glassFront = (k: Kit, x: number, y: number, h: number, d: number) => k.box(0.02, h, d, C.glassDark, { x, y })

// ---------------------------------------------------------------------------
// machines
// ---------------------------------------------------------------------------

function excavator(): MachineType {
  const base = new Kit()
  for (const z of [-0.31, 0.31]) base.rbox(1.16, 0.22, 0.24, 0.06, C.tyre, { z }).box(0.9, 0.04, 0.2, C.steelDark, { y: 0.22, z })
  base.box(0.5, 0.12, 0.44, C.steelDark, { y: 0.12 })
  const house = new Kit(true, 0.26)
  house.rbox(0.82, 0.3, 0.62, 0.06, C.yellow, { x: -0.06 })
  house.rbox(0.24, 0.3, 0.62, 0.08, C.yellowDark, { x: -0.44 })
  house.rbox(0.34, 0.4, 0.3, 0.05, C.yellow, { x: 0.12, y: 0.28, z: 0.15 })
  glassFront(house, 0.3, 0.36, 0.26, 0.24)
  house.box(0.3, 0.02, 0.27, C.glass, { x: 0.12, y: 0.68, z: 0.15 })
  house.tube(0.025, 0.2, C.black, [-0.3, 0.38, -0.2], 'y', 6)
  const boom = new Kit(false)
  boom.beam([0, 0, 0], [0.5, 0.5, 0], 0.14, 0.14, C.yellow).beam([0.5, 0.5, 0], [0.9, 0.42, 0], 0.13, 0.13, C.yellow)
  boom.rod([0.08, -0.02, 0.09], [0.45, 0.42, 0.09], 0.03, C.steelLight, 6)
  const stick = new Kit(false)
  stick.beam([0, 0, 0], [0.5, -0.42, 0], 0.1, 0.11, C.yellowDark)
  const bucket = new Kit(false)
  bucket.box(0.24, 0.2, 0.26, C.steelDark, { x: 0.06, y: -0.2 }).box(0.08, 0.05, 0.26, C.black, { x: 0.18, y: -0.24 })
  return {
    parts: [
      { geo: geo(base), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(house), parent: 0, pivot: [0, 0.26, 0] },
      { geo: geo(boom), parent: 1, pivot: [0.3, 0.26, -0.12] },
      { geo: geo(stick), parent: 2, pivot: [0.9, 0.42, 0] },
      { geo: geo(bucket), parent: 3, pivot: [0.5, -0.42, 0] },
    ],
    shadow: [1.5, 1.0],
    pose(t, s, _mv, o) {
      const c = cyc(t, 5.6, s)
      const swing = s.p?.[0] ?? 1.7
      o[1].ry = kf(c, [[0, 0], [0.32, 0], [0.5, swing], [0.64, swing], [0.86, 0], [1, 0]])
      o[2].rz = kf(c, [[0, 0.1], [0.28, -0.42], [0.42, 0.28], [0.64, 0.24], [0.86, 0.1], [1, 0.1]])
      o[3].rz = kf(c, [[0, -0.25], [0.28, 0.55], [0.42, 0.25], [0.56, -0.35], [0.86, -0.25], [1, -0.25]])
      o[4].rz = kf(c, [[0, 0.5], [0.26, -0.9], [0.5, -0.9], [0.6, 0.95], [0.86, 0.5], [1, 0.5]])
    },
  }
}

function dozer(): MachineType {
  const k = new Kit()
  for (const z of [-0.28, 0.28]) k.rbox(0.96, 0.22, 0.2, 0.07, C.tyre, { z })
  k.rbox(0.62, 0.3, 0.42, 0.06, C.yellow, { x: 0.02, y: 0.16 })
  k.rbox(0.34, 0.36, 0.4, 0.05, C.yellow, { x: -0.2, y: 0.44 })
  glassFront(k, -0.02, 0.52, 0.22, 0.32)
  k.box(0.3, 0.02, 0.36, C.glass, { x: -0.2, y: 0.8 })
  k.tube(0.025, 0.24, C.black, [0.12, 0.6, -0.12], 'y', 6)
  k.box(0.08, 0.16, 0.1, C.steelDark, { x: -0.55, y: 0.06 })
  const blade = new Kit(true, 0.12)
  blade.rbox(0.1, 0.36, 0.8, 0.04, C.yellowDark, { x: 0.12, y: -0.1 })
  for (const z of [-0.3, 0.3]) blade.beam([-0.36, 0.06, z], [0.08, 0.02, z], 0.06, 0.06, C.steelDark)
  return {
    parts: [
      { geo: geo(k), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(blade), parent: 0, pivot: [0.46, 0.12, 0] },
    ],
    shadow: [1.3, 1.0],
    pose(_t, _s, mv, o) {
      o[1].y = mv.seg === 0 ? 0 : 0.1
      o[1].rz = mv.seg === 0 ? 0 : -0.12
    },
  }
}

function truckCab(k: Kit, x: number, color: string, w = 0.46) {
  k.rbox(0.32, 0.36, w, 0.06, color, { x, y: 0.26 })
  glassFront(k, x + 0.165, 0.38, 0.18, w - 0.08)
  k.box(0.26, 0.02, w - 0.06, C.glass, { x, y: 0.62 })
}

function dumper(): MachineType {
  const k = new Kit()
  k.box(1.3, 0.12, 0.42, C.black, { y: 0.2 })
  wheels(k, [0.46, -0.16, -0.46], 0.17, 0.25, 0.12)
  truckCab(k, 0.48, C.yellow, 0.5)
  const bed = new Kit(true, 0.36)
  bed.rbox(0.9, 0.3, 0.58, 0.05, C.yellowDark, { x: 0.45 })
  bed.box(0.84, 0.03, 0.5, C.dirtDark, { x: 0.45, y: 0.29 })
  bed.dome(0.26, C.dirt, { x: 0.45, y: 0.3 }, 7, 0.55)
  return {
    parts: [
      { geo: geo(k), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(bed), parent: 0, pivot: [-0.62, 0.34, 0] },
    ],
    shadow: [1.6, 0.9],
    pose(_t, _s, mv, o) {
      o[1].rz = mv.seg === 1 ? 0.85 * Math.sin(Math.PI * mv.k) : 0
    },
  }
}

function roller(): MachineType {
  const k = new Kit()
  k.tube(0.22, 0.7, C.steel, [0.38, 0.22, 0], 'z', 10).box(0.12, 0.08, 0.76, C.yellowDark, { x: 0.38, y: 0.4 })
  k.rbox(0.55, 0.3, 0.6, 0.07, C.yellow, { x: -0.12, y: 0.12 })
  wheels(k, [-0.3], 0.18, 0.28, 0.14)
  for (const [x, z] of [[-0.3, -0.24], [-0.3, 0.24], [0.05, -0.24], [0.05, 0.24]]) k.box(0.03, 0.42, 0.03, C.black, { x, y: 0.42, z })
  k.box(0.46, 0.04, 0.56, C.yellow, { x: -0.12, y: 0.84 })
  return { parts: [{ geo: geo(k), parent: -1, pivot: [0, 0, 0] }], shadow: [1.1, 0.9], pose() {} }
}

function paver(): MachineType {
  const k = new Kit()
  for (const z of [-0.3, 0.3]) k.rbox(0.8, 0.18, 0.16, 0.06, C.tyre, { z })
  k.rbox(0.86, 0.28, 0.68, 0.06, C.yellow, { y: 0.14 })
  k.box(0.32, 0.18, 0.7, C.yellowDark, { x: 0.46, y: 0.2 }).box(0.3, 0.02, 0.6, C.asphaltFresh, { x: 0.46, y: 0.38 })
  k.box(0.2, 0.14, 1.0, C.steelDark, { x: -0.52, y: 0.04 })
  k.box(0.3, 0.2, 0.3, C.yellow, { x: -0.15, y: 0.42 })
  for (const [x, z] of [[-0.35, -0.28], [-0.35, 0.28], [0.15, -0.28], [0.15, 0.28]]) k.box(0.03, 0.4, 0.03, C.black, { x, y: 0.42, z })
  k.box(0.6, 0.04, 0.66, C.white, { x: -0.1, y: 0.82 })
  return { parts: [{ geo: geo(k), parent: -1, pivot: [0, 0, 0] }], shadow: [1.4, 1.1], pose() {} }
}

function grader(): MachineType {
  const k = new Kit()
  k.beam([0.75, 0.32, 0], [-0.1, 0.42, 0], 0.12, 0.14, C.yellow)
  k.rbox(0.62, 0.26, 0.5, 0.06, C.yellow, { x: -0.5, y: 0.22 })
  k.rbox(0.3, 0.34, 0.42, 0.05, C.yellow, { x: -0.18, y: 0.46 })
  glassFront(k, -0.02, 0.54, 0.2, 0.34)
  k.box(0.28, 0.02, 0.4, C.glass, { x: -0.18, y: 0.8 })
  wheels(k, [0.72], 0.15, 0.22, 0.1)
  wheels(k, [-0.36, -0.66], 0.15, 0.24, 0.1)
  k.box(0.08, 0.14, 0.8, C.steelDark, { x: 0.18, y: 0.04, ry: 0.45 })
  return { parts: [{ geo: geo(k), parent: -1, pivot: [0, 0, 0] }], shadow: [1.7, 0.9], pose() {} }
}

function mixer(): MachineType {
  const k = new Kit()
  k.box(1.3, 0.12, 0.42, C.black, { y: 0.2 })
  wheels(k, [0.46, -0.2, -0.46], 0.16, 0.25, 0.12)
  truckCab(k, 0.48, C.white)
  const drum = new Kit(false)
  drum.tube(0.27, 0.78, C.white, [0, 0, 0], 'x', 10, 0.16).tube(0.275, 0.07, C.orange, [-0.12, 0, 0], 'x', 10).tube(0.24, 0.07, C.orange, [0.16, 0, 0], 'x', 10)
  return {
    parts: [
      { geo: geo(k), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(drum), parent: 0, pivot: [-0.18, 0.6, 0], tilt: [0, 0, 0.22] },
    ],
    shadow: [1.6, 0.9],
    pose(t, s, _mv, o) {
      o[1].rx = (t + (s.phase ?? 0) * 10) * 2.2
    },
  }
}

function tanker(): MachineType {
  const k = new Kit()
  k.box(1.3, 0.12, 0.42, C.black, { y: 0.2 })
  wheels(k, [0.46, -0.2, -0.46], 0.16, 0.25, 0.12)
  truckCab(k, 0.48, C.blue)
  k.tube(0.24, 0.84, C.steelLight, [-0.2, 0.56, 0], 'x', 10).box(0.04, 0.06, 0.4, C.steelDark, { x: -0.64, y: 0.3 })
  return { parts: [{ geo: geo(k), parent: -1, pivot: [0, 0, 0] }], shadow: [1.6, 0.9], pose() {} }
}

function flatbed(): MachineType {
  const k = new Kit()
  k.box(1.5, 0.12, 0.44, C.black, { y: 0.2 })
  wheels(k, [0.56, -0.3, -0.56], 0.16, 0.25, 0.12)
  truckCab(k, 0.58, C.blue)
  k.box(1.0, 0.05, 0.5, C.steelDark, { x: -0.2, y: 0.32 })
  for (const [z, y] of [[-0.13, 0.48], [0.13, 0.48], [0, 0.7]]) k.tube(0.12, 1.0, C.pipe, [-0.2, y, z], 'x', 8)
  return { parts: [{ geo: geo(k), parent: -1, pivot: [0, 0, 0] }], shadow: [1.8, 0.9], pose() {} }
}

/** Lattice mast for tower cranes and hoists (square, side a). */
function mast(k: Kit, h: number, a: number, color: string, y0 = 0) {
  const s = a / 2
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) k.box(0.05, h, 0.05, color, { x, y: y0, z })
  const step = a * 1.6
  for (let y = y0; y < y0 + h - step / 2; y += step) {
    k.beam([-s, y, s], [s, y + step, s], 0.03, 0.03, color).beam([s, y, -s], [-s, y + step, -s], 0.03, 0.03, color)
    k.beam([s, y, s], [s, y + step, -s], 0.03, 0.03, color).beam([-s, y, -s], [-s, y + step, s], 0.03, 0.03, color)
  }
}

function towerCrane(): MachineType {
  const H = 4.6
  const base = new Kit()
  base.box(0.7, 0.18, 0.7, C.concrete)
  mast(base, H - 0.18, 0.3, C.yellow, 0.18)
  const slew = new Kit(false)
  slew.box(0.42, 0.14, 0.42, C.yellowDark)
  slew.rbox(0.3, 0.3, 0.3, 0.05, C.yellow, { x: 0.32, y: 0.0, z: 0.26 })
  glassFront(slew, 0.48, 0.06, 0.2, 0.22)
  // jib (+x) and counter-jib (-x)
  for (const z of [-0.12, 0.12]) slew.beam([0, 0.14, z], [3.7, 0.14, z * 0.5], 0.05, 0.05, C.yellow)
  slew.beam([0, 0.42, 0], [3.7, 0.2, 0], 0.05, 0.05, C.yellow)
  for (let x = 0.3; x < 3.6; x += 0.45) slew.beam([x, 0.16, 0], [x + 0.22, 0.38 - x * 0.06, 0], 0.025, 0.025, C.yellow)
  slew.box(1.4, 0.08, 0.32, C.yellow, { x: -0.7, y: 0.12 })
  slew.box(0.36, 0.32, 0.36, C.concreteDark, { x: -1.15, y: 0.2 })
  slew.beam([0, 0.14, 0], [0, 0.95, 0], 0.08, 0.08, C.yellow)
  slew.rod([0, 0.95, 0], [2.6, 0.3, 0], 0.012, C.steelDark, 4).rod([0, 0.95, 0], [-1.3, 0.22, 0], 0.012, C.steelDark, 4)
  const trolley = new Kit(false)
  trolley.box(0.2, 0.08, 0.2, C.steelDark, { y: -0.04 })
  const cable = new Kit(false)
  cable.box(0.016, 1, 0.016, C.black, { y: -1 })
  const hook = new Kit(false)
  hook.box(0.1, 0.1, 0.1, C.yellowDark, { y: -0.1 })
  hook.box(0.5, 0.14, 0.24, C.rebar, { y: -0.36 }).box(0.5, 0.02, 0.26, C.steelDark, { y: -0.24 })
  return {
    parts: [
      { geo: geo(base), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(slew), parent: 0, pivot: [0, H, 0] },
      { geo: geo(trolley), parent: 1, pivot: [0, 0.14, 0] },
      { geo: geo(cable), parent: 2, pivot: [0, -0.08, 0] },
      { geo: geo(hook), parent: 2, pivot: [0, -0.08, 0] },
    ],
    shadow: [0.9, 0.9],
    pose(t, s, _mv, o) {
      const c = cyc(t, 15, s)
      const [a0, a1, d0, d1] = s.p ?? [0, 2.2, 3.6, 2.4]
      o[1].ry = kf(c, [[0, a0], [0.12, a0], [0.42, a1], [0.6, a1], [0.9, a0], [1, a0]])
      o[2].x = kf(c, [[0, 2.8], [0.12, 2.8], [0.42, 1.6], [0.6, 1.6], [0.9, 2.8], [1, 2.8]])
      const drop = kf(c, [[0, d0], [0.1, 1.2], [0.44, 1.2], [0.52, d1], [0.6, d1], [0.66, 1.2], [0.92, 1.2], [1, d0]])
      o[3].sy = drop
      o[4].y = -drop + 0.02
    },
  }
}

function crawlerCrane(load: 'tube' | 'box' = 'tube'): MachineType {
  const base = new Kit()
  for (const z of [-0.36, 0.36]) base.rbox(1.3, 0.24, 0.26, 0.08, C.tyre, { z })
  base.box(0.7, 0.14, 0.5, C.steelDark, { y: 0.14 })
  const house = new Kit(true, 0.28)
  house.rbox(0.9, 0.38, 0.62, 0.06, C.yellow, { x: -0.1 })
  house.rbox(0.3, 0.44, 0.62, 0.06, C.yellowDark, { x: -0.6 })
  house.rbox(0.3, 0.36, 0.26, 0.05, C.yellow, { x: 0.28, z: 0.2 })
  glassFront(house, 0.44, 0.08, 0.24, 0.2)
  const L = 4.6
  const a = 1.05
  const tip: [number, number, number] = [0.32 + Math.cos(a) * L, 0.3 + Math.sin(a) * L, 0]
  for (const z of [-0.14, 0.14]) house.beam([0.32, 0.3, z * 1.6], [tip[0], tip[1], z * 0.5], 0.06, 0.06, C.yellow)
  for (let i = 0.15; i < 0.95; i += 0.11) {
    const p: [number, number, number] = [0.32 + Math.cos(a) * L * i, 0.3 + Math.sin(a) * L * i, 0]
    const q: [number, number, number] = [0.32 + Math.cos(a) * L * (i + 0.055), 0.3 + Math.sin(a) * L * (i + 0.055), 0]
    house.beam([p[0], p[1], -0.2 + i * 0.12], [q[0], q[1], 0.2 - i * 0.12], 0.025, 0.025, C.yellow)
  }
  house.rod([-0.55, 0.5, 0], [tip[0] - 0.1, tip[1], 0], 0.012, C.steelDark, 4)
  const cable = new Kit(false)
  cable.box(0.016, 1, 0.016, C.black, { y: -1 })
  const hook = new Kit(false)
  hook.box(0.12, 0.12, 0.12, C.yellowDark, { y: -0.12 })
  if (load === 'tube') hook.tube(0.2, 0.7, C.steelLight, [0, -0.45, 0], 'y', 8)
  else hook.rbox(0.9, 0.5, 0.7, 0.04, C.concreteLight, { y: -0.72 }).box(0.92, 0.06, 0.72, C.concrete, { y: -0.3 })
  return {
    parts: [
      { geo: geo(base), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(house), parent: 0, pivot: [0, 0.28, 0] },
      { geo: geo(cable), parent: 1, pivot: tip },
      { geo: geo(hook), parent: 1, pivot: tip },
    ],
    shadow: [1.6, 1.1],
    pose(t, s, _mv, o) {
      const c = cyc(t, 16, s)
      const [a0, a1, d0, d1] = s.p ?? [0, 1.2, 4.0, 3.0]
      o[1].ry = kf(c, [[0, a0], [0.16, a0], [0.46, a1], [0.62, a1], [0.92, a0], [1, a0]])
      const drop = kf(c, [[0, d0], [0.12, 2.0], [0.46, 2.0], [0.55, d1], [0.62, d1], [0.7, 2.0], [0.92, 2.0], [1, d0]])
      o[2].sy = drop
      o[3].y = -drop + 0.02
    },
  }
}

function pipelayer(): MachineType {
  const k = new Kit()
  for (const z of [-0.27, 0.27]) k.rbox(1.0, 0.22, 0.2, 0.07, C.tyre, { z })
  k.rbox(0.66, 0.3, 0.44, 0.06, C.yellow, { y: 0.16 })
  k.rbox(0.34, 0.36, 0.38, 0.05, C.yellow, { x: -0.16, y: 0.44, z: -0.04 })
  glassFront(k, 0.02, 0.52, 0.22, 0.3)
  k.box(0.3, 0.02, 0.34, C.glass, { x: -0.16, y: 0.8, z: -0.04 })
  k.box(0.2, 0.3, 0.3, C.concreteDark, { x: -0.04, y: 0.2, z: -0.38 })
  k.beam([-0.3, 0.32, 0.28], [0.0, 1.6, 0.72], 0.06, 0.06, C.yellow).beam([0.3, 0.32, 0.28], [0.0, 1.6, 0.72], 0.06, 0.06, C.yellow)
  const pipe = new Kit(false)
  pipe.box(0.016, 0.9, 0.016, C.black, { y: -0.9 })
  pipe.tube(0.13, 1.7, C.pipe, [0, -1.05, 0], 'x', 10)
  return {
    parts: [
      { geo: geo(k), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(pipe), parent: 0, pivot: [0, 1.6, 0.72] },
    ],
    shadow: [1.2, 1.2],
    pose(t, s, _mv, o) {
      o[1].y = 0.12 * Math.sin(cyc(t, 6, s) * Math.PI * 2)
    },
  }
}

function sts(): MachineType {
  const k = new Kit()
  const legH = 4.2
  for (const x of [-0.9, 0.9]) {
    for (const z of [-1.0, 1.0]) {
      k.box(0.5, 0.18, 0.3, C.black, { x, z })
      k.box(0.18, legH, 0.18, C.blue, { x, y: 0.18, z })
    }
    k.beam([x, 1.0, -1.0], [x, 1.0, 1.0], 0.14, 0.14, C.blue).beam([x, legH, -1.0], [x, legH, 1.0], 0.2, 0.2, C.blue)
    k.beam([x, 1.0, -1.0], [x, legH, 1.0], 0.08, 0.08, C.blueDark)
    k.beam([x, legH, -0.9], [x, 6.6, -0.4], 0.14, 0.14, C.blue)
  }
  k.beam([-0.9, legH, -1.0], [0.9, legH, -1.0], 0.2, 0.2, C.blue).beam([-0.9, legH, 1.0], [0.9, legH, 1.0], 0.2, 0.2, C.blue)
  k.beam([-0.9, 6.6, -0.4], [0.9, 6.6, -0.4], 0.16, 0.16, C.blue)
  // boom over the water (+z) and back-reach (-z)
  for (const x of [-0.36, 0.36]) k.beam([x, legH + 0.35, -3.0], [x, legH + 0.35, 6.2], 0.16, 0.26, C.white)
  for (let z = -2.6; z < 6; z += 0.9) k.beam([-0.36, legH + 0.48, z], [0.36, legH + 0.48, z + 0.45], 0.04, 0.04, C.steelLight)
  k.rod([0, 6.6, -0.4], [0, legH + 0.5, 6.0], 0.03, C.steelDark, 4).rod([0, 6.6, -0.4], [0, legH + 0.5, 3.2], 0.03, C.steelDark, 4)
  k.rod([0, 6.6, -0.4], [0, legH + 0.5, -2.9], 0.03, C.steelDark, 4)
  k.rbox(1.1, 0.6, 1.2, 0.06, C.white, { y: legH + 0.48, z: -2.3 })
  const trolley = new Kit(false)
  trolley.box(0.8, 0.2, 0.6, C.steelDark, { y: -0.1 })
  trolley.rbox(0.36, 0.3, 0.3, 0.04, C.white, { x: 0.3, y: -0.42, z: 0.0 })
  const cable = new Kit(false)
  for (const x of [-0.25, 0.25]) cable.box(0.016, 1, 0.016, C.black, { x, y: -1 })
  const spreader = new Kit(false)
  spreader.box(1.3, 0.1, 0.42, C.yellow, { y: -0.1 })
  spreader.box(1.24, 0.5, 0.44, C.teal, { y: -0.62 }).box(1.26, 0.04, 0.46, C.white, { y: -0.62 })
  return {
    parts: [
      { geo: geo(k), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(trolley), parent: 0, pivot: [0, legH + 0.3, 0] },
      { geo: geo(cable), parent: 1, pivot: [0, -0.2, 0] },
      { geo: geo(spreader), parent: 1, pivot: [0, -0.2, 0] },
    ],
    shadow: [2.4, 2.6],
    pose(t, s, _mv, o) {
      const c = cyc(t, 13, s)
      const [out, dShip, dQuay] = s.p ?? [3.4, 2.8, 3.3]
      o[1].z = kf(c, [[0, out], [0.1, out], [0.42, -0.4], [0.58, -0.4], [0.9, out], [1, out]])
      const drop = kf(c, [[0, dShip], [0.1, 1.0], [0.42, 1.0], [0.5, dQuay], [0.58, dQuay], [0.66, 1.0], [0.9, 1.0], [1, dShip]])
      o[2].sy = drop
      o[3].y = -drop + 0.02
    },
  }
}

function hullKit(k: Kit, len: number, w: number, h: number, color: string, top: string) {
  k.rbox(len, h, w, 0.06, color, { y: -h * 0.6 })
  // pointed bow: a triangular prism with its tip forward (+x)
  k.cyl(w * 0.58, w * 0.58, h, color, { x: len / 2 - w * 0.05, y: -h * 0.6, ry: Math.PI / 2 }, 3)
  k.box(len * 0.98, 0.04, w * 0.96, top, { y: h * 0.4 })
}

function dredger(): MachineType {
  const k = new Kit(false)
  hullKit(k, 2.6, 0.95, 0.4, C.hull, C.white)
  k.rbox(0.7, 0.55, 0.7, 0.05, C.white, { x: -0.7, y: 0.18 })
  k.rbox(0.5, 0.3, 0.6, 0.05, C.white, { x: -0.7, y: 0.73 })
  k.box(0.02, 0.16, 0.5, C.glassDark, { x: -0.44, y: 0.8 })
  for (const z of [-0.3, 0.3]) k.box(0.1, 2.2, 0.1, C.yellowDark, { x: -1.35, y: -0.6, z })
  k.beam([0.7, 0.18, -0.3], [1.1, 1.0, 0], 0.07, 0.07, C.yellow).beam([0.7, 0.18, 0.3], [1.1, 1.0, 0], 0.07, 0.07, C.yellow)
  k.tube(0.06, 0.5, C.orange, [-0.2, 0.42, 0.25], 'y', 6)
  const ladder = new Kit(false)
  ladder.beam([0, 0, 0], [1.5, -0.7, 0], 0.18, 0.16, C.yellow)
  ladder.ball(0.22, C.steelDark, { x: 1.55, y: -0.74 }, [1.2, 1, 1], 0)
  return {
    parts: [
      { geo: geo(k), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(ladder), parent: 0, pivot: [1.1, 0.1, 0] },
    ],
    floats: true,
    pose(t, s, _mv, o) {
      const c = cyc(t, 9, s)
      o[0].y = 0.03 * Math.sin(t * 1.3)
      o[0].rx = 0.02 * Math.sin(t * 0.9)
      o[1].ry = 0.45 * Math.sin(c * Math.PI * 2)
    },
  }
}

function tug(): MachineType {
  const k = new Kit(false)
  hullKit(k, 1.1, 0.5, 0.26, C.blueDark, C.white)
  k.rbox(0.42, 0.3, 0.38, 0.05, C.white, { x: -0.05, y: 0.12 })
  k.box(0.02, 0.1, 0.3, C.glassDark, { x: 0.16, y: 0.3 })
  k.tube(0.05, 0.2, C.yellow, [-0.18, 0.5, 0], 'y', 6)
  return {
    parts: [{ geo: geo(k), parent: -1, pivot: [0, 0, 0] }],
    floats: true,
    pose(t, _s, _mv, o) {
      o[0].y = 0.03 * Math.sin(t * 2)
      o[0].rx = 0.04 * Math.sin(t * 1.6)
    },
  }
}

function ship(): MachineType {
  const k = new Kit(false)
  hullKit(k, 6.4, 1.5, 0.7, C.hull, C.white)
  k.rbox(0.8, 1.2, 1.3, 0.06, C.white, { x: -2.6, y: 0.28 })
  k.box(0.02, 0.18, 1.1, C.glassDark, { x: -2.19, y: 1.24 })
  k.box(0.18, 0.5, 0.18, C.navy, { x: -2.8, y: 1.48 })
  const cols = [C.blue, C.teal, C.white, C.purple, C.steel, C.orange]
  let i = 0
  for (let x = -1.8; x < 2.6; x += 0.66) {
    const rows = 1 + ((i * 7) % 3)
    for (let r = 0; r < rows; r++) for (const z of [-0.36, 0.36]) k.box(0.62, 0.3, 0.68, cols[(i + r + (z > 0 ? 2 : 0)) % cols.length], { x, y: 0.28 + r * 0.3, z: z * 0.98 })
    i++
  }
  return {
    parts: [{ geo: geo(k), parent: -1, pivot: [0, 0, 0] }],
    floats: true,
    pose(t, _s, _mv, o) {
      o[0].y = 0.02 * Math.sin(t * 0.8)
      o[0].rx = 0.012 * Math.sin(t * 0.6)
    },
  }
}

function boat(): MachineType {
  const k = new Kit(false)
  hullKit(k, 1.3, 0.5, 0.26, C.white, C.white)
  k.box(1.32, 0.06, 0.52, C.navy, { y: -0.04 })
  k.rbox(0.46, 0.26, 0.36, 0.05, C.white, { x: -0.1, y: 0.12 })
  k.box(0.02, 0.1, 0.3, C.glassDark, { x: 0.13, y: 0.24 })
  k.box(0.06, 0.06, 0.12, C.blue, { x: -0.1, y: 0.42 })
  return {
    parts: [{ geo: geo(k), parent: -1, pivot: [0, 0, 0] }],
    floats: true,
    pose(t, s, _mv, o) {
      o[0].y = 0.03 * Math.sin(t * 1.8 + (s.phase ?? 0) * 6)
      o[0].rx = 0.05 * Math.sin(t * 1.4)
    },
  }
}

function hoist(): MachineType {
  const k = new Kit()
  mast(k, 3.0, 0.2, C.steelLight)
  const cage = new Kit(false)
  cage.rbox(0.34, 0.36, 0.34, 0.04, C.orange, { x: 0.28 })
  cage.box(0.02, 0.2, 0.24, C.glassDark, { x: 0.46, y: 0.1 })
  return {
    parts: [
      { geo: geo(k), parent: -1, pivot: [0, 0, 0] },
      { geo: geo(cage), parent: 0, pivot: [0, 0.05, 0] },
    ],
    shadow: [0.6, 0.6],
    pose(t, s, _mv, o) {
      const top = s.p?.[0] ?? 2.4
      o[1].y = kf(cyc(t, 10, s), [[0, 0], [0.15, 0], [0.45, top], [0.65, top], [0.95, 0], [1, 0]])
    },
  }
}

const MAKERS: Record<MachineKind, () => MachineType> = {
  excavator,
  dozer,
  dumper,
  roller,
  paver,
  grader,
  mixer,
  tanker,
  flatbed,
  towerCrane,
  crawlerCrane: () => crawlerCrane('tube'),
  crawlerCraneBox: () => crawlerCrane('box'),
  pipelayer,
  sts,
  dredger,
  tug,
  ship,
  boat,
  hoist,
}

const cache = new Map<MachineKind, MachineType>()
/** Build a machine kind once (geometry is shared by every machine of the kind). */
export function machineType(kind: MachineKind): MachineType {
  let m = cache.get(kind)
  if (!m) {
    m = MAKERS[kind]()
    cache.set(kind, m)
  }
  return m
}
