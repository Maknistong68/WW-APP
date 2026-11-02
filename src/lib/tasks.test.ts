import { describe, expect, it } from 'vitest'
import { AREAS, areaLine, areaStatus, areaSummaries, areaTile, buildTasks, completedSince, taskMonths, tasksIn, type Task } from './tasks'
import type { AllData } from './kpiData'
import type { Camp, Contractor, Inspection, KpiMonth, Manpower, Routine, Ticket, WorkOrder } from '../types'
import { markAllIn, setDoc } from './submissions'

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
    cases: [],
    kpis: [],
    manpower: [],
    weekly: [],
    inspections: [],
    ...p,
  }
}
const docsIn = (workOrderUuid: string, month: string, p: Partial<KpiMonth> = {}) =>
  markAllIn({ contractorUuid: 'c1', workOrderUuid, month, ...p } as KpiMonth, '2026-11-05')
const allIn = (workOrderUuid: string, month: string) => ({
  kpis: [docsIn(workOrderUuid, month, { accommodationPct: 90, onboardingPct: 95, offboardingPct: 100, meetingPct: 100 })],
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

describe('Home tasks: documents and KPIs', () => {
  it('on 1 Nov, October is grouped under Later with its due dates', () => {
    const { tasks, counts } = buildTasks(base(), '2026-11-01')
    const decl = tasks.find((t) => t.key === 'declarations:2026-10')!
    expect([decl.group, decl.title, decl.dueText, decl.members?.length]).toEqual(['later', 'October documents', 'due 15 Nov', 2])
    expect(decl.detail).toBe('2 work orders · 11 documents each')
    expect(tasks.find((t) => t.key === 'kpis:2026-10')!.dueText).toBe('due 30 Nov')
    expect([counts.overdue, counts.week]).toEqual([0, 0])
  })
  it('from 8 Nov each work order is named under This week (work orders in number order)', () => {
    const week = buildTasks(base(), '2026-11-08').tasks.filter((t) => t.group === 'week' && t.kind === 'declarations')
    expect(week.map((t) => t.title)).toEqual(['RPCO · WO 882', 'RPCO · WO 1134'])
    expect([week[0].detail, week[0].dueText, week[0].sheet]).toEqual(['Oct: nothing in yet', 'due 15 Nov', 'submission'])
  })
  it('a work order part way says how many are in and names the first ones still missing', () => {
    const kpis = [setDoc(setDoc({ contractorUuid: 'c1', workOrderUuid: 'w1', month: '2026-10', wps: true } as KpiMonth, 'welfareReport', { state: 'in', on: '2026-11-03' }), 'waterTest', { state: 'na' })]
    const row = buildTasks(base({ kpis }), '2026-11-08').tasks.find((t) => t.kind === 'declarations' && t.title === 'RPCO · WO 882')!
    expect(row.detail).toBe('Oct: 2 of 10 in · Issue log, Manpower +6')
  })
  it('after the 15th the ones still missing are overdue, "1d late"', () => {
    const kpis = [docsIn('w1', '2026-10')]
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
  it('a document the contractor can’t provide is no longer chased, and the month can still be done', () => {
    const kpis = [allIn('w1', '2026-10').kpis[0], setDoc(allIn('w2', '2026-10').kpis[0], 'wps', { state: 'notProvided' })]
    const manpower = [...allIn('w1', '2026-10').manpower, ...allIn('w2', '2026-10').manpower]
    const { tasks } = buildTasks(base({ kpis, manpower }), '2026-11-20')
    expect(tasks.filter((t) => t.kind === 'declarations')).toEqual([])
    expect(tasks.find((t) => t.title === 'RPCO · WO 1134')?.detail).toBe('Oct all in · WPS not provided')
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
    expect(late.map((t) => t.title)).toEqual(['RPCO', 'RPCO', 'RPCO', 'RPCO', 'RPCO', 'More tickets over 30 days'])
    expect(late.slice(0, 5).map((t) => t.detail.split(' · ')[0])).toEqual(['WWCMPL-01', 'WWCMPL-02', 'WWCMPL-03', 'WWCMPL-04', 'WWCMPL-05'])
    expect(late[0].detail).toBe('WWCMPL-01 · Open 61 days · 3 workers')
    expect(late[5].dueText).toBe('1 more')
    expect(counts.overdue).toBe(6)
    const soon = tasks.find((t) => t.group === 'week' && t.kind === 'ticket')!
    expect([soon.title, soon.detail.startsWith('WWCMPL-07 · Turns 30 days on')]).toEqual(['RPCO', true])
  })
  it('cases get their own rows, cap and "more" row, marked for the Cases tab', () => {
    const hotline = ['01', '02', '03', '04', '05', '06'].map((n, i) => ticket(n, `2026-09-0${i + 1}`))
    const cases = ['11', '12', '13', '14', '15', '16', '17'].map((n, i) => ({ ...ticket(n, `2026-09-0${i + 1}`), ticketNo: `CASE-00${n}`, source: 'Internal' }) as Ticket)
    const { tasks, counts } = buildTasks(base({ tickets: hotline, cases }), '2026-11-01')
    const late = (tab: 'tickets' | 'internal') => tasks.filter((t) => t.group === 'overdue' && t.ticketSource === tab)
    expect(late('tickets').map((t) => t.kind)).toEqual(['ticket', 'ticket', 'ticket', 'ticket', 'ticket', 'tickets'])
    expect(late('internal').map((t) => t.kind)).toEqual(['ticket', 'ticket', 'ticket', 'ticket', 'ticket', 'tickets'])
    expect(late('internal')[0].detail.split(' · ')[0]).toBe('CASE-0011')
    const more = late('internal')[5]
    expect([more.title, more.dueText, more.to]).toEqual(['More cases over 30 days', '2 more', '/tickets?f=late&tab=internal'])
    expect(late('tickets')[5].to).toBe('/tickets?f=late')
    expect(counts.overdue).toBe(13)
  })
  it('a ticket row is named by the contractor\'s short name ("No contractor" when there is none)', () => {
    const long = { uuid: 'c2', name: 'Project Pioneers Contracting Company', active: true, aliases: [] } as unknown as Contractor
    const tickets = [{ ...ticket('08', '2026-09-01'), contractorUuid: 'c2' }, { ...ticket('09', '2026-09-02'), contractorUuid: '' }]
    const { tasks } = buildTasks(base({ tickets, contractors: [c1, long], byUuid: new Map([[c1.uuid, c1], [long.uuid, long]]) }), '2026-11-01')
    expect(tasks.filter((t) => t.kind === 'ticket').map((t) => t.title)).toEqual(['Project Pioneers', 'No contractor'])
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

describe('Home tasks: routine tasks the team added', () => {
  const routine = (p: Partial<Routine>): Routine => ({ uuid: 'r1', updatedAt: 'x', title: 'Camp walk', repeat: 'daily', start: '2026-10-28', doneThrough: '', notes: '', ...p })
  it('a daily task is due today under This week; ticked off, it comes back tomorrow under Later', () => {
    const row = buildTasks(base(), '2026-11-02', { routines: [routine({})] }).tasks.find((t) => t.kind === 'routine')!
    expect([row.key, row.group, row.dueText, row.detail]).toEqual(['routine:r1:2026-11-02', 'week', 'Today', 'Every day'])
    const next = buildTasks(base(), '2026-11-02', { routines: [routine({ doneThrough: '2026-11-02' })] }).tasks.find((t) => t.kind === 'routine')!
    expect([next.group, next.dueText]).toEqual(['later', 'due 3 Nov'])
  })
  it('a one-off that is done is gone; a missed weekly one is late', () => {
    expect(buildTasks(base(), '2026-11-02', { routines: [routine({ repeat: 'once', start: '2026-11-01', doneThrough: '2026-11-01' })] }).tasks.some((t) => t.kind === 'routine')).toBe(false)
    const late = buildTasks(base(), '2026-11-04', { routines: [routine({ repeat: 'weekly', start: '2026-10-26', doneThrough: '2026-10-26' })] }).tasks.find((t) => t.kind === 'routine')!
    expect([late.group, late.dueText, late.tone]).toEqual(['overdue', '2d late', 'bad'])
  })
  it('ticking one off counts as done since last look', () => {
    const before = buildTasks(base(), '2026-11-02', { routines: [routine({})] }).tasks
    const after = buildTasks(base(), '2026-11-02', { routines: [routine({ doneThrough: '2026-11-02' })] }).tasks
    expect(completedSince(before, after).map((t) => t.key)).toEqual(['routine:r1:2026-11-02'])
  })
})

describe('Home cards: the six areas', () => {
  const t = (p: Partial<Task>): Task =>
    ({ key: p.key ?? Math.random().toString(), kind: 'ticket', group: 'overdue', title: 'X', detail: '', due: null, dueText: '', tone: 'bad', icon: 'ticket', to: '', weight: 1, ...p }) as Task
  it('every kind but "done" belongs to one card, in the agreed order', () => {
    expect(AREAS.map((a) => a.key)).toEqual(['tickets', 'submission', 'kpis', 'accommodation', 'audits', 'tasks'])
    const list = [
      t({ kind: 'ticket' }),
      t({ kind: 'tickets', weight: 4 }),
      t({ kind: 'declarations' }),
      t({ kind: 'older' }),
      t({ kind: 'kpis' }),
      t({ kind: 'camp' }),
      t({ kind: 'draft', group: 'later' }),
      t({ kind: 'closeout' }),
      t({ kind: 'quarterly' }),
      t({ kind: 'routine' }),
      t({ kind: 'done', group: 'done' }),
    ]
    expect(tasksIn(list, 'tickets').map((x) => x.kind)).toEqual(['ticket', 'tickets'])
    expect(tasksIn(list, 'submission').map((x) => x.kind)).toEqual(['declarations', 'older'])
    expect(tasksIn(list, 'kpis').map((x) => x.kind)).toEqual(['kpis'])
    expect(tasksIn(list, 'accommodation').map((x) => x.kind)).toEqual(['camp', 'draft'])
    expect(tasksIn(list, 'audits').map((x) => x.kind)).toEqual(['closeout', 'quarterly'])
    expect(tasksIn(list, 'tasks').map((x) => x.kind)).toEqual(['routine'])
  })
  it('counts late / this week / later by weight, finds the next deadline and names the urgent ones', () => {
    const s = areaSummaries([
      t({ kind: 'declarations', group: 'overdue', title: 'RPCO · WO 882' }),
      t({ kind: 'declarations', group: 'overdue', title: 'RPCO · WO 1134' }),
      t({ kind: 'declarations', group: 'week', title: 'SAMA' }),
      t({ kind: 'older', group: 'overdue', title: 'Older months' }),
      t({ kind: 'declarations', group: 'later', weight: 5, due: '2026-12-15' }),
      t({ kind: 'declarations', group: 'later', weight: 2, due: '2026-12-01' }),
    ]).submission
    expect([s.late, s.week, s.later]).toEqual([3, 1, 7])
    expect(s.next).toBe('2026-12-01')
    expect(s.names).toEqual(['RPCO · WO 882', 'RPCO · WO 1134', 'Older months'])
    expect(s.more).toBe(1)
  })
  it('the card line says the most urgent thing', () => {
    const sum = (late: number, week: number, later: number, next: string | null = null) => ({ late, week, later, next, names: [], more: 0 })
    expect(areaLine(sum(3, 2, 0))).toEqual({ text: '3 late', tone: 'bad' })
    expect(areaLine(sum(0, 2, 1))).toEqual({ text: '2 this week', tone: 'warn' })
    expect(areaLine(sum(0, 0, 4, '2026-12-15'))).toEqual({ text: 'Next 15 Dec', tone: 'none' })
    expect(areaLine(sum(0, 0, 1))).toEqual({ text: '1 later', tone: 'none' })
    expect(areaLine(sum(0, 0, 0))).toEqual({ text: 'All done', tone: 'good' })
  })
  it('the card shows the most urgent count big, with its word', () => {
    const sum = (late: number, week: number, later: number, next: string | null = null) => ({ late, week, later, next, names: [], more: 0 })
    expect(areaStatus(sum(3, 2, 0))).toEqual({ n: 3, word: 'late', tone: 'bad' })
    expect(areaStatus(sum(0, 2, 1))).toEqual({ n: 2, word: 'this week', tone: 'warn' })
    expect(areaStatus(sum(0, 0, 4, '2026-12-15'))).toEqual({ n: null, word: 'Next 15 Dec', tone: 'none' })
    expect(areaStatus(sum(0, 0, 0))).toEqual({ n: null, word: 'All done', tone: 'good' })
  })
  it('a Home icon tile: a badge with the urgent count, or the next date under the name', () => {
    const sum = (late: number, week: number, later: number, next: string | null = null) => ({ late, week, later, next, names: [], more: 0 })
    expect(areaTile(sum(15, 1, 0))).toEqual({ badge: 15, sub: 'Late', tone: 'bad' })
    expect(areaTile(sum(0, 2, 1))).toEqual({ badge: 2, sub: 'This week', tone: 'warn' })
    expect(areaTile(sum(0, 0, 4, '2026-11-15'))).toEqual({ badge: null, sub: '15 Nov', tone: 'none' })
    expect(areaTile(sum(0, 0, 1))).toEqual({ badge: null, sub: '1 later', tone: 'none' })
    expect(areaTile(sum(0, 0, 0))).toEqual({ badge: null, sub: 'Done', tone: 'good' })
  })
  it('an empty list gives every card zeros', () => {
    const all = areaSummaries([])
    expect(Object.keys(all)).toEqual(['tickets', 'submission', 'kpis', 'accommodation', 'audits', 'tasks'])
    expect(all.tasks).toEqual({ late: 0, week: 0, later: 0, next: null, names: [], more: 0 })
  })
})
