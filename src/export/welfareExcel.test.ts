import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildWelfareWorkbook, welfareFileName } from './welfareExcel'
import { welfareAudit } from '../templates/welfareAudit'
import type { ComplianceAssessment, Inspection } from '../types'

const nos = new Set(['F4', 'F5', 'F6', 'F7', 'F8'])
const pick = (code: string): ComplianceAssessment => (code === 'B7' ? 'N/A' : nos.has(code) ? 'No compliance' : 'Full compliance')
const audit: Inspection = {
  id: 3, uuid: 'a3', templateId: 'welfare_audit', status: 'completed', createdAt: '', updatedAt: '', notes: 'Payslips to be fixed by month end.',
  info: {
    reviewDate: '2026-11-12', contractorNames: 'RPCO', workOrder: '882', project: 'Package 1 residential', facilityLocation: 'Site office',
    auditor: 'WW team', inspectionNo: 'WWA-2026-Q4-882', clientRep: 'Client WW lead', contractorRep: 'Contractor HSE', approvedBy: 'WW manager',
  } as Inspection['info'],
  responses: Object.fromEntries(
    welfareAudit.sections.flatMap((s) => s.questions).map((q) => [
      q.code,
      { yesNo: '' as const, assessment: pick(q.code), observation: nos.has(q.code) ? 'Prohibited cost deductions from wages identified.' : '', actionPlan: q.code === 'F5' ? 'Refund within 30 days' : '' },
    ]),
  ),
}

/** Every cell's text in a sheet, row by row. */
async function read() {
  const wb = await buildWelfareWorkbook(welfareAudit, audit, [])
  const back = new ExcelJS.Workbook()
  await back.xlsx.load(await wb.xlsx.writeBuffer())
  const rows = (name: string) => {
    const out: string[][] = []
    back.getWorksheet(name)!.eachRow((row) => out.push((row.values as ExcelJS.CellValue[]).slice(1).map((v) => (v === null || v === undefined ? '' : String(v)))))
    return out
  }
  return { back, rows }
}

describe('Worker Welfare audit: the Excel in the client’s layout', () => {
  it('has the front page and the Worker Welfare sheet', async () => {
    const { back, rows } = await read()
    expect(back.worksheets.map((w) => w.name)).toEqual(['Front Page', 'Worker Welfare'])
    const front = rows('Front Page').flat().join(' | ')
    expect(front).toContain('WORKER WELFARE AUDIT REPORT 2026 - 4th Quarter')
    expect(front).toContain('RPCO - WO 882')
    expect(front).toContain('Verified by: Client WW lead')
    expect(front).toContain('Final score 96.8% · Excellent')
  })

  it('Part 1: every question with its weight and answer, each section with its score', async () => {
    const { rows } = await read()
    const all = rows('Worker Welfare')
    // a merged cell reads back in every column it spans: compare the distinct values
    const f5 = all.find((r) => r[1] === 'F5')!
    expect([...new Set(f5.filter(Boolean))]).toEqual(['F5', expect.stringContaining('deduction'), '1', 'No'])
    expect(all.find((r) => r[1] === 'B7')!.filter(Boolean).slice(-1)).toEqual(['N/A'])
    const sectionScores = all.filter((r) => r[1] === 'Section Score').map((r) => Number(r[8]))
    expect(sectionScores).toHaveLength(14)
    expect(sectionScores[5]).toBeCloseTo(6 / 11, 3)
  })

  it('Part 2: points and score per section, and the total final score (average of the sections)', async () => {
    const { rows } = await read()
    const all = rows('Worker Welfare')
    const total = all.find((r) => r[1] === 'TOTAL FINAL SCORE')!
    expect(Number(total[7])).toBeCloseTo(0.9675, 3)
    const f = all.find((r) => r[1] === 'F' && r[2] === 'Payment of workers')!
    expect([f[7], f[8]]).toEqual(['11', '6'])
  })

  it('Part 3: the five Nos with their comment and note, counted', async () => {
    const { rows } = await read()
    const all = rows('Worker Welfare')
    const part3 = all.slice(all.findIndex((r) => r[1] === 'SR#') + 1)
    const findings = part3.filter((r) => /^[A-N]\d+$/.test(r[1]))
    expect(findings.map((r) => r[1])).toEqual(['F4', 'F5', 'F6', 'F7', 'F8'])
    expect(findings[1][6]).toBe('Prohibited cost deductions from wages identified.\nAction: Refund within 30 days')
    expect(all.find((r) => r[1] === 'Number of Negative Observations:')![5]).toBe('5')
  })

  it('is named after the contractor, work order and date', () => {
    expect(welfareFileName(audit)).toBe('RPCO_WO882_Worker_Welfare_Audit_2026-11-12.xlsx')
  })
})
