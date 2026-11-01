import { describe, expect, it } from 'vitest'
import { nextDir, type DirState } from './scroll'

const run = (ys: number[], max = 2000) => {
  let s: DirState = { dir: 'up', anchor: 0 }
  return ys.map((y) => (s = nextDir(s, y, max)).dir)
}

describe('scroll direction', () => {
  it('turns down after a real move down, and up after a real move up', () => {
    expect(run([10, 14, 30, 200])).toEqual(['up', 'up', 'down', 'down'])
    expect(run([10, 40, 44])).toEqual(['up', 'down', 'down'])
    expect(run([10, 300, 296, 280])).toEqual(['up', 'down', 'down', 'up'])
  })
  it('always shows the bars near the top and the bottom', () => {
    expect(run([300, 10])).toEqual(['down', 'up'])
    expect(run([300, 1990])).toEqual(['down', 'up'])
  })
  it('a short page never hides the bars', () => {
    expect(run([40, 60], 60)).toEqual(['up', 'up'])
  })
})
