import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ITEMS,
  ROAD_WIDTH,
  addCorner,
  blockSize,
  canRemovePoint,
  diffItems,
  itemActivity,
  itemsFrom,
  lineLength,
  moveItem,
  movePoint,
  removePoint,
  roadRibbon,
  rotateItem,
  snapPoint,
  spineZ,
  treeRow,
  type MapItem,
} from './mapItems'
import { GRID, WORLD, insideOctagon } from './world'
import { rectOf } from './zones'

const byId = (uuid: string) => DEFAULT_ITEMS.find((i) => i.uuid === uuid)!
const zone = (kind: MapItem['kind']) => DEFAULT_ITEMS.find((i) => i.kind === kind)!

describe('Live site map items', () => {
  it('defaults: unique fixed v4 ids, all on the map; the coastal highway runs past the octagon', () => {
    expect(new Set(DEFAULT_ITEMS.map((i) => i.uuid)).size).toBe(DEFAULT_ITEMS.length)
    for (const i of DEFAULT_ITEMS) {
      expect(i.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      for (const [x, z] of i.points ?? [[i.x!, i.z!]]) {
        expect(Math.abs(x)).toBeLessThanOrEqual(WORLD)
        expect(z).toBeLessThanOrEqual(GRID)
      }
    }
    const coastal = DEFAULT_ITEMS.filter((i) => i.kind === 'highway')[0]
    expect(coastal.points!.every(([x, z]) => !insideOctagon(x, z))).toBe(true)
    expect(lineLength(coastal.points!)).toBeGreaterThan(300)
  })

  it('the layout reads north to south: land → spine road → basin → floating city', () => {
    const spine = DEFAULT_ITEMS.filter((i) => i.kind === 'highway')[1].points!
    // edge to edge through the middle, with a gentle curve
    expect(Math.min(...spine.map((p) => p[0]))).toBeLessThan(-GRID)
    expect(Math.max(...spine.map((p) => p[0]))).toBeGreaterThan(GRID)
    expect(Math.min(...spine.map((p) => p[1]))).toBeGreaterThan(-10)
    expect(spineZ(0)).toBeLessThan(spineZ(GRID))
    const industry = zone('industry').points!
    const basin = rectOf(zone('basin').points!)
    const port = rectOf(zone('port').points!)
    const city = zone('city').points!
    expect(Math.max(...industry.map((p) => p[1]))).toBeLessThan(Math.min(...spine.map((p) => p[1])))
    expect(basin.z0).toBeGreaterThan(Math.max(...spine.map((p) => p[1])))
    expect(Math.min(...city.map((p) => p[1]))).toBeGreaterThan(port.z1)
    // a long, narrow basin ≈ 60% of the octagon's width, open to the sea at its east end only
    expect((basin.x1 - basin.x0) / (2 * GRID)).toBeCloseTo(0.6, 1)
    expect(basin.z1 - basin.z0).toBeLessThan((basin.x1 - basin.x0) / 4)
    expect(basin.x1).toBe(port.x1)
    expect(basin.x0).toBeGreaterThan(port.x0)
    // the pier is at the basin mouth; the zones sit inside the octagon
    expect(zone('pier').points!.some(([x]) => x === basin.x1)).toBe(true)
    for (const k of ['industry', 'basin', 'pier', 'city'] as const) for (const [x, z] of zone(k).points!) expect([k, insideOctagon(x, z)]).toEqual([k, true])
  })

  it('snaps to half tiles and never off the map', () => {
    expect(snapPoint(3.26, -7.74)).toEqual([3.5, -7.5])
    expect(snapPoint(500, -500)).toEqual([WORLD, -WORLD])
    expect(snapPoint(0, 500)).toEqual([0, GRID])
  })

  it('tree rows, moving points, removing the last palm', () => {
    const row = treeRow([0, -10], [0, -20], 2)
    expect(row).toHaveLength(6)
    expect(row[0]).toEqual([0, -10])
    expect(row[5]).toEqual([0, -20])
    const trees: MapItem = { uuid: 't', kind: 'trees', points: [[1, -5]] }
    expect(movePoint(trees, 0, 2.1, -6.1).points).toEqual([[2, -6]])
    expect(removePoint(trees, 0)).toBeNull()
    const road: MapItem = { uuid: 'r', kind: 'road', points: [[0, -5], [4, -5], [4, -9]] }
    expect(removePoint(road, 1)?.points).toEqual([[0, -5], [4, -9]])
    expect(removePoint({ ...road, points: [[0, -5], [4, -5]] }, 0)).toBeNull()
  })

  it('moving keeps the shape and stays on the map; blocks turn', () => {
    const road: MapItem = { uuid: 'r', kind: 'road', points: [[0, -3], [6, -3]] }
    const moved = moveItem(road, 2, 1000)
    expect(moved.points!.every(([, z]) => z <= GRID)).toBe(true)
    expect(moved.points![1][0] - moved.points![0][0]).toBe(6)
    const camp: MapItem = { uuid: 'c', kind: 'camp', x: 0, z: -20, rot: 0 }
    expect(blockSize(camp)).toEqual([11, 7])
    expect(blockSize(rotateItem(camp))).toEqual([7, 11])
    const pushed = moveItem(camp, 0, 1000)
    expect(pushed.z! + blockSize(pushed)[1] / 2).toBeLessThanOrEqual(GRID)
  })

  it('zones: a rectangle stays a rectangle; polygons gain and lose corners', () => {
    const basin = zone('basin')
    // drag the south-east corner: the basin gets longer and wider, corners stay square
    const big = movePoint(basin, 2, 80, 30)
    expect(rectOf(big.points!)).toEqual({ x0: -50, z0: 8, x1: 80, z1: 30 })
    expect(big.points).toEqual([
      [-50, 8],
      [80, 8],
      [80, 30],
      [-50, 30],
    ])
    // it can't be flipped inside out or shrunk to nothing
    expect(rectOf(movePoint(basin, 2, -100, 0).points!)).toEqual({ x0: -50, z0: 8, x1: -46, z1: 12 })
    expect(canRemovePoint(basin)).toBe(false)
    expect(removePoint(basin, 0)).toBe(basin)
    // move the whole basin
    expect(rectOf(moveItem(basin, 0, 4).points!)).toEqual({ x0: -50, z0: 12, x1: 70, z1: 30 })
    const pier = zone('pier')
    const more = addCorner(pier, 0)
    expect(more.points).toHaveLength(4)
    expect(more.points![1]).toEqual([84.5, 24.5])
    expect(canRemovePoint(more)).toBe(true)
    expect(canRemovePoint(pier)).toBe(false)
    expect(removePoint(pier, 0)).toBeNull()
  })

  it('saved rows: replace defaults, hide removed ones, ignore broken rows, carry over old ones', () => {
    const coastal = DEFAULT_ITEMS[0]
    const camp = DEFAULT_ITEMS.find((i) => i.kind === 'camp')!
    const items = itemsFrom([
      { uuid: coastal.uuid, removed: true },
      { uuid: camp.uuid, kind: 'camp', x: -50, z: -30, rot: 1, v: 3 },
      { uuid: 'new', kind: 'road', points: [[1, -1], [5, -1]], v: 3 },
      { uuid: 'bad', kind: 'road', points: [[1, -1]], v: 3 },
      { uuid: 'odd', kind: 'tower', x: 0, z: 0, v: 3 },
      { uuid: 'thin', kind: 'basin', points: [[0, 0], [2, 0], [2, 9], [0, 9]], v: 3 },
      // drawn on the small octagon: old defaults are replaced, other drawings move with the sites
      { uuid: '6d3f6f0e-2c1a-4a8e-9b7e-3f1d2a5c7b01', kind: 'highway', points: [[-96, -0.5], [96, -0.5]] },
      { uuid: 'mine', kind: 'road', points: [[10, -2], [20, -2]] },
    ])
    expect(items.find((i) => i.uuid === coastal.uuid)).toBeUndefined()
    expect(items.find((i) => i.uuid === camp.uuid)).toMatchObject({ x: -50, z: -30, rot: 1 })
    expect(items.find((i) => i.uuid === 'new')).toBeTruthy()
    for (const gone of ['bad', 'odd', 'thin', '6d3f6f0e-2c1a-4a8e-9b7e-3f1d2a5c7b01']) expect(items.find((i) => i.uuid === gone)).toBeUndefined()
    expect(items.find((i) => i.uuid === 'mine')?.points).toEqual([
      [10, -8],
      [20, -8],
    ])
    expect(items.find((i) => i.kind === 'basin')).toBe(byId(zone('basin').uuid))
  })

  it('diff and activity wording', () => {
    const base = itemsFrom([])
    const trees = base.find((i) => i.kind === 'trees')!
    const draft = base
      .filter((i) => i.kind !== 'village')
      .map((i) => (i.uuid === trees.uuid ? { ...i, points: [...i.points!, [9, -60] as [number, number]] } : i))
      .concat([{ uuid: 'n', kind: 'road', points: [[0, -5], [3, -5]] }])
    const d = diffItems(base, draft)
    expect(d.added.map((i) => i.uuid)).toEqual(['n'])
    expect(d.changed.map((i) => i.uuid)).toEqual([trees.uuid])
    expect(d.removed.map((i) => i.kind)).toEqual(['village'])
    expect(itemActivity(d.changed[0], 'changed', trees)).toBe('Map · 1 palm tree planted')
    expect(itemActivity(d.added[0], 'added')).toBe('Map · road added')
    expect(itemActivity(d.removed[0], 'removed')).toBe('Map · village removed')
    expect(itemActivity(zone('basin'), 'changed')).toBe('Map · harbour basin changed')
  })

  it('road ribbon: two triangles per segment plus round corners', () => {
    const tris = roadRibbon([[0, 0], [4, 0], [4, 4]], ROAD_WIDTH.road, 8)
    expect(tris.length / 6).toBe(2 * 2 + 8)
    // the first quad is as wide as the road
    const zs = tris.slice(0, 6).filter((_, i) => i % 2 === 1)
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(ROAD_WIDTH.road)
  })
})
