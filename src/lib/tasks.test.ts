import { describe, expect, it } from 'vitest'
import { buildTasks, completedSince, taskMonths } from './tasks'
import type { AllData } from './kpiData'
import type { Camp, Contractor, Inspection, KpiMonth, Manpower, Ticket, WorkOrder } from '../types'

const c1 = { uuid: 'c1', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const wo = (uuid: string, number: string) => ({ uuid, contractorUuid: 'c1', number, label: '', active: true }) as WorkOrder
const base = (p: Partial<AllData> = {}): AllData => {
  const workOrders = [wo('w1', '882'), wo('w2', '1134')]
  return {
    loaded: true,
    contractors: [c1],
    byUuid: new Map([[c1.uuid, c1]]),
    workOrders,
    woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
    camps: [],
    tickets: [],
    kpis: [],
    manpower: [],
    weekly: [],
    inspections: [],
    ...p,
  }
}
const allIn = (workOrderUuid: string, month: string) => ({
  kpis: [
    { contractorUuid: 'c1', workOrderUuid, month, wps: true, manpowerDecl: true, salaryDecl: true, accommodationPct: 90, onboardingPct: 95, offboardTotal: 2, offboarded: 2, meetingPct: 100 },
  ] as KpiMonth[],
  manpower: [{ contractorUuid: 'c1', workOrderUuid, month, totalWorkers: 120, illegalOrFreelance: 0, visaExpiring30d: 0, paidRecruitmentFees: 0 }] as Manpower[],
})
const ticket = (uuid: string, openedAt: string): Ticket =>
  ({ uuid, ticketNo: `WWCMPL-${uuid}`, contractorUuid: 'c1', workOrderUuid: 'w1', issue: 'Salary delay', status: 'Open', openedAt, closedAt: '', workers: 3, parentUuid: '' }) as Ticket

describe('Home tasks: which months', () => {
  it('chases ended months from October 2026, newest first, at most 3', () => {
    expect(taskMonths('2026-10-20')).toEqual([])
    expect(taskMonths('2026-11-01')).toEqual(['2026-10'])
    expect(taskMonths('2027-03-02')).toEqual(['2027-02', '2027-01', '2026-12'])
  })
})

describe('Home tasks: declarations and KPIs', () => {
  it('on 1 Nov, October is grouped under Later with its due dates', () => {
    const { tasks, counts } = buildTasks(base(), '2026-11-01')
    const decl = tasks.find((t) => t.key === 'declarations:2026-10')!
    expect([decl.group, decl.title, decl.dueText, decl.members?.length]).toEqual(['later', 'October declarations', 'due 15 Nov', 2])
    expect(tasks.find((t) => t.key === 'kpis:2026-10')!.dueText).toBe('due 30 Nov')
    expect([counts.overdue, counts.week]).toEqual([0, 0])
  })
  it('from 8 Nov each work order is named under This week (work orders in number order)', () => {
    const week = buildTasks(base(), '2026-11-08').tasks.filter((t) => t.group === 'week' && t.kind === 'declarations')
    expect(week.map((t) => t.title)).toEqual(['RPCO · WO 882', 'RPCO · WO 1134'])
    expect([week[0].detail, week[0].dueText]).toEqual(['Oct: WPS, Manpower, Salary missing', 'due 15 Nov'])
  })
  it('after the 15th the ones still missing are overdue, "1d late"', () => {
    const kpis = [{ contractorUuid: 'c1', workOrderUuid: 'w1', month: '2026-10', wps: true, manpowerDecl: true, salaryDecl: true }] as KpiMonth[]
    const { tasks, counts } = buildTasks(base({ kpis }), '2026-11-16')
    const late = tasks.filter((t) => t.group === 'overdue' && t.kind === 'declarations')
    expect(late.map((t) => [t.title, t.dueText, t.tone])).toEqual([['RPCO · WO 1134', '1d late', 'bad']])
    expect(counts.overdue).toBe(1)
  })
  it('KPI rows list what is missing and fill in with the right sheet', () => {
    const kpis = [{ contractorUuid: 'c1', workOrderUuid: 'w1', month: '2026-10', accommodationPct: 90, onboardingPct: 90, offboardTotal: 1, offboarded: 1, meetingPct: 90 }] as KpiMonth[]
    const tasks = buildTasks(base({ kpis }), '2026-11-24').tasks.filter((t) => t.kind === 'kpis' && t.group === 'week')
    const w1 = tasks.find((t) => t.title === 'RPCO · WO 882')!
    expect([w1.detail, w1.sheet]).toEqual(['Oct: Workers missing', 'manpower'])
    expect(tasks.find((t) => t.title === 'RPCO · WO 1134')!.sheet).toBe('kpi')
  })
  it('a work order with everything in for October is Done, and progress counts it', () => {
    const { tasks, counts, progress } = buildTasks(base(allIn('w1', '2026-10')), '2026-11-08')
    const done = tasks.filter((t) => t.group === 'done')
    expect(done.map((t) => [t.title, t.detail])).toEqual([['RPCO · WO 882', 'Oct all in']])
    expect(counts.done).toBe(1)
    expect(progress).toEqual({ month: '2026-10', done: 6, total: 12 })
  })
  it('imported months before October 2026 never appear', () => {
    const kpis = [{ contractorUuid: 'c1', workOrderUuid: 'w1', month: '2026-08', wps: false }] as KpiMonth[]
    const { tasks } = buildTasks(base({ kpis }), '2026-11-20')
    expect(tasks.some((t) => /Aug|Sep/.test(`${t.title} ${t.detail}`))).toBe(false)
  })
})

describe('Home tasks: tickets, camps, drafts', () => {
  it('tickets over 30 days are named (oldest first, up to 5, then one "more" row); ones turning 30 this week too', () => {
    const tickets = ['01', '02', '03', '04', '05', '06'].map((n, i) => ticket(n, `2026-09-0${i + 1}`)).concat(ticket('07', '2026-10-06'))
    const { tasks, counts } = buildTasks(base({ tickets }), '2026-11-01')
    const late = tasks.filter((t) => t.group === 'overdue' && (t.kind === 'ticket' || t.kind === 'tickets'))
    expect(late.map((t) => t.title)).toEqual(['WWCMPL-01', 'WWCMPL-02', 'WWCMPL-03', 'WWCMPL-04', 'WWCMPL-05', 'More tickets over 30 days'])
    expect(late[5].dueText).toBe('1 more')
    expect(counts.overdue).toBe(6)
    const soon = tasks.find((t) => t.group === 'week' && t.kind === 'ticket')!
    expect([soon.title, soon.detail.startsWith('Turns 30 days on')]).toEqual(['WWCMPL-07', true])
  })
  it('a camp never inspected is overdue; a draft inspection waits under Later', () => {
    const camps = [{ uuid: 'p1', name: 'Camp 3', active: true, cycleDays: 90, contractorUuid: 'c1' } as Camp]
    const inspections = [{ id: 7, uuid: 'i7', status: 'draft', templateId: 'accommodation', info: { reviewDate: '2026-10-31', contractorNames: 'RPCO', facilityLocation: 'Camp 1' }, responses: {} } as unknown as Inspection]
    const { tasks } = buildTasks(base({ camps, inspections }), '2026-11-01')
    const camp = tasks.find((t) => t.kind === 'camp')!
    expect([camp.group, camp.title, camp.detail]).toEqual(['overdue', 'Camp 3', 'Never inspected'])
    const draft = tasks.find((t) => t.kind === 'draft')!
    expect([draft.group, draft.dueText]).toEqual(['later', 'Continue'])
  })
})

describe('Home tasks: done since last look', () => {
  it('finds the tasks (and grouped members) that are gone now', () => {
    const before = buildTasks(base(), '2026-11-08').tasks
    const after = buildTasks(base(allIn('w1', '2026-10')), '2026-11-08').tasks
    expect(completedSince(before, after).map((t) => t.key)).toEqual(['decl:2026-10:w1', 'kpis:2026-10:w1'])
  })
})
