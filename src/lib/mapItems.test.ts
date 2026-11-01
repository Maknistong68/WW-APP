import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ITEMS,
  ROAD_WIDTH,
  blockSize,
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
  treeRow,
  type MapItem,
} from './mapItems'
import { SHORE, WORLD, insideOctagon } from './site'

describe('Live site map items', () => {
  it('defaults: unique fixed ids, all on land, the highway runs outside the octagon', () => {
    expect(new Set(DEFAULT_ITEMS.map((i) => i.uuid)).size).toBe(DEFAULT_ITEMS.length)
    for (const i of DEFAULT_ITEMS) {
      for (const [x, z] of i.points ?? [[i.x!, i.z!]]) {
        expect(Math.abs(x)).toBeLessThanOrEqual(WORLD)
        expect(z).toBeLessThan(SHORE)
      }
    }
    const hw = DEFAULT_ITEMS.find((i) => i.kind === 'highway')!
    expect(hw.points!.every(([x, z]) => !insideOctagon(x, z))).toBe(true)
    expect(lineLength(hw.points!)).toBeGreaterThan(150)
  })

  it('snaps to half tiles and never into the sea or off the map', () => {
    expect(snapPoint(3.26, -7.74)).toEqual([3.5, -7.5])
    expect(snapPoint(3, 12)[1]).toBeLessThan(SHORE)
    expect(snapPoint(500, -500)).toEqual([WORLD, -WORLD])
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

  it('moving a road keeps it on land; blocks turn and stay on land', () => {
    const road: MapItem = { uuid: 'r', kind: 'road', points: [[0, -3], [6, -3]] }
    const moved = moveItem(road, 2, 10)
    expect(moved.points!.every(([, z]) => z < SHORE)).toBe(true)
    expect(moved.points![1][0] - moved.points![0][0]).toBe(6)
    const camp: MapItem = { uuid: 'c', kind: 'camp', x: 0, z: -20, rot: 0 }
    expect(blockSize(camp)).toEqual([11, 7])
    expect(blockSize(rotateItem(camp))).toEqual([7, 11])
    const pushed = moveItem(camp, 0, 40)
    expect(pushed.z! + blockSize(pushed)[1] / 2).toBeLessThan(SHORE)
  })

  it('saved rows: replace defaults, hide removed ones, ignore broken rows, keep new ones', () => {
    const hw = DEFAULT_ITEMS[0]
    const items = itemsFrom([
      { uuid: hw.uuid, removed: true },
      { uuid: DEFAULT_ITEMS[2].uuid, kind: 'camp', x: -50, z: -30, rot: 1 },
      { uuid: 'new', kind: 'road', points: [[1, -1], [5, -1]] },
      { uuid: 'bad', kind: 'road', points: [[1, -1]] },
      { uuid: 'odd', kind: 'tower' as never, x: 0, z: 0 },
    ])
    expect(items.find((i) => i.uuid === hw.uuid)).toBeUndefined()
    expect(items.find((i) => i.uuid === DEFAULT_ITEMS[2].uuid)).toMatchObject({ x: -50, z: -30, rot: 1 })
    expect(items.find((i) => i.uuid === 'new')).toBeTruthy()
    expect(items.find((i) => i.uuid === 'bad')).toBeUndefined()
    expect(items.find((i) => i.uuid === 'odd')).toBeUndefined()
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
  })

  it('road ribbon: two triangles per segment plus round corners', () => {
    const tris = roadRibbon([[0, 0], [4, 0], [4, 4]], ROAD_WIDTH.road, 8)
    expect(tris.length / 6).toBe(2 * 2 + 8)
    // the first quad is as wide as the road
    const zs = tris.slice(0, 6).filter((_, i) => i % 2 === 1)
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(ROAD_WIDTH.road)
  })
})
