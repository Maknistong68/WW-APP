import { describe, expect, it } from 'vitest'
import { campInspections, campState, campsFromAudits } from './camps'
import type { Camp, Contractor, Inspection } from '../types'

const camp = (p: Partial<Camp> = {}): Camp => ({
  uuid: 'c1', updatedAt: '', name: 'Duba Camp 3', contractorUuid: '', workOrderUuid: '', location: '', cycleDays: 90, active: true, notes: '', ...p,
})
const ins = (date: string, p: Partial<Inspection> = {}, facility = 'Duba Camp 3'): Inspection =>
  ({ id: Math.random(), templateId: 'accommodation', status: 'completed', createdAt: '', updatedAt: '', responses: {}, notes: '', info: { reviewDate: date, facilityLocation: facility, contractorNames: 'Al Fahad', region: 'Oxagon' }, ...p }) as unknown as Inspection

describe('camps', () => {
  it('status by days since last inspection (90-day cycle, due in last 14 days)', () => {
    expect(campState(camp(), [], '2026-10-31').status).toBe('never')
    expect(campState(camp(), [ins('2026-10-01')], '2026-10-31')).toMatchObject({ status: 'ok', daysSince: 30, dueIn: 60 })
    expect(campState(camp(), [ins('2026-08-10')], '2026-10-31').status).toBe('due')
    expect(campState(camp(), [ins('2026-07-01')], '2026-10-31')).toMatchObject({ status: 'expired', dueIn: -32 })
  })
  it('log = linked inspections, or unlinked ones at the same facility name; newest first', () => {
    const list = [ins('2026-01-01'), ins('2026-05-01', { campUuid: 'c1' }), ins('2026-06-01', { campUuid: 'other' }), ins('2026-03-01', {}, 'Other camp')]
    expect(campInspections(camp(), list).map((i) => i.info.reviewDate)).toEqual(['2026-05-01', '2026-01-01'])
  })
  it('creates camps from audits once per facility', () => {
    const contractors = [{ uuid: 'af', name: 'Al Fahad', aliases: [] }] as unknown as Contractor[]
    let n = 0
    const out = campsFromAudits([ins('2026-01-01'), ins('2026-02-01'), ins('2026-02-01', {}, ' ')], [], contractors, () => `n${++n}`, 'now')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'Duba Camp 3', contractorUuid: 'af', cycleDays: 90 })
    expect(campsFromAudits([ins('2026-01-01')], [camp()], contractors, () => 'x', 'now')).toHaveLength(0)
  })
})
