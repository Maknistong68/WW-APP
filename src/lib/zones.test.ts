import { describe, expect, it } from 'vitest'
import { DEFAULT_ITEMS, ROAD_WIDTH, isLine } from './mapItems'
import { SITES, footprint } from './site'
import { inPoly, inRect, rectMinus, rectsOverlap } from './world'
import { DEFAULT_ZONE_SET as Z, cityBlocks, inCity, industryLots, isWater, landPieces, onLand, quayOf } from './zones'

describe('Live site zones', () => {
  it('what is land and what is water', () => {
    expect(onLand(Z, 0, -50)).toBe(true) // land half
    expect(onLand(Z, 0, -5)).toBe(true) // spine road
    expect(onLand(Z, 0, 5)).toBe(true) // quay next to the road
    expect(isWater(Z, 0, 15)).toBe(true) // harbour basin
    expect(onLand(Z, 0, 30)).toBe(true) // basin's south side
    expect(onLand(Z, -80, 15)).toBe(true) // port land west of the basin
    expect(isWater(Z, 85, 10)).toBe(true) // open to the sea east of the basin
    expect(onLand(Z, 80, 28)).toBe(true) // entrance pier
    expect(isWater(Z, 0, 34.5)).toBe(true) // channel before the floating city
    expect(inCity(Z, 0, 60)).toBe(true)
    expect(onLand(Z, 0, 60) || isWater(Z, 0, 60)).toBe(false) // the floating city isn't built yet
    expect(isWater(Z, 130, 10)).toBe(true) // open sea outside the octagon
    expect(quayOf(Z)).toEqual({ z: 8, x0: -50, x1: 70 })
  })

  it('land pieces: the basin cut out of the port land, open to the east', () => {
    const { mainland, port } = landPieces(Z)
    expect(mainland).toHaveLength(1)
    expect(port).toEqual([
      { x0: -100, z0: 0, x1: 70, z1: 8 },
      { x0: -100, z0: 26, x1: 70, z1: 32 },
      { x0: -100, z0: 8, x1: -50, z1: 26 },
    ])
    expect(rectMinus({ x0: 0, z0: 0, x1: 10, z1: 10 }, { x0: 20, z0: 0, x1: 30, z1: 10 })).toEqual([{ x0: 0, z0: 0, x1: 10, z1: 10 }])
    expect(rectMinus({ x0: 0, z0: 0, x1: 10, z1: 10 }, { x0: 2, z0: 2, x1: 8, z1: 8 })).toHaveLength(4)
  })

  it('floating city: a dense grid of blocks inside its outline, with water pockets, the same every time', () => {
    const poly = Z.city[0]
    const blocks = cityBlocks(poly)
    expect(blocks.length).toBeGreaterThan(80)
    for (const b of blocks) for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z1], [b.x0, b.z1], [b.x1, b.z0]]) expect(inPoly(poly, x, z)).toBe(true)
    // some squares are left as water
    const xs = poly.map((p) => p[0])
    const area = (Math.max(...xs) - Math.min(...xs)) * 60
    expect(blocks.length).toBeLessThan(area / 64)
    expect(cityBlocks(poly)).toEqual(blocks)
  })

  it('industrial lots: inside the zone, on land, off the roads and the sites', () => {
    const sites = SITES.map((s) => footprint(s, s.home))
    const roads = DEFAULT_ITEMS.filter((i) => isLine(i.kind)).map((i) => ({ points: i.points!, width: ROAD_WIDTH[i.kind as 'road' | 'highway'] }))
    const lots = industryLots(Z, sites, roads)
    expect(lots.length).toBeGreaterThan(30)
    for (const l of lots) {
      expect(inPoly(Z.industry[0], l.x0, l.z0) && inPoly(Z.industry[0], l.x1, l.z1)).toBe(true)
      expect(sites.some((s) => rectsOverlap(s, l))).toBe(false)
      for (const r of roads) for (const [x, z] of r.points) expect(inRect(l, x, z)).toBe(false)
    }
    expect(new Set(lots.map((l) => l.kind)).size).toBe(5)
  })
})
