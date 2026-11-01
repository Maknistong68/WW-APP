import { Kit } from '../kit/build'
import { C } from '../kit/colors'
import type { MachineSpec } from '../kit/machines'
import type { SiteDef } from '../../lib/site'

// What one site's builder returns (all in the site's own frame: centred,
// unrotated, w along x and d along z).

export interface WorkerSpec {
  x: number
  z: number
  /** Walks to (bx, bz) and back; no b = works on the spot. */
  bx?: number
  bz?: number
  y?: number
  period?: number
  phase?: number
}

export type FxKind = 'dust' | 'steam' | 'spray' | 'spark'
export interface FxSpec {
  kind: FxKind
  x: number
  y: number
  z: number
  size?: number
}

export interface Built {
  solid: Kit
  /** Windows and lamps, lit at night. */
  glow: Kit
  machines: MachineSpec[]
  workers: WorkerSpec[]
  /** Floodlight heads (pools of light at night). */
  lights: [number, number, number][]
  fx: FxSpec[]
}

export type Builder = (def: SiteDef, r: () => number) => Built

export const SEA_Y = -0.55

export function built(): Built {
  return { solid: new Kit(), glow: new Kit(false), machines: [], workers: [], lights: [], fx: [] }
}

/** yaw that points a machine's front (+x) along (dx, dz). */
export const yawTo = (dx: number, dz: number) => Math.atan2(-dz, dx)

/** The site's ground: a slightly raised pad with a darker rim. */
export function pad(b: Built, x0: number, z0: number, x1: number, z1: number, color: string, rim: string = C.sandDark) {
  b.solid.box(x1 - x0, 0.05, z1 - z0, rim, { x: (x0 + x1) / 2, z: (z0 + z1) / 2 })
  b.solid.box(x1 - x0 - 0.16, 0.07, z1 - z0 - 0.16, color, { x: (x0 + x1) / 2, z: (z0 + z1) / 2 })
}

/** Site office: a portacabin with windows, door, steps and a flag. */
export function office(b: Built, x: number, z: number, along: 'x' | 'z' = 'x') {
  const k = b.solid
  const w = along === 'x' ? 1.3 : 0.7
  const d = along === 'x' ? 0.7 : 1.3
  k.box(w + 0.1, 0.08, d + 0.1, C.concreteDark, { x, z })
  k.rbox(w, 0.56, d, 0.05, C.white, { x, y: 0.08, z })
  k.box(w + 0.02, 0.06, d + 0.02, C.blue, { x, y: 0.5, z })
  k.box(w + 0.06, 0.05, d + 0.06, C.steelLight, { x, y: 0.64, z })
  // windows on the front (+z) face and the door
  const fz = z + d / 2 + 0.005
  for (const dx of along === 'x' ? [-0.38, 0.06] : [-0.12]) {
    k.box(0.26, 0.18, 0.02, C.glassDark, { x: x + dx, y: 0.26, z: fz })
    b.glow.box(0.24, 0.16, 0.02, C.windowGlow, { x: x + dx, y: 0.27, z: fz + 0.01 })
  }
  k.box(0.18, 0.36, 0.02, C.navy, { x: x + (along === 'x' ? 0.42 : 0.18), y: 0.08, z: fz })
  k.box(0.3, 0.06, 0.16, C.steelDark, { x: x + (along === 'x' ? 0.42 : 0.18), z: fz + 0.08 })
  // flag
  k.box(0.03, 1.0, 0.03, C.steelLight, { x: x - w / 2 - 0.12, z: z + d / 2 - 0.05 })
  k.box(0.3, 0.18, 0.02, C.orange, { x: x - w / 2 + 0.04, y: 0.8, z: z + d / 2 - 0.05 })
}

/** Floodlight mast; its head glows at night. */
export function lamp(b: Built, x: number, z: number, h = 2.4, ry = 0) {
  b.solid.box(0.18, 0.08, 0.18, C.concreteDark, { x, z })
  b.solid.box(0.05, h, 0.05, C.steel, { x, y: 0.08, z })
  b.solid.box(0.34, 0.1, 0.14, C.steelDark, { x, y: h + 0.02, z, ry })
  b.glow.box(0.3, 0.02, 0.12, C.lamp, { x, y: h, z, ry })
  b.lights.push([x, h, z])
}

/** Traffic cones along a line. */
export function cones(b: Built, x0: number, z0: number, x1: number, z1: number, n: number) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const x = x0 + (x1 - x0) * t
    const z = z0 + (z1 - z0) * t
    b.solid.box(0.12, 0.02, 0.12, C.black, { x, z }).cone(0.05, 0.18, C.orange, { x, y: 0.02, z }, 6).box(0.07, 0.03, 0.07, C.white, { x, y: 0.09, z })
  }
}

/** A pyramid of pipes lying along x. */
export function pipeStack(b: Built, x: number, z: number, len: number, r = 0.12, rows = 3, color: string = C.pipe) {
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < rows - row; i++) {
      b.solid.tube(r, len, color, [x, r + row * r * 1.75, z + (i - (rows - row - 1) / 2) * r * 2.05], 'x', 8)
    }
  }
  for (const dx of [-len / 3, len / 3]) b.solid.box(0.1, 0.06, rows * r * 2.2, C.wood, { x: x + dx, z })
}

/** Pallet of blocks / materials. */
export function pallet(b: Built, x: number, z: number, color: string = C.concreteLight, h = 0.24) {
  b.solid.box(0.5, 0.06, 0.5, C.wood, { x, z }).box(0.44, h, 0.44, color, { x, y: 0.06, z })
}

/** Low site fence on two posts per segment along a line. */
export function fence(b: Built, x0: number, z0: number, x1: number, z1: number) {
  b.solid.beam([x0, 0.22, z0], [x1, 0.22, z1], 0.04, 0.16, C.orange)
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.2))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    b.solid.box(0.04, 0.3, 0.04, C.white, { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t })
  }
}

/** Portable toilet, water tank and skip: small site clutter. */
export function clutter(b: Built, x: number, z: number) {
  b.solid.rbox(0.3, 0.5, 0.3, 0.04, C.blue, { x, z }).box(0.3, 0.03, 0.3, C.white, { x, y: 0.5, z })
  b.solid.box(0.7, 0.26, 0.4, C.yellowDark, { x: x + 0.65, z })
  b.solid.box(0.62, 0.06, 0.32, C.dirtDark, { x: x + 0.65, y: 0.24, z })
}

/** Rebar sticking up from a wall top / slab. */
export function rebar(b: Built, x0: number, x1: number, z: number, y: number, h = 0.3, along: 'x' | 'z' = 'x') {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 0.18))
  for (let i = 0; i <= n; i++) {
    const t = x0 + ((x1 - x0) * i) / n
    if (along === 'x') b.solid.box(0.02, h, 0.02, C.rebar, { x: t, y, z })
    else b.solid.box(0.02, h, 0.02, C.rebar, { x: z, y, z: t })
  }
}
