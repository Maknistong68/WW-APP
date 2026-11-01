import { rng } from '../kit/build'
import type { Scope, SiteDef } from '../../lib/site'
import type { Builder, Built } from './common'
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

/** A site's models, built once (the same on every device). */
export function buildSite(def: SiteDef): Built {
  return BUILDERS[def.scope](def, rng(seedOf(def.id)))
}

export type { Built, FxSpec, WorkerSpec } from './common'
export { SEA_Y } from './common'
