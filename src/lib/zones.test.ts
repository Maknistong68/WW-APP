import { describe, expect, it } from 'vitest'
import { DEFAULT_ITEMS, ROAD_WIDTH, isLine } from './mapItems'
import { SITES, footprint } from './site'
import { inPoly, inRect, rectMinus, rectsOverlap } from './world'
import { DEFAULT_ZONE_SET as Z, cityBlocks, inCity, industryLots, isWater, landPieces, onLand, quayOf } from './zones'

describe('Live site zones', () => {
  it('what is land and what is water', () => {
    expect(onLand(Z, 0, -50)).toBe(true) // land half
    expect(onLand(Z, 0, 5)).toBe(true) // quay with the cranes
    expect(isWater(Z, 0, 15)).toBe(true) // harbour basin
    expect(isWater(Z, 0, 24)).toBe(true) // open harbour between the basin and the island
    expect(onLand(Z, 0, 35)).toBe(true) // island
    expect(onLand(Z, -80, 15)).toBe(true) // west yard
    expect(onLand(Z, -80, 40)).toBe(true) // island, joined to the land on the west
    expect(onLand(Z, -120, 30)).toBe(true) // the west coast closes that side
    expect(onLand(Z, 85, 10)).toBe(true) // east quay block
    expect(isWater(Z, 85, 30)).toBe(true) // the entrance, on the east
    expect(isWater(Z, 120, 30)).toBe(true) // open sea outside the entrance
    expect(isWater(Z, 0, 52)).toBe(true) // between the island and the floating city
    expect(inCity(Z, 0, 60)).toBe(true)
    expect(onLand(Z, 0, 60) || isWater(Z, 0, 60)).toBe(false) // the floating city isn't built yet
    expect(quayOf(Z)).toEqual({ z: 8, x0: -55, x1: 65 })
  })

  it('land pieces: port land as drawn, the basin cut out of anything it overlaps', () => {
    const { mainland, port } = landPieces(Z)
    expect(mainland).toHaveLength(1)
    expect(port).toEqual([
      { x0: -100, z0: 8, x1: -62, z1: 30 },
      { x0: -100, z0: 0, x1: 100, z1: 8 },
      { x0: 72, z0: 0, x1: 100, z1: 18 },
    ])
    // a basin moved north cuts into the quay strip
    const moved = landPieces({ ...Z, basin: [{ x0: -55, z0: 4, x1: 65, z1: 18 }] }).port
    expect(moved).toContainEqual({ x0: -100, z0: 0, x1: 100, z1: 4 })
    expect(rectMinus({ x0: 0, z0: 0, x1: 10, z1: 10 }, { x0: 20, z0: 0, x1: 30, z1: 10 })).toEqual([{ x0: 0, z0: 0, x1: 10, z1: 10 }])
    expect(rectMinus({ x0: 0, z0: 0, x1: 10, z1: 10 }, { x0: 2, z0: 2, x1: 8, z1: 8 })).toHaveLength(4)
  })

  it('floating city: a dense grid of blocks inside its outline, with water pockets, the same every time', () => {
    const poly = Z.city[0]
    const blocks = cityBlocks(poly)
    expect(blocks.length).toBeGreaterThan(50)
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
