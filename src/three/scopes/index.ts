import { rng } from '../kit/build'
import type { Scope, SiteDef } from '../../lib/site'
import type { Builder, Built } from './common'
import { SEA_Y, barricade } from './common'
import { localShore } from '../../lib/site'
import { C } from '../kit/colors'
import { bridge, buildings, culvert, earthworks, pipeline, plant, reservoir, road } from './land'
import { coastGuard, port, seawall } from './coast'

const BUILDERS: Record<Scope, Builder> = {
  earthworks,
  pipeline,
  reservoir,
  buildings,
  culvert,
  plant,
  road,
  bridge,
  coastGuard,
  port,
  seawall,
}

const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** A site's models, built once (the same on every device), barricaded all round. */
export function buildSite(def: SiteDef): Built {
  const b = BUILDERS[def.scope](def, rng(seedOf(def.id)))
  if (def.terrain === 'shore') {
    // a concrete platform under the building half, so it stands firm where it reaches over the water
    const z0 = -def.d / 2
    const z1 = localShore(def)
    b.solid.box(def.w, -SEA_Y + 0.3, z1 - z0, C.concreteDark, { y: SEA_Y - 0.3, z: (z0 + z1) / 2 })
  }
  barricade(b, def)
  return b
}

export type { Built, FxSpec, WorkerSpec } from './common'
export { SEA_Y } from './common'
