import { describe, expect, it } from 'vitest'
import { isFollowed, kpiSubjects } from './subjects'
import type { Contractor, WorkOrder } from '../types'

const C = (active = true) => ({ uuid: 'c', name: 'TPD', active, aliases: [] }) as unknown as Contractor
const W = (uuid: string, active: boolean) => ({ uuid, contractorUuid: 'c', number: uuid, label: '', active }) as WorkOrder

describe('Followed contractors (Active list, KPIs, Home)', () => {
  const cases: [string, Contractor, WorkOrder[], boolean][] = [
    ['switched on, no work orders', C(), [], true],
    ['one active work order', C(), [W('892', true)], true],
    ['its only work order switched off (TPD)', C(), [W('892', false)], false],
    ['one on, one off', C(), [W('1', true), W('2', false)], true],
    ['contractor switched off, work order on', C(false), [W('1', true)], false],
  ]
  for (const [name, c, wos, want] of cases) {
    it(name, () => {
      expect(isFollowed(c, wos)).toBe(want)
      // same rule as what gets scored
      expect(kpiSubjects([c], wos).length > 0).toBe(want)
    })
  }
})
