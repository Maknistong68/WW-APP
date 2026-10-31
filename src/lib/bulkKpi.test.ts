import { describe, expect, it } from 'vitest'
import { emptyKpi, emptyManpower, fillKpiFromPrevious, fillManpowerFromPrevious, kpiHasData, parseCount, parsePct } from './bulkKpi'

describe('bulk KPI entry', () => {
  it('copies last month only into empty cells of the chosen column', () => {
    const prev = { ...emptyKpi('c', 'w', '2026-09'), accommodationPct: 80, wps: true, salaryDecl: true }
    const draft = { ...emptyKpi('c', 'w', '2026-10'), wps: false, salaryDecl: false, manpowerDecl: true }
    expect(fillKpiFromPrevious(draft, prev, 'accommodation')!.accommodationPct).toBe(80)
    const docs = fillKpiFromPrevious(draft, prev, 'docs')!
    expect([docs.wps, docs.manpowerDecl, docs.salaryDecl]).toEqual([true, true, true])
    expect(fillKpiFromPrevious({ ...draft, accommodationPct: 50 }, prev, 'accommodation')).toBeNull()
    expect(fillKpiFromPrevious(draft, undefined, 'accommodation')).toBeNull()
  })
  it('manpower copies totals only when empty', () => {
    const prev = { ...emptyManpower('c', 'w', '2026-09'), totalWorkers: 200, illegalOrFreelance: 5 }
    expect(fillManpowerFromPrevious(emptyManpower('c', 'w', '2026-10'), prev)).toMatchObject({ totalWorkers: 200, illegalOrFreelance: 5 })
    expect(fillManpowerFromPrevious({ ...emptyManpower('c', 'w', '2026-10'), totalWorkers: 10 }, prev)).toBeNull()
  })
  it('detects empty drafts and parses inputs', () => {
    expect(kpiHasData(emptyKpi('c', '', '2026-10'))).toBe(false)
    expect(kpiHasData({ ...emptyKpi('c', '', '2026-10'), meetingPct: 0 })).toBe(true)
    expect([parsePct('83'), parsePct(''), parsePct('120'), parsePct('7.5%')]).toEqual([83, null, 100, 7.5])
    expect([parseCount('12'), parseCount('')]).toEqual([12, null])
  })
})
