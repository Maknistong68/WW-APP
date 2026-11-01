import { C } from '../kit/colors'
import type { Builder, Built } from './common'
import { built, clutter, cones, lamp, office, pad, pallet, pipeStack, rebar, yawTo } from './common'

const G = 0.07 // top of a site pad

// ---------------------------------------------------------------------------
// Al Fahad · earthworks: cutting back a mountain in benches
// ---------------------------------------------------------------------------
export const earthworks: Builder = (def, r) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  pad(b, -W, -D, W, D, C.dirt, C.dirtDark)
  // benches: fresh cut faces (light) at the front of each tier
  const tiers = [
    { x: -2, w: 11, z0: -4.4, z1: -0.2, y: G, h: 1.0 },
    { x: -2.4, w: 9.6, z0: -4.4, z1: -1.4, y: G + 1.0, h: 0.95 },
    { x: -2.8, w: 7.4, z0: -4.4, z1: -2.5, y: G + 1.95, h: 0.9 },
  ]
  for (const t of tiers) {
    k.box(t.w, t.h, t.z1 - t.z0, C.rock, { x: t.x, y: t.y, z: (t.z0 + t.z1) / 2 })
    k.box(t.w - 0.1, t.h - 0.04, 0.04, C.rockLight, { x: t.x, y: t.y, z: t.z1 + 0.01 })
    k.box(t.w, 0.03, 0.35, C.rockDark, { x: t.x, y: t.y + t.h, z: t.z1 - 0.18 })
  }
  // haul ramp down the right side and the natural rock on top
  k.wedge(1.6, 1.0, 3.2, C.rock, { x: 4.3, y: G, z: -2.6 })
  for (let i = 0; i < 9; i++) k.ball(0.45 + r() * 0.45, i % 2 ? C.rock : C.rockDark, { x: -6.2 + i * 0.85, y: G + 2.85 + r() * 0.2, z: -3.5 - r() * 0.6, ry: r() * 3 }, [1.2, 0.7, 1], 0)
  for (let i = 0; i < 6; i++) k.ball(0.35 + r() * 0.3, C.rockDark, { x: -7.6 + r() * 0.4, y: G + 0.3 + i * 0.4, z: -3.8 + i * 0.5 }, [1, 0.8, 1], 0)
  // spoil heap and haul road
  k.patch(-5.5, 0.6, 6.5, 2.9, G + 0.005, C.dirtDark)
  k.dome(1.3, C.dirtDark, { x: 5.4, y: G, z: 1.4 }, 9, 0.62).dome(0.8, C.dirt, { x: 6.4, y: G, z: 0.4 }, 8, 0.6)
  // machines
  b.machines.push(
    { kind: 'excavator', x: -4.6, z: 0.5, yaw: Math.PI / 2, p: [-1.7], phase: 0.1 },
    { kind: 'excavator', x: -1.4, z: -0.85, y: G + 1.0, yaw: Math.PI / 2, p: [1.6], phase: 0.55 },
    { kind: 'dumper', x: -3.2, z: 1.0, yaw: yawTo(-7.6, -0.4), path: { bx: 4.4, bz: 1.4, period: 17, pause: 0.16 }, phase: 0 },
    { kind: 'dumper', x: -3.0, z: 2.0, yaw: yawTo(-7.0, -0.2), path: { bx: 4.0, bz: 2.2, period: 17, pause: 0.16 }, phase: 0.5 },
    { kind: 'dozer', x: 1.6, z: 3.1, yaw: yawTo(2.6, -0.6), path: { bx: 4.2, bz: 2.5, period: 8, pause: 0.12 } },
  )
  b.workers.push({ x: 1.2, z: 3.8 }, { x: -6.2, z: 2.4, bx: -3.8, bz: 3.4, period: 9 }, { x: 0.2, z: -0.6, y: G + 1.0 })
  b.fx.push({ kind: 'dust', x: -4.6, y: 0.5, z: -0.4 }, { kind: 'dust', x: -1.4, y: 1.5, z: -1.7 }, { kind: 'dust', x: 5.0, y: 0.6, z: 1.6, size: 1.3 })
  lamp(b, -7.4, 3.9)
  lamp(b, 3.6, 4.0)
  office(b, def.offices[0].at[0], def.offices[0].at[1])
  return b
}

// ---------------------------------------------------------------------------
// PPCO · pipeline: a long right-of-way, trench, pipe string, pipelayers
// ---------------------------------------------------------------------------
export const pipeline: Builder = (def) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  pad(b, -W, -D, W, D, C.sand, C.sandDark)
  // buried section with marker posts, then the open trench and its spoil ridge
  k.patch(-15, 0.2, -6, 0.8, G + 0.006, C.dirt)
  for (let x = -14.5; x < -6; x += 2) k.box(0.06, 0.42, 0.06, C.orange, { x, y: G, z: 0.95 }).box(0.065, 0.08, 0.065, C.white, { x, y: G + 0.3, z: 0.95 })
  k.patch(-6, 0.22, 15.6, 0.8, G + 0.006, C.dirtDark)
  k.box(21.6, 0.24, 0.42, C.dirt, { x: 4.8, y: G, z: 1.1 })
  k.box(21.6, 0.04, 0.06, C.dirtDark, { x: 4.8, y: G, z: 0.2 })
  // lowered pipe in the trench (left) and the welded string on skids (right)
  k.tube(0.12, 8, C.pipe, [-2, G + 0.12, 0.5], 'x', 10)
  for (let x = -4.6; x < 14.6; x += 1.6) k.box(0.1, 0.12, 0.34, C.wood, { x, y: G, z: -0.7 })
  k.tube(0.13, 19.4, C.pipe, [5, G + 0.25, -0.7], 'x', 10)
  for (let x = -4.0; x < 14.6; x += 1.6) k.tube(0.135, 0.06, C.steelLight, [x, G + 0.25, -0.7], 'x', 10)
  pipeStack(b, -12, -0.75, 2.2)
  clutter(b, -14.6, -1.0)
  b.machines.push(
    { kind: 'pipelayer', x: -1.8, z: -0.22, yaw: 0, path: { bx: -0.4, bz: -0.22, period: 26, pause: 0.2 } },
    { kind: 'pipelayer', x: 1.0, z: -0.22, yaw: 0, path: { bx: 2.4, bz: -0.22, period: 26, pause: 0.2 }, phase: 0.35 },
    { kind: 'excavator', x: 13.4, z: -0.5, yaw: -Math.PI / 2, p: [1.3], phase: 0.3 },
    { kind: 'flatbed', x: -8.4, z: -0.9, yaw: 0 },
  )
  b.workers.push({ x: 5.0, z: -0.3 }, { x: 8.2, z: -0.3 }, { x: -4.2, z: -1.25, bx: 3.0, bz: -1.25, period: 16 }, { x: 11.8, z: 0.0 })
  b.fx.push({ kind: 'spark', x: 5.0, y: G + 0.3, z: -0.58 }, { kind: 'spark', x: 8.2, y: G + 0.3, z: -0.58 }, { kind: 'dust', x: 13.4, y: 0.4, z: 0.6 })
  lamp(b, -3.2, -1.3)
  lamp(b, 10.4, -1.3)
  office(b, def.offices[0].at[0], def.offices[0].at[1], 'z')
  return b
}

// ---------------------------------------------------------------------------
// Shapoorji · water reservoir: a big square tank under construction
// ---------------------------------------------------------------------------
export const reservoir: Builder = (def) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  pad(b, -W, -D, W, D, C.concreteDark, C.steelDark)
  const cz = -0.9
  const s = 2.7
  k.box(2 * s + 0.2, 0.12, 2 * s + 0.2, C.concrete, { z: cz, y: G })
  k.patch(-s + 0.25, cz - s + 0.25, s - 0.25, cz + s - 0.25, G + 0.125, C.concreteLight)
  k.patch(-s + 0.25, cz - s + 0.25, s - 0.25, cz - 0.6, G + 0.55, C.water)
  const y0 = G + 0.12
  const H = 1.7
  k.box(2 * s, H, 0.25, C.concreteLight, { y: y0, z: cz - s + 0.125 })
  k.box(0.25, H, 2 * s, C.concreteLight, { x: -s + 0.125, y: y0, z: cz })
  k.box(0.25, H, 2 * s, C.concreteLight, { x: s - 0.125, y: y0, z: cz })
  // front wall: right half done, left half still in formwork with rebar
  k.box(s, H, 0.25, C.concreteLight, { x: s / 2, y: y0, z: cz + s - 0.125 })
  k.box(s, 0.8, 0.25, C.concreteLight, { x: -s / 2, y: y0, z: cz + s - 0.125 })
  rebar(b, -s + 0.1, -0.1, cz + s - 0.125, y0 + 0.8, 0.7)
  for (let x = -s + 0.35; x < 0; x += 0.62) k.box(0.56, 0.9, 0.05, C.wood, { x, y: y0 + 0.8, z: cz + s + 0.03 }).box(0.56, 0.9, 0.05, C.wood, { x, y: y0 + 0.8, z: cz + s - 0.28 })
  for (const x of [-1.3, 0, 1.3]) for (const z of [cz - 1.3, cz, cz + 1.3]) k.box(0.18, H - 0.1, 0.18, C.concrete, { x, y: y0, z })
  // scaffold on the unfinished wall
  for (let x = -s; x <= 0.01; x += 0.9) k.box(0.04, 1.9, 0.04, C.steel, { x, y: G, z: cz + s + 0.38 })
  for (const y of [0.7, 1.3, 1.9]) k.box(s + 0.1, 0.04, 0.04, C.steel, { x: -s / 2, y: G + y, z: cz + s + 0.38 }).box(s + 0.1, 0.03, 0.3, C.wood, { x: -s / 2, y: G + y, z: cz + s + 0.25 })
  // concrete pump boom from the pump unit over the wall
  k.rbox(0.7, 0.4, 0.5, 0.05, C.orange, { x: -2.9, y: G, z: 3.0 })
  k.beam([-2.9, 0.5, 3.0], [-2.3, 2.6, 2.4], 0.1, 0.1, C.orange).beam([-2.3, 2.6, 2.4], [-1.4, 2.5, 1.9], 0.09, 0.09, C.orange).beam([-1.4, 2.5, 1.9], [-1.4, 1.9, 1.85], 0.07, 0.07, C.orange)
  pallet(b, 1.0, 3.3)
  pallet(b, -0.2, 3.5, C.rebar, 0.12)
  b.machines.push(
    { kind: 'mixer', x: -1.6, z: 3.1, yaw: 0 },
    { kind: 'towerCrane', x: 3.0, z: -3.5, yaw: 0, size: 0.7, p: [2.4, 3.7, 4.6, 2.2] },
  )
  b.workers.push({ x: -s + 0.12, z: cz - 1.5, y: y0 + H }, { x: -2.0, z: 2.35, bx: -0.4, bz: 2.35, period: 8 }, { x: 0.6, z: 2.6 })
  lamp(b, 3.2, 0.9)
  office(b, def.offices[0].at[0], def.offices[0].at[1])
  return b
}

// ---------------------------------------------------------------------------
// SIBS + Al Fahad 882 · nine three-storey buildings (interior + structure)
// ---------------------------------------------------------------------------
function building(b: Built, x: number, z: number, state: 'done' | 'frame' | 'shell', seed: number) {
  const k = b.solid
  const w = 2.4
  const d = 2.2
  const fh = 0.55
  k.box(w + 0.16, 0.08, d + 0.16, C.concrete, { x, y: G, z })
  const y0 = G + 0.08
  const floors = state === 'frame' ? 2 : 3
  k.box(w, fh * floors, d, state === 'shell' ? C.concreteLight : C.cream, { x, y: y0, z })
  for (let f = 1; f <= floors; f++) k.box(w + 0.04, 0.05, d + 0.04, C.concreteLight, { x, y: y0 + f * fh - 0.03, z })
  // windows on the visible faces (front +z, both sides)
  for (let f = 0; f < floors; f++) {
    const wy = y0 + f * fh + 0.17
    for (const dx of [-0.75, 0, 0.75]) {
      const lit = state === 'done' && (seed + f * 3 + Math.round(dx * 4)) % 4 === 0
      k.box(0.42, 0.24, 0.02, state === 'shell' ? C.black : lit ? C.windowGlow : C.glassDark, { x: x + dx, y: wy, z: z + d / 2 + 0.005 })
      if (state !== 'shell') b.glow.box(0.38, 0.2, 0.02, C.windowGlow, { x: x + dx, y: wy + 0.02, z: z + d / 2 + 0.015 })
    }
    for (const sx of [-1, 1]) {
      for (const dz of [-0.5, 0.5]) {
        k.box(0.02, 0.24, 0.42, state === 'shell' ? C.black : C.glassDark, { x: x + sx * (w / 2 + 0.005), y: wy, z: z + dz })
        if (state !== 'shell') b.glow.box(0.02, 0.2, 0.38, C.windowGlow, { x: x + sx * (w / 2 + 0.015), y: wy + 0.02, z: z + dz })
      }
    }
  }
  if (state === 'frame') {
    // third floor: bare columns, the roof slab and rebar; scaffolding on the front
    const yt = y0 + 2 * fh
    for (const cx of [-1.1, 0, 1.1]) for (const cz of [-1.0, 1.0]) k.box(0.12, fh, 0.12, C.concrete, { x: x + cx, y: yt, z: z + cz })
    k.box(w, 0.08, d, C.concrete, { x, y: yt + fh - 0.08, z })
    rebar(b, x - 1.1, x + 1.1, z - 1.0, yt + fh, 0.22)
    rebar(b, x - 1.1, x + 1.1, z + 1.0, yt + fh, 0.22)
    for (let sx = -1.2; sx <= 1.21; sx += 0.6) k.box(0.03, 1.8, 0.03, C.steel, { x: x + sx, y: G, z: z + d / 2 + 0.25 })
    for (const sy of [0.55, 1.1, 1.65]) k.box(w + 0.1, 0.03, 0.26, C.wood, { x, y: G + sy, z: z + d / 2 + 0.18 })
  } else {
    const yt = y0 + 3 * fh
    k.box(w + 0.04, 0.12, d + 0.04, C.concreteLight, { x, y: yt, z })
    k.box(w - 0.2, 0.02, d - 0.2, C.concreteDark, { x, y: yt + 0.1, z })
    k.box(0.4, 0.2, 0.3, C.steelLight, { x: x - 0.5, y: yt + 0.12, z: z - 0.3 }).tube(0.16, 0.3, C.white, [x + 0.6, yt + 0.27, z + 0.2], 'y', 8)
  }
}

export const buildings: Builder = (def) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  pad(b, -W, -D, W, D, C.concreteLight, C.concreteDark)
  b.solid.patch(-W + 0.2, 3.55, W - 0.2, 3.85, G + 0.005, C.concrete)
  const xs = [-3.2, 0, 3.2]
  const zs = [-3.5, -0.6, 2.3]
  let i = 0
  for (const z of zs) {
    for (const x of xs) {
      const state = i === 2 || i === 5 ? 'frame' : i === 8 ? 'shell' : 'done'
      building(b, x, z, state, i * 5 + 1)
      i++
    }
  }
  b.machines.push(
    { kind: 'towerCrane', x: 1.6, z: -2.05, yaw: 0, size: 0.85, p: [0.2, 1.6, 4.4, 2.2] },
    { kind: 'hoist', x: 4.6, z: -3.5, yaw: Math.PI, size: 0.6, p: [2.6] },
    { kind: 'hoist', x: 4.6, z: -0.6, yaw: Math.PI, size: 0.6, p: [2.6], phase: 0.5 },
    { kind: 'mixer', x: 0, z: 4.25, yaw: 0 },
  )
  b.workers.push(
    { x: -4.6, z: -2.0, bx: -4.6, bz: 1.2, period: 10 },
    { x: -1.6, z: 3.7, bx: 1.6, bz: 3.7, period: 9, phase: 0.3 },
    { x: 3.2, z: -0.6, y: G + 1.18 },
    { x: 2.6, z: -3.3, y: G + 1.18 },
    { x: -1.6, z: -2.05, bx: 1.0, bz: -2.05, period: 11, phase: 0.6 },
    { x: 1.6, z: 0.85 },
  )
  lamp(b, -4.65, -2.05)
  lamp(b, 4.7, 1.85)
  for (const o of def.offices) office(b, o.at[0], o.at[1])
  return b
}

// ---------------------------------------------------------------------------
// Abyatona 1112 · long excavation with an underground box culvert
// ---------------------------------------------------------------------------
export const culvert: Builder = (def) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  pad(b, -W, -D, W, D, C.dirt, C.dirtDark)
  const cx = -0.6
  k.patch(cx - 0.8, -D, cx + 0.8, D, G + 0.004, C.dirtDark)
  // banks (the trench walls) and steel trench boxes
  k.box(0.55, 0.32, 8.4, C.dirt, { x: -1.72, y: G, z: -0.8 }).box(0.5, 0.32, 8.4, C.dirt, { x: 0.45, y: G, z: -0.8 })
  for (const z of [1.2, 2.6]) k.box(0.04, 0.42, 1.2, C.steelDark, { x: cx - 0.78, y: G, z }).box(0.04, 0.42, 1.2, C.steelDark, { x: cx + 0.78, y: G, z })
  // laid culvert boxes, partly backfilled; spares on the side
  for (let z = -4.55; z < 0.6; z += 0.9) {
    k.box(1.12, 0.55, 0.86, C.concrete, { x: cx, y: G, z })
    k.box(1.14, 0.03, 0.04, C.concreteDark, { x: cx, y: G + 0.55, z: z + 0.44 })
  }
  k.box(0.8, 0.4, 0.02, C.black, { x: cx, y: G + 0.06, z: 0.89 })
  k.box(1.6, 0.36, 2.6, C.dirt, { x: cx, y: G + 0.3, z: -3.8 })
  k.box(0.86, 0.5, 1.1, C.concreteLight, { x: 1.35, y: G, z: -3.5 }).box(0.86, 0.5, 1.1, C.concreteLight, { x: 1.35, y: G + 0.5, z: -3.5 })
  b.machines.push(
    { kind: 'crawlerCraneBox', x: 1.3, z: 0.9, yaw: Math.PI, size: 0.7, p: [-0.2, 0.25, 4.2, 4.0] },
    { kind: 'excavator', x: 0.95, z: 2.6, yaw: Math.PI, p: [-1.5], phase: 0.4 },
  )
  b.workers.push({ x: cx, z: 1.7 }, { x: cx - 0.3, z: 0.9, bx: cx - 0.3, bz: -0.6, period: 7 }, { x: cx + 0.2, z: -1.4 })
  b.fx.push({ kind: 'dust', x: cx, y: 0.3, z: 2.6 })
  lamp(b, 1.6, -1.6)
  office(b, def.offices[0].at[0], def.offices[0].at[1], 'z')
  return b
}

// ---------------------------------------------------------------------------
// Thyssenkrupp · process plant: columns, spheres, tanks, pipe rack
// ---------------------------------------------------------------------------
function column(b: Built, x: number, z: number, h: number, r: number, done: boolean) {
  const k = b.solid
  k.box(r * 2 + 0.3, 0.2, r * 2 + 0.3, C.concrete, { x, y: G, z })
  k.tube(r, h, C.white, [x, G + 0.2 + h / 2, z], 'y', 12)
  for (let y = 1.0; y < h; y += 1.1) k.tube(r + 0.14, 0.04, C.yellowDark, [x, G + 0.2 + y, z], 'y', 12)
  k.box(0.06, h, 0.12, C.steelDark, { x: x + r + 0.04, y: G + 0.2, z })
  if (done) k.dome(r, C.white, { x, y: G + 0.2 + h, z }, 12, 0.6)
  else rebar(b, x - r * 0.6, x + r * 0.6, z, G + 0.2 + h, 0.2)
}

export const plant: Builder = (def) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  pad(b, -W, -D, W, D, C.concrete, C.concreteDark)
  column(b, -4.3, -3.3, 4.6, 0.42, true)
  column(b, -3.0, -3.8, 3.9, 0.38, true)
  column(b, -1.8, -3.3, 2.2, 0.42, false)
  // spheres on legs
  for (const x of [1.0, 2.9]) {
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) k.box(0.08, 1.0, 0.08, C.steelDark, { x: x + dx, y: G, z: -3.3 + dz })
    k.ball(0.85, C.white, { x, y: G + 1.55, z: -3.3 }, [1, 1, 1], 1)
  }
  for (const [x, z] of [[4.8, -3.6], [4.8, -2.0]]) k.tube(0.6, 1.4, C.steelLight, [x, G + 0.7, z], 'y', 12).dome(0.6, C.steelLight, { x, y: G + 1.4, z }, 12, 0.35)
  // pipe rack (right half) with pipes
  const rz = -1.2
  for (let x = 0.4; x <= 5.6; x += 1.3) {
    for (const dz of [-0.3, 0.3]) k.box(0.1, 1.7, 0.1, C.steelDark, { x, y: G, z: rz + dz })
    for (const y of [1.0, 1.6]) k.box(0.08, 0.06, 0.7, C.steelDark, { x, y: G + y, z: rz })
  }
  for (const [y, dz, col] of [[1.1, -0.18, C.pipe], [1.1, 0.12, C.steelLight], [1.7, -0.12, C.yellowDark], [1.7, 0.18, C.pipe]] as const) k.tube(0.07, 5.6, col, [3.0, G + y, rz + dz], 'x', 8)
  k.rod([0.4, G + 1.7, rz], [-3.0, G + 1.7, rz], 0.07, C.yellowDark).rod([-3.0, G + 1.7, rz], [-3.0, G + 1.7, -3.4], 0.07, C.yellowDark)
  k.rod([0.4, G + 1.1, rz - 0.18], [-4.3, G + 1.1, rz - 0.18], 0.07, C.pipe).rod([-4.3, G + 1.1, rz - 0.18], [-4.3, G + 1.1, -2.9], 0.07, C.pipe)
  // exchangers, cooling unit, control room
  for (const z of [0.6, 1.4]) {
    k.tube(0.26, 1.8, C.steelLight, [-3.6, G + 0.42, z], 'x', 10)
    for (const dx of [-0.6, 0.6]) k.box(0.12, 0.2, 0.4, C.concreteDark, { x: -3.6 + dx, y: G, z })
  }
  k.box(1.9, 0.6, 1.3, C.steelLight, { x: 2.2, y: G, z: 1.0 })
  for (const dx of [-0.45, 0.45]) k.tube(0.3, 0.04, C.black, [2.2 + dx, G + 0.62, 1.0], 'y', 10)
  k.box(1.9, 0.9, 1.3, C.cream, { x: -4.4, y: G, z: 3.3 }).box(2.0, 0.08, 1.4, C.concreteLight, { x: -4.4, y: G + 0.9, z: 3.3 })
  for (const dx of [-0.5, 0.2]) {
    k.box(0.34, 0.24, 0.02, C.glassDark, { x: -4.4 + dx, y: G + 0.4, z: 3.96 })
    b.glow.box(0.3, 0.2, 0.02, C.windowGlow, { x: -4.4 + dx, y: G + 0.42, z: 3.975 })
  }
  pipeStack(b, 0.4, 3.5, 2.0, 0.1, 3, C.steelLight)
  b.machines.push(
    { kind: 'crawlerCrane', x: -1.4, z: -0.6, yaw: yawTo(-0.4, -2.7), size: 0.95, p: [0, 1.2, 1.4, 3.6] },
    { kind: 'flatbed', x: 3.0, z: 3.4, yaw: 0 },
  )
  b.workers.push({ x: -3.75, z: -3.3, y: G + 2.02 }, { x: -0.5, z: 2.6, bx: 3.5, bz: 2.6, period: 12 }, { x: -1.7, z: -2.2 }, { x: 1.4, z: -1.9, bx: 4.4, bz: -1.9, period: 10, phase: 0.4 })
  b.fx.push({ kind: 'steam', x: 2.2, y: G + 0.8, z: 1.0, size: 1.2 }, { kind: 'steam', x: -4.3, y: G + 5.0, z: -3.3 })
  lamp(b, 5.6, -0.1)
  lamp(b, -5.6, 0.7)
  office(b, def.offices[0].at[0], def.offices[0].at[1])
  return b
}

// ---------------------------------------------------------------------------
// SAMA / RPCO · road works (asphalt paving / base course)
// ---------------------------------------------------------------------------
export const road: Builder = (def) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  pad(b, -W, -D, W, D, C.sand, C.sandDark)
  const ox = def.offices[0].at[0]
  const x0 = ox < 0 ? -W + 1.7 : -W
  const x1 = ox < 0 ? W : W - 1.7
  const hw = 0.9
  const strip = (a: number, c: number, color: string, y = G + 0.01) => k.box(c - a, 0.03, hw * 2, color, { x: (a + c) / 2, y, z: 0 })
  const kerbs = (a: number, c: number) => {
    for (const z of [-hw - 0.06, hw + 0.06]) k.box(c - a, 0.08, 0.1, C.concreteLight, { x: (a + c) / 2, y: G, z })
  }
  const dashes = (a: number, c: number) => {
    for (let x = a + 0.3; x < c - 0.3; x += 0.9) k.patch(x, -0.04, x + 0.45, 0.04, G + 0.045, C.marking)
  }
  if (def.variant === 'pave') {
    const done = x0 + (x1 - x0) * 0.5
    const fresh = done + 1.9
    strip(x0, done, C.asphalt)
    strip(done, fresh, C.asphaltFresh, G + 0.012)
    strip(fresh, x1, C.concreteDark)
    kerbs(x0, done)
    dashes(x0, done)
    cones(b, done - 1, -1.1, x1 - 0.3, -1.1, 9)
    cones(b, done - 1, 1.1, x1 - 0.3, 1.1, 9)
    b.machines.push(
      { kind: 'paver', x: fresh + 0.1, z: 0, yaw: 0, path: { bx: fresh + 1.2, bz: 0, period: 30, pause: 0.12 } },
      { kind: 'roller', x: done - 0.4, z: -0.4, yaw: 0, path: { bx: fresh - 0.6, bz: -0.4, period: 7, pause: 0.1 } },
      { kind: 'roller', x: done - 2.2, z: 0.4, yaw: 0, path: { bx: done + 0.3, bz: 0.4, period: 9, pause: 0.1 }, phase: 0.4 },
      { kind: 'dumper', x: fresh + 2.1, z: 0, yaw: 0 },
    )
    b.workers.push({ x: fresh - 0.3, z: 0.75 }, { x: fresh - 0.4, z: -0.75, bx: fresh + 0.6, bz: -0.75, period: 6 }, { x: x1 - 0.6, z: 1.3, bx: x1 - 0.6, bz: -1.3, period: 8 })
    b.fx.push({ kind: 'steam', x: done + 0.9, y: G + 0.1, z: 0, size: 0.9 })
  } else {
    const done = x0 + 3
    const base = x0 + (x1 - x0) * 0.5
    strip(x0, done, C.asphalt)
    strip(done, base, C.concrete)
    strip(base, x1, C.dirt)
    kerbs(x0, done)
    dashes(x0, done)
    for (const z of [-0.45, 0.45]) k.box(x1 - base - 0.4, 0.1, 0.24, C.concreteDark, { x: (base + x1) / 2, y: G + 0.02, z })
    cones(b, done, -1.1, x1, -1.1, 9)
    cones(b, done, 1.1, x1, 1.1, 9)
    b.machines.push(
      { kind: 'grader', x: base - 0.5, z: 0.2, yaw: 0, path: { bx: x1 - 1.4, bz: 0.2, period: 12, pause: 0.12 } },
      { kind: 'roller', x: done + 0.6, z: -0.35, yaw: 0, path: { bx: base - 1.2, bz: -0.35, period: 8, pause: 0.1 } },
      { kind: 'tanker', x: base + 0.6, z: -0.5, yaw: 0, path: { bx: x1 - 1.2, bz: -0.5, period: 14, pause: 0.12 }, phase: 0.3 },
    )
    b.workers.push({ x: done + 0.4, z: 1.3, bx: base, bz: 1.3, period: 10 }, { x: x1 - 0.5, z: -1.3 }, { x: base, z: 1.25 })
    b.fx.push({ kind: 'dust', x: (base + x1) / 2, y: 0.2, z: 0.2, size: 1.2 })
  }
  lamp(b, ox < 0 ? ox + 0.8 : ox - 0.8, -1.2)
  office(b, ox, def.offices[0].at[1], 'z')
  return b
}

// ---------------------------------------------------------------------------
// Abyatona 1134 · bridge over the channel
// ---------------------------------------------------------------------------
export const bridge: Builder = (def, r) => {
  const b = built()
  const W = def.w / 2
  const D = def.d / 2
  const k = b.solid
  pad(b, -W, -D, W, D, C.dirt, C.dirtDark)
  const cx = -0.6
  k.patch(cx - 0.8, -D, cx + 0.8, D, G + 0.004, C.dirtDark)
  for (const side of [-1, 1]) for (let z = -D + 0.2; z < D; z += 0.45) k.ball(0.14 + r() * 0.08, C.rock, { x: cx + side * 0.82, y: G + 0.06, z }, [1, 0.7, 1], 0)
  const deckY = G + 0.6
  const a0 = cx - 1.3
  const a1 = cx + 1.3
  for (const x of [a0, a1]) k.box(0.5, 0.6, 2.0, C.concrete, { x, y: G, z: 0 })
  k.box(0.36, 0.6, 1.6, C.concrete, { x: cx, y: G, z: 0 }).box(0.5, 0.08, 1.9, C.concreteDark, { x: cx, y: G + 0.52, z: 0 })
  // half the deck cast, the other half still girders and rebar
  k.box(a1 - a0 + 0.5, 0.12, 0.92, C.concrete, { x: cx, y: deckY, z: -0.45 })
  k.box(a1 - a0 + 0.5, 0.16, 0.08, C.concreteLight, { x: cx, y: deckY + 0.12, z: -0.92 })
  for (const z of [0.12, 0.38, 0.64, 0.86]) k.box(a1 - a0 + 0.5, 0.12, 0.1, C.concreteLight, { x: cx, y: deckY, z })
  for (let x = a0; x <= a1; x += 0.3) k.box(0.02, 0.02, 0.86, C.rebar, { x, y: deckY + 0.13, z: 0.47 })
  k.patch(a0 - 0.25, -0.88, a1 + 0.25, -0.02, deckY + 0.125, C.asphalt)
  // approach ramps to the roads on both sides
  k.wedge(a0 - 0.25 + W, 0.6, 1.8, C.asphalt, { x: (-W + a0 - 0.25) / 2, y: G, ry: Math.PI })
  k.wedge(W - a1 - 0.25, 0.6, 1.8, C.asphalt, { x: (a1 + 0.25 + W) / 2, y: G })
  b.machines.push({ kind: 'crawlerCraneBox', x: -2.3, z: 1.75, yaw: 0, size: 0.5, p: [0, 0.6, 4.3, 3.2] })
  b.workers.push({ x: a0, z: -0.4, y: deckY + 0.12, bx: a1, bz: -0.4, period: 9 }, { x: cx, z: 0.5, y: deckY + 0.12 })
  lamp(b, 2.6, -2.0)
  office(b, def.offices[0].at[0], def.offices[0].at[1])
  return b
}
