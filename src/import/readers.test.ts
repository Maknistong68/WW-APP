import { describe, expect, it } from 'vitest'
import { detect, readGrids, type Grid } from './readers'
import { NEW, buildPlan } from './plan'

const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

const overall: Grid = {
  name: 'Overall',
  rows: [
    ['Details for Count of Ticket Closure'],
    ['Sr. No.', 'Date', 'Ticket No', 'Information Source', 'Type of Ticket', 'Contractors', 'Priority', 'Inspector', 'Proponent', 'Sub-Contractor', 'Type of Category', 'Type of violation', 'No of violations ', 'Issue 1', 'Severity', 'No Of Wokers Impacted', 'Ticket Closure', 'Closure Date', 'Violation'],
    [1, D(2026, 9, 1), 'WWCMPL0000001', 'Worker Hotline', 'Employment Practice', 'Alfahd Trading Industry & Contracting Co', '2-High', 'ASIM Jan', 'Oxagon', 'N/A', 'Off-Boarding', 'Employment', 1, 'Final Salary', 'Not Acceptable', 5, 'Closed', D(2026, 9, 6), 'Worker X Y unpaid'],
    [2, '16-12-2024 17:04:16', 'WWCMPL0000002', 'WhatsApp (Chatbot)', 'Accommodation', 'Al Fahad', '3 - Moderate', 'Asim Jan', 'Oxagon', 'NA', 'Liveability', 'Accommodation', 7, 'Fire Fighting System / Equipment', 'Not Acceptable', 36, 'Closed', '', ''],
    [3, D(2026, 10, 2), 'WWCMPL0000003', 'Welfare Internal', 'Employment Practice', 'RPCO', '2 - High', 'Asim Jan', 'Oxagon', 'Al Washeeh', 'salary not received', 'Employment Practice', 1, '', 'Not Acceptable', 4, 'Open', null],
    [4, D(2026, 10, 2), 'WWCMPL0000003', 'Welfare Internal', 'Employment Practice', 'RPCO', '2 - High', 'Asim Jan', 'Oxagon', 'Al Washeeh', 'salary not received', 'Employment Practice', 1, '', 'Not Acceptable', 6, 'Open', null],
  ],
}
// Weekly tab with a different layout; WWCMPL0000002 disappears after the 2nd week.
const weeklyHeader = ['Number', 'Contact channel', 'Primary proponent', 'Contractor', 'Sub-contractor', 'Priority', 'Significant Issues', 'Number of impacted workers', 'Number of violation instances', 'Assigned to', 'Violation category', 'Violation sub category', 'Violation severity', 'Opened Date']
const week = (name: string, nos: string[]): Grid => ({
  name,
  rows: [weeklyHeader, ...nos.map((n) => [n, 'Phone', 'Oxagon', 'Al Fahad', '', '2 - High', 'Final Salary', 3, 3, 'Asim Jan', 'Off-Boarding', 'Off-Boarding', 'Not Acceptable', D(2024, 12, 16)])],
})

describe('violation log reader', () => {
  const grids = [overall, week('05-JAN-2025', ['WWCMPL0000002', 'WWCMPL0000009']), week('12-Jan-2025', ['WWCMPL0000002']), week('19-JAN-2025', []), { name: 'Summary', rows: [] }]
  const r = readGrids(grids, '2026-10')

  it('detects the file and reads tickets by header text', () => {
    expect(detect(grids)).toBe('violationLog')
    expect(r.tickets.map((t) => t.ticketNo).sort()).toEqual(['WWCMPL0000001', 'WWCMPL0000002', 'WWCMPL0000003', 'WWCMPL0000009'])
    const t1 = r.tickets.find((t) => t.ticketNo === 'WWCMPL0000001')!
    expect(t1).toMatchObject({ issue: 'Final salary', category: 'Off-Boarding', priority: 2, workers: 5, status: 'Closed', closedAt: '2026-09-06', subcontractor: '', channel: 'Worker Hotline' })
    expect(JSON.stringify(t1)).not.toContain('Worker X Y')
  })
  it('merges duplicate rows (max workers) and reads text dates', () => {
    expect(r.tickets.find((t) => t.ticketNo === 'WWCMPL0000003')!.workers).toBe(6)
    expect(r.tickets.find((t) => t.ticketNo === 'WWCMPL0000002')!.openedAt).toBe('2024-12-16')
  })
  it('weekly counts per tab and estimated closing dates', () => {
    expect(r.weekly).toEqual([
      { weekEnding: '2025-01-05', openTickets: 2 },
      { weekEnding: '2025-01-12', openTickets: 1 },
      { weekEnding: '2025-01-19', openTickets: 0 },
    ])
    const t2 = r.tickets.find((t) => t.ticketNo === 'WWCMPL0000002')!
    expect(t2).toMatchObject({ closedAt: '2025-01-19', closedEstimated: true })
    // only in a weekly tab, gone from the latest → closed
    expect(r.tickets.find((t) => t.ticketNo === 'WWCMPL0000009')!.status).toBe('Closed')
  })
  it('plan: groups contractor spellings and unifies inspectors', () => {
    const plan = buildPlan([r], [])
    const fahad = plan.groups.find((g) => g.variants.includes('Al Fahad'))!
    expect(fahad.variants).toContain('Alfahd Trading Industry & Contracting Co')
    expect(fahad.target).toBe(NEW)
    expect(new Set(plan.tickets.map((t) => t.assignedTo))).toEqual(new Set(['Asim Jan']))
  })
})

describe('KPI system reader', () => {
  const grids: Grid[] = [
    { name: 'Dashboard', rows: [] },
    { name: 'Tracker', rows: [[], ['Month', 'Contractor', 'WPS Certificate Submitted', 'Manpower Declaration Submitted', 'Salary Declaration Submitted', 'Monthly Submission %', 'Accommodation %', 'Onboarding %', 'Offboarded Workers', 'Total Workers (Offboarding)', 'Offboarding %', 'Formal vs Illegal %', 'Monthly Meeting Attendance', 'Quartly initiative audit ', 'Overall KPI Score %'],
      [D(2026, 5, 1), 'Al Fahad-882', 'Yes', 'No', 'Yes', 0.5, 0.83, null, null, null, 0.75, 0.5, 1, 0.8, 0.56],
      [D(2026, 5, 1), '', '', '', 'Yes'],
      [D(2026, 12, 1), 'Al Fahad-882', 'Yes'],
      [D(2026, 6, 1), 'SAMA', '', '', '', 0, null],
    ] },
    { name: 'Contractors', rows: [[], ['Contractor Name', 'Status'], ['Al Fahad-882', 'Active'], ['SIBS', 'Inactive']] },
  ]
  it('reads inputs, skips future months and blank contractors', () => {
    const r = readGrids(grids, '2026-10')
    expect(r.kind).toBe('kpiSystem')
    expect(r.kpis).toHaveLength(1)
    expect(r.kpis[0]).toMatchObject({ contractor: 'Al Fahad-882', month: '2026-05', wps: true, manpowerDecl: false, accommodationPct: 83, offboardingPct: 75, formalPct: 50, meetingPct: 100, quarterlyAuditPct: 80 })
    expect(r.contractors).toEqual([{ name: 'Al Fahad-882', active: true }, { name: 'SIBS', active: false }])
    expect(r.skipped[0].reason).toContain('no contractor')
  })
})

describe('workforce file', () => {
  it('is never imported (personal data)', () => {
    const r = readGrids([{ name: 'Workforce Decalration ', rows: [] }], '2026-10')
    expect(r.kind).toBe('workforce')
    expect(r.tickets).toHaveLength(0)
  })
})
