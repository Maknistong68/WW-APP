import { C } from '../kit/colors'
import type { Builder } from './common'
import { SEA_Y, built, clutter, lamp, office, pad, pallet, rebar, yawTo } from './common'
import { QUAY } from '../../lib/world'
import { localShore } from '../../lib/site'

const G = 0.07

/** Local z of the quay edge for a coast site (the same wherever the quay is; the site moves with it). */
const shoreZ = (gz: number, d: number) => QUAY - (gz + d / 2)

// ---------------------------------------------------------------------------
// Al Fahad 1272 · Coast Guard building (4 floors, facing the water; on the island's tip)
// ---------------------------------------------------------------------------
export const coastGuard: Builder = (def) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  const sz = localShore(def)
  pad(b, -W, -D, W, sz, C.concreteLight, C.concreteDark)
  k.box(def.w, 0.14, 0.3, C.concrete, { y: 0, z: sz - 0.15 }).box(def.w, 0.9, 0.14, C.concreteDark, { y: -0.85, z: sz + 0.02 })
  // the building: floors 1–2 done, 3 walls going up, 4 bare frame
  const x0 = -1.0
  const x1 = 3.0
  const z0 = -3.2
  const z1 = sz - 0.8
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const w = x1 - x0
  const d = z1 - z0
  const fh = 0.62
  k.box(w + 0.2, 0.1, d + 0.2, C.concrete, { x: cx, y: G, z: cz })
  const y0 = G + 0.1
  k.box(w, fh * 2, d, C.white, { x: cx, y: y0, z: cz })
  for (let f = 0; f < 2; f++) {
    const wy = y0 + f * fh + 0.2
    k.box(w - 0.3, 0.28, 0.02, C.glassDark, { x: cx, y: wy, z: z1 + 0.005 })
    b.glow.box(w - 0.34, 0.24, 0.02, C.windowGlow, { x: cx, y: wy + 0.02, z: z1 + 0.015 })
    k.box(0.02, 0.28, d - 0.4, C.glassDark, { x: x0 - 0.005, y: wy, z: cz })
    b.glow.box(0.02, 0.24, d - 0.44, C.windowGlow, { x: x0 - 0.015, y: wy + 0.02, z: cz })
    k.box(w + 0.06, 0.06, d + 0.06, C.navy, { x: cx, y: y0 + (f + 1) * fh - 0.04, z: cz })
  }
  // floor 3: back and side walls, open front
  const y2 = y0 + 2 * fh
  k.box(w, fh, 0.14, C.white, { x: cx, y: y2, z: z0 + 0.07 }).box(0.14, fh, d, C.white, { x: x0 + 0.07, y: y2, z: cz })
  for (const x of [x0 + 0.1, cx, x1 - 0.1]) k.box(0.14, fh, 0.14, C.concrete, { x, y: y2, z: z1 - 0.08 })
  k.box(w, 0.08, d, C.concrete, { x: cx, y: y2 + fh - 0.08, z: cz })
  // floor 4: columns + rebar
  const y3 = y2 + fh
  for (const x of [x0 + 0.1, cx, x1 - 0.1]) for (const z of [z0 + 0.1, z1 - 0.1]) k.box(0.13, fh * 0.8, 0.13, C.concrete, { x, y: y3, z })
  rebar(b, x0 + 0.1, x1 - 0.1, z1 - 0.1, y3 + fh * 0.8, 0.2)
  // lookout tower going up at the corner
  k.tube(0.45, 2.9, C.white, [x0 - 0.2, G + 1.45, z1 - 0.3], 'y', 12).tube(0.5, 0.12, C.navy, [x0 - 0.2, G + 2.0, z1 - 0.3], 'y', 12)
  k.box(0.04, 0.5, 0.04, C.rebar, { x: x0 - 0.35, y: G + 2.9, z: z1 - 0.3 }).box(0.04, 0.5, 0.04, C.rebar, { x: x0 - 0.05, y: G + 2.9, z: z1 - 0.3 })
  // scaffold on the sea face (floors 3–4)
  for (let x = x0; x <= x1 + 0.01; x += 0.8) k.box(0.03, fh * 4 + 0.3, 0.03, C.steel, { x, y: G, z: z1 + 0.32 })
  for (const f of [2, 3, 4]) k.box(w + 0.1, 0.03, 0.28, C.wood, { x: cx, y: y0 + f * fh - 0.02, z: z1 + 0.2 })
  // jetty into the sea with the patrol boat
  const jx = -3.2
  k.box(0.8, 0.12, D - sz + 0.2, C.concrete, { x: jx, y: -0.05, z: (sz + D) / 2 })
  for (let z = sz + 0.6; z < D; z += 0.9) for (const dx of [-0.32, 0.32]) k.box(0.08, 0.6, 0.08, C.concreteDark, { x: jx + dx, y: -0.65, z })
  for (let z = sz + 0.5; z < D; z += 1.1) k.tube(0.05, 0.12, C.black, [jx + 0.32, 0.13, z], 'y', 6)
  pallet(b, -2.3, -1.2)
  pallet(b, -1.6, -1.2, C.rebar, 0.12)
  b.machines.push(
    { kind: 'boat', x: jx + 0.9, z: sz + 2.2, yaw: yawTo(0, 1), y: SEA_Y + 0.12 },
    { kind: 'towerCrane', x: 3.5, z: -3.5, yaw: 0, size: 0.9, p: [2.0, 3.0, 4.4, 1.6] },
    { kind: 'hoist', x: x1 + 0.22, z: cz, yaw: Math.PI, size: 0.85, p: [2.6] },
    { kind: 'mixer', x: -0.6, z: -3.6, yaw: 0 },
  )
  b.workers.push({ x: x0 + 0.4, z: z1 - 0.3, y: y3, bx: x1 - 0.5, bz: z1 - 0.3, period: 10 }, { x: jx, z: sz + 0.5, bx: jx, bz: D - 0.5, period: 9 }, { x: -1.9, z: -0.6 })
  lamp(b, -3.7, sz - 0.5)
  lamp(b, 3.75, sz - 0.5)
  office(b, def.offices[0].at[0], def.offices[0].at[1])
  return b
}

// ---------------------------------------------------------------------------
// ECH 1131 · port under construction with three giant cranes
// ---------------------------------------------------------------------------
export const port: Builder = (def, r) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  const sz = shoreZ(def.home.gz, def.d)
  pad(b, -W, -D, W, sz, C.asphalt, C.concreteDark)
  for (let x = -W + 1; x < W - 1; x += 1.4) k.patch(x, sz - 1.9, x + 0.7, sz - 1.84, G + 0.004, C.marking)
  // finished quay deck, fenders, bollards, crane rails
  const qx1 = 3
  const qz = sz + 3.5
  k.box(qx1 + W, 0.12, qz - sz, C.concrete, { x: (-W + qx1) / 2, y: -0.05, z: (sz + qz) / 2 })
  k.box(qx1 + W, 0.95, 0.16, C.concreteDark, { x: (-W + qx1) / 2, y: -0.9, z: qz - 0.08 })
  for (let x = -W + 0.6; x < qx1; x += 1.0) k.box(0.3, 0.32, 0.08, C.black, { x, y: -0.32, z: qz + 0.02 })
  for (let x = -W + 1.1; x < qx1; x += 2.0) k.tube(0.07, 0.14, C.black, [x, 0.14, qz - 0.2], 'y', 6)
  for (const z of [-1.0, 1.0]) k.patch(-W, z - 0.05, qx1, z + 0.05, 0.075, C.steelDark)
  // new quay going out: caissons in the water, sheet piles, rebar
  for (const x of [3.7, 5.2]) k.box(1.3, 0.95, 3.0, C.concreteLight, { x, y: -0.9, z: sz + 1.6 })
  rebar(b, 4.6, 5.8, sz + 1.6, 0.05, 0.25)
  for (let x = 6.1; x < W - 0.2; x += 0.3) k.box(0.22, 0.7 + (x % 0.6 > 0.3 ? 0.1 : 0), 0.06, C.steelDark, { x, y: -0.65, z: sz + 0.2 })
  // container yard
  const cols = [C.blue, C.teal, C.white, C.purple, C.steel, C.orange, C.blueDark]
  for (let x = -5.2; x < 1.0; x += 1.35) {
    for (let z = sz - 3.7; z < sz - 2.2; z += 0.55) {
      const h = 1 + Math.floor(r() * 3)
      for (let i = 0; i < h; i++) k.box(1.24, 0.5, 0.5, cols[Math.floor(r() * cols.length)], { x, y: G + i * 0.5, z })
    }
  }
  clutter(b, 2.2, sz - 3.4)
  b.machines.push(
    { kind: 'sts', x: -6.4, z: sz + 2, yaw: 0, phase: 0 },
    { kind: 'sts', x: -3.6, z: sz + 2, yaw: 0, phase: 0.33 },
    { kind: 'sts', x: -0.8, z: sz + 2, yaw: 0, phase: 0.66 },
    { kind: 'ship', x: -3.4, z: sz + 5.4, yaw: 0, y: SEA_Y },
    { kind: 'crawlerCraneBox', x: 2.1, z: sz + 1.8, yaw: 0, size: 0.8, p: [-0.35, 0.35, 4.3, 4.0] },
    { kind: 'tug', x: 4.6, z: sz + 6.4, yaw: 0, y: SEA_Y, loop: { r: 0.9, period: 30 } },
  )
  b.workers.push({ x: -2.2, z: sz + 2.9, bx: 1.2, bz: sz + 2.9, period: 12 }, { x: -5.0, z: sz - 0.6, bx: -1.0, bz: sz - 0.6, period: 11 }, { x: 2.8, z: sz + 0.6 }, { x: -6.0, z: sz - 3.0 })
  b.fx.push({ kind: 'spark', x: 5.2, y: 0.25, z: sz + 1.6 })
  lamp(b, -7.6, sz - 0.4, 3.4)
  lamp(b, 1.6, sz - 3.7, 3.4)
  lamp(b, 6.6, sz - 0.4, 3.4)
  office(b, def.offices[0].at[0], def.offices[0].at[1])
  return b
}

// ---------------------------------------------------------------------------
// Archirodon 0876 · seawall (rock + concrete armour) and dredging
// ---------------------------------------------------------------------------
export const seawall: Builder = (def, r) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  const sz = shoreZ(def.home.gz, def.d)
  pad(b, -W, -D, W, sz, C.sand, C.sandDark)
  // crown wall: finished on the left, still being built on the right
  k.box(6.5, 0.5, 0.4, C.concrete, { x: -W + 3.25, y: G, z: sz - 0.3 })
  k.box(W * 2 - 6.5, 0.2, 0.4, C.concreteDark, { x: -W + 6.5 + (W * 2 - 6.5) / 2, y: G, z: sz - 0.3 })
  rebar(b, -W + 6.6, W - 0.2, sz - 0.3, G + 0.2, 0.28)
  // armour slope: rock on the left, concrete units on the right, bare core at the end
  for (let row = 0; row < 5; row++) {
    const z = sz + 0.05 + row * 0.42
    const y = 0.25 - row * 0.22
    for (let x = -W + 0.3; x < W - 1.2; x += 0.5 + r() * 0.1) {
      const jitter = (r() - 0.5) * 0.12
      if (x < 1.3) k.ball(0.22 + r() * 0.1, r() > 0.5 ? C.rock : C.rockDark, { x, y: y + jitter, z: z + jitter, ry: r() * 3 }, [1.1, 0.8, 1], 0)
      else k.cone(0.24, 0.36, C.concreteLight, { x, y: y - 0.1, z, rx: r() * 2, ry: r() * 3, rz: r() * 2 }, 3)
    }
  }
  k.wedge(2.0, 0.6, 1.2, C.dirt, { x: W - 0.8, y: -0.5, z: sz + 0.6, ry: Math.PI / 2 })
  // rock stockpile and the reclaimed-sand mound where the dredger pumps
  k.dome(0.9, C.rock, { x: 1.2, y: G, z: -3.4 }, 8, 0.7)
  for (let i = 0; i < 6; i++) k.ball(0.18 + r() * 0.1, C.rockDark, { x: 0.4 + r() * 1.8, y: G + 0.1, z: -3.9 + r() * 1.2 }, [1, 0.8, 1], 0)
  k.dome(1.1, C.sand, { x: -3.2, y: G, z: -2.4 }, 9, 0.45)
  // floating pipeline from the dredger to the shore
  const pts: [number, number][] = [
    [-0.9, sz + 3.4],
    [-1.8, sz + 2.9],
    [-2.6, sz + 2.2],
    [-3.2, sz + 1.3],
    [-3.6, sz + 0.4],
  ]
  for (let i = 0; i < pts.length - 1; i++) k.rod([pts[i][0], SEA_Y + 0.08, pts[i][1]], [pts[i + 1][0], SEA_Y + 0.08, pts[i + 1][1]], 0.06, C.black, 6)
  for (const [x, z] of pts) k.tube(0.13, 0.32, C.orange, [x, SEA_Y + 0.08, z], 'x', 8)
  k.rod([-3.6, SEA_Y + 0.08, sz + 0.4], [-3.6, 0.5, sz - 0.6], 0.07, C.black, 6).rod([-3.6, 0.5, sz - 0.6], [-3.4, 0.45, -1.8], 0.07, C.black, 6)
  b.machines.push(
    { kind: 'excavator', x: 3.6, z: sz - 1.2, yaw: -Math.PI / 2, p: [1.2], phase: 0.2 },
    { kind: 'dumper', x: 0.6, z: -2.8, yaw: yawTo(-2.0, -0.6), path: { bx: 2.6, bz: -2.2, period: 15, pause: 0.18 } },
    { kind: 'dredger', x: 0.4, z: sz + 3.4, yaw: 0.25, y: SEA_Y },
    { kind: 'tug', x: -2.4, z: sz + 4.0, yaw: 0, y: SEA_Y, loop: { r: 0.8, period: 26 } },
  )
  b.workers.push({ x: -1.2, z: sz - 1.0, bx: 1.6, bz: sz - 1.0, period: 11 }, { x: -2.6, z: -1.4 }, { x: 2.6, z: sz - 1.4 })
  b.fx.push({ kind: 'spray', x: -3.4, y: 0.55, z: -1.9, size: 1.1 }, { kind: 'dust', x: 3.6, y: 0.4, z: sz + 0.2 })
  lamp(b, -4.2, sz - 1.0)
  lamp(b, 4.3, -2.3)
  office(b, def.offices[0].at[0], def.offices[0].at[1])
  return b
}
