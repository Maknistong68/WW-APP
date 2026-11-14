import ExcelJS from 'exceljs'
import type { ComplianceAssessment, Inspection, InspectionTemplate, Photo } from '../types'
import { gradeOf, scoreInspection } from '../lib/score'
import { loadPhotos, parseDate, withSizes, type PhotoWithSize } from './common'

// The Worker Welfare audit as the client's workbook lays it out:
//   Front Page   — the report title, contractor and work order, project, sign-off;
//   Worker Welfare — PART 1 the checklist (code, question, weight, answer, each
//                    section's score), PART 2 the score summary (each section's
//                    points and score, the total final score, the grade bands),
//                    PART 3 the findings (each "No" with its comment, note and photos).
// Amber headers (#FFC000), Arial 9, the grade bands in their colours.

const AMBER = 'FFFFC000'
const BAND: { min: number; label: string; range: string; argb: string }[] = [
  { min: 90, label: 'Excellent', range: '90–100%', argb: 'FF00B050' },
  { min: 80, label: 'Good', range: '80–89%', argb: 'FF92D050' },
  { min: 70, label: 'Partially compliant', range: '70–79%', argb: 'FFFFFF00' },
  { min: 60, label: 'Minimally compliant', range: '60–69%', argb: 'FFFFC000' },
  { min: 0, label: 'Non-compliant', range: 'Below 60%', argb: 'FFFF6B5F' },
]
const ANSWER: Record<ComplianceAssessment, string> = { '': '', 'Full compliance': 'Full', 'Partial compliance': 'Partial', 'No compliance': 'No', 'N/A': 'N/A' }
const ORDINAL = ['1st', '2nd', '3rd', '4th']

const thin = { style: 'thin' as const }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }
const fill = (argb: string): ExcelJS.FillPattern => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const font = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: 'Arial', size: 9, ...o })
/** Rough height (pt) for `text` wrapped in a box `chars` wide. */
const rowHeight = (text: string, chars: number, min = 15) => Math.max(min, Math.ceil(text.length / chars) * 12 + 4)

/** "Q4 2026" → { year: 2026, label: '4th Quarter' } from the audit date. */
function quarter(date: string) {
  const d = parseDate(date)
  return { year: d.getFullYear(), label: `${ORDINAL[Math.floor(d.getMonth() / 3)]} Quarter` }
}

const safe = (s: string) => s.trim().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'Contractor'

export const welfareFileName = (ins: Inspection) =>
  `${safe(ins.info.contractorNames)}${ins.info.workOrder ? `_WO${safe(ins.info.workOrder)}` : ''}_Worker_Welfare_Audit_${ins.info.reviewDate || 'undated'}.xlsx`

/** The workbook (photos given, so it can be built anywhere; the app passes the audit's photos). */
export async function buildWelfareWorkbook(template: InspectionTemplate, ins: Inspection, photos: PhotoWithSize[]): Promise<ExcelJS.Workbook> {
  const score = scoreInspection(template, ins)
  const info = ins.info
  const q = quarter(info.reviewDate)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'WW Co-pilot'
  wb.created = new Date()

  // ---- Front page ------------------------------------------------------------------
  const fp = wb.addWorksheet('Front Page', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 } })
  fp.columns = [{ width: 1 }, ...Array.from({ length: 9 }, () => ({ width: 11 }))]
  const line = (row: number, text: string, f: Partial<ExcelJS.Font>, from = 'B', to = 'J', fillArgb?: string) => {
    fp.mergeCells(`${from}${row}:${to}${row}`)
    const c = fp.getCell(`${from}${row}`)
    c.value = text
    c.font = font(f)
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    if (fillArgb) c.fill = fill(fillArgb)
  }
  line(5, `WORKER WELFARE AUDIT REPORT ${q.year} - ${q.label}`, { size: 14, bold: true }, 'B', 'J', AMBER)
  fp.getRow(5).height = 28
  line(9, score.pct === null ? 'Not scored' : `Final score ${Math.round(score.pct * 10) / 10}% · ${gradeOf(score.pct)}`, { size: 16, bold: true })
  fp.getRow(9).height = 26
  line(28, `${info.contractorNames}${info.workOrder ? ` - WO ${info.workOrder}` : ''}`, { size: 11 })
  line(29, info.project ?? '', { size: 11 })
  line(30, info.facilityLocation ?? '', { size: 11 })
  line(32, 'CLIENT REPRESENTATIVE', { size: 12, bold: true }, 'B', 'E')
  line(32, 'CONTRACTOR REPRESENTATIVE', { size: 12, bold: true }, 'G', 'J')
  line(34, `Verified by: ${info.clientRep ?? ''}`, { size: 10 }, 'B', 'E')
  line(34, `Verified by: ${info.contractorRep ?? ''}`, { size: 10 }, 'G', 'J')
  line(37, 'APPROVED BY', { size: 12, bold: true })
  line(39, `Approved by: ${info.approvedBy ?? ''}`, { size: 10 })
  line(42, [info.inspectionNo && `Inspection no. ${info.inspectionNo}`, info.reviewDate && `Audit date ${info.reviewDate}`, info.auditor && `Auditor ${info.auditor}`].filter(Boolean).join(' · '), { size: 9 })

  // ---- Worker Welfare: Part 1, 2, 3 ---------------------------------------------------
  const ws = wb.addWorksheet('Worker Welfare', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  // A margin · B code · C–H question · I weight · J answer · K photo evidence (Part 3)
  ws.columns = [{ width: 1 }, { width: 6 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 8 }, { width: 11 }, { width: 34 }]
  let r = 1
  const merged = (from: string, to: string, value: ExcelJS.CellValue, f: Partial<ExcelJS.Font> = {}, align: Partial<ExcelJS.Alignment> = {}) => {
    if (from !== to) ws.mergeCells(`${from}${r}:${to}${r}`)
    const c = ws.getCell(`${from}${r}`)
    c.value = value
    c.font = font(f)
    c.alignment = { vertical: 'middle', wrapText: true, ...align }
    return c
  }
  const head = (cols: [string, string, string][]) => {
    for (const [from, to, text] of cols) {
      const c = merged(from, to, text, { bold: true }, { horizontal: 'center' })
      c.fill = fill(AMBER)
      for (const col of colsBetween(from, to)) ws.getCell(`${col}${r}`).border = BORDER
    }
  }
  const details = () => {
    for (const [a, av, b, bv] of [
      ['Project:', info.project ?? '', 'Date:', info.reviewDate],
      ['Location:', info.facilityLocation ?? '', 'Inspection No.:', info.inspectionNo ?? ''],
      ['Auditor:', info.auditor ?? info.auditTeam ?? '', 'Contact No.:', info.contactNo ?? ''],
    ]) {
      merged('B', 'C', a, { size: 11, bold: true })
      merged('D', 'F', av, { size: 10 })
      merged('G', 'G', b, { size: 11, bold: true })
      merged('H', 'J', bv, { size: 10 })
      r++
    }
  }
  const title = (text: string) => {
    merged('B', 'J', text, { size: 14, bold: true }, { horizontal: 'center' })
    ws.getRow(r).height = 22
    r++
  }
  const part = (label: string, note: string) => {
    merged('B', 'C', label, { size: 8, bold: true }, { horizontal: 'center' })
    merged('D', 'J', note, { size: 8 })
    ws.getRow(r).height = rowHeight(note, 90, 24)
    r += 2
  }

  title('Worker’s Welfare Inspection Checklist')
  details()
  r++
  part(
    'PART 1',
    'This section contains the inspection checklist, where each item has a weighted score: ‘Full’ if complied (points gained), ‘Partial’ if partly complied (50% of the points), ‘No’ if not complied (no points), and ‘N/A’ if not applicable (left out of the total possible score). Every ‘No’ is listed with its comment and evidence in Part 3.',
  )
  for (const section of template.sections) {
    head([
      ['B', 'B', section.letter],
      ['C', 'H', section.title.toUpperCase()],
      ['I', 'I', 'Weight'],
      ['J', 'J', 'Compliance'],
    ])
    r++
    for (const qq of section.questions) {
      const a = ANSWER[ins.responses[qq.code]?.assessment ?? '']
      merged('B', 'B', qq.code, {}, { horizontal: 'center' }).border = BORDER
      merged('C', 'H', qq.text)
      for (const col of colsBetween('C', 'H')) ws.getCell(`${col}${r}`).border = BORDER
      merged('I', 'I', qq.weight ?? 1, {}, { horizontal: 'center' }).border = BORDER
      const ans = merged('J', 'J', a, { bold: true, color: { argb: a === 'No' ? 'FFC62828' : a === 'Partial' ? 'FFB45309' : 'FF000000' } }, { horizontal: 'center' })
      ans.border = BORDER
      ws.getRow(r).height = rowHeight(qq.text, 72)
      r++
    }
    const s = score.sections?.find((x) => x.letter === section.letter)
    merged('B', 'H', 'Section Score', { bold: true }, { horizontal: 'center' })
    const sc = merged('I', 'J', s?.pct == null ? 'N/A' : s.pct / 100, { bold: true }, { horizontal: 'center' })
    sc.numFmt = '0.0%'
    r += 2
  }

  // Part 2: the summary
  title('Inspection Score Summary')
  details()
  r++
  part('PART 2', 'Each section’s points scored out of the points possible (N/A left out), and the total final score: the average of the section scores.')
  head([
    ['B', 'G', 'Inspection Program Areas'],
    ['H', 'H', 'Points possible'],
    ['I', 'I', 'Points scored'],
    ['J', 'J', 'Final Score'],
  ])
  ws.getRow(r).height = 26
  r++
  for (const s of score.sections ?? []) {
    merged('B', 'B', s.letter, { size: 10, bold: true }, { horizontal: 'center' }).border = BORDER
    merged('C', 'G', s.title, { size: 10, bold: true })
    merged('H', 'H', s.possible, {}, { horizontal: 'center' }).border = BORDER
    merged('I', 'I', s.points, {}, { horizontal: 'center' }).border = BORDER
    const c = merged('J', 'J', s.pct == null ? 'N/A' : s.pct / 100, { bold: true }, { horizontal: 'center' })
    c.numFmt = '0.0%'
    c.border = BORDER
    r++
  }
  merged('B', 'G', 'TOTAL FINAL SCORE', { size: 11, bold: true }, { horizontal: 'center' })
  const total = merged('H', 'J', score.pct === null ? 'N/A' : score.pct / 100, { size: 11, bold: true }, { horizontal: 'center' })
  total.numFmt = '0.00%'
  total.border = BORDER
  ws.getRow(r).height = 22
  r += 2
  const grade = gradeOf(score.pct)
  for (const b of BAND) {
    merged('E', 'G', b.label, { size: 9, bold: b.label === grade }, { horizontal: 'right' })
    const c = merged('H', 'I', b.range, { size: 9, bold: b.label === grade }, { horizontal: 'center' })
    c.fill = fill(b.argb)
    if (b.label === grade) {
      c.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } }
      merged('J', 'J', '◀ this audit', { size: 9, bold: true })
    }
    r++
  }
  r += 2

  // Part 3: the findings
  title('Summary of Findings')
  details()
  r++
  part('PART 3', 'The inspection findings: every ‘No’ with its comment, the note or action, and the photo evidence. Other comments follow.')
  const order = template.sections.flatMap((s) => s.questions)
  const nos = order.filter((qq) => ins.responses[qq.code]?.assessment === 'No compliance')
  const others = order.filter((qq) => {
    const resp = ins.responses[qq.code]
    return resp && resp.assessment !== 'No compliance' && !!resp.observation.trim()
  })
  merged('B', 'E', 'Number of Negative Observations:', { size: 9, bold: true })
  merged('F', 'F', nos.length, { size: 9, bold: true }, { horizontal: 'center' })
  merged('G', 'I', 'Number of Positive Observations:', { size: 9, bold: true })
  merged('J', 'J', others.length, { size: 9, bold: true }, { horizontal: 'center' })
  r += 2
  head([
    ['B', 'B', 'SR#'],
    ['C', 'F', 'Observation Notes'],
    ['G', 'J', 'Observation / Comment'],
    ['K', 'K', 'Evidence (Photo)'],
  ])
  r++
  const byItem = new Map<string, PhotoWithSize[]>()
  for (const p of photos) {
    if (!p.photo.itemId) continue
    byItem.set(p.photo.itemId, [...(byItem.get(p.photo.itemId) ?? []), p])
  }
  const findingRow = (code: string, text: string) => {
    const resp = ins.responses[code]
    const comment = [resp?.observation?.trim(), resp?.actionPlan?.trim() && `Action: ${resp.actionPlan.trim()}`].filter(Boolean).join('\n')
    merged('B', 'B', code, { bold: true }, { horizontal: 'center' }).border = BORDER
    merged('C', 'F', text)
    merged('G', 'J', comment)
    const shots = byItem.get(code) ?? []
    const height = Math.max(rowHeight(text, 44, 30), rowHeight(comment, 50, 30), shots.length ? 96 : 0)
    ws.getRow(r).height = height
    // up to two photos side by side in the Evidence column, each fitted into 115 × 120 px, keeping its shape
    shots.slice(0, 2).forEach((s, i) => {
      const k = Math.min(115 / s.width, 120 / s.height)
      const id = wb.addImage({ buffer: s.buffer, extension: 'jpeg' })
      ws.addImage(id, { tl: { col: 10 + i * 0.5, row: r - 1 + 0.05 }, ext: { width: Math.round(s.width * k), height: Math.round(s.height * k) } })
    })
    if (shots.length > 2) ws.getCell(`K${r}`).value = `+${shots.length - 2} more photos in the app`
    for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']) ws.getCell(`${col}${r}`).border = BORDER
    r++
  }
  for (const qq of nos) findingRow(qq.code, qq.text)
  if (others.length) {
    r++
    merged('B', 'K', 'Other observations', { bold: true })
    r++
    for (const qq of others) findingRow(qq.code, qq.text)
  }
  if (ins.notes?.trim()) {
    r++
    merged('B', 'K', `Conclusion: ${ins.notes.trim()}`, { size: 9 })
    ws.getRow(r).height = rowHeight(ins.notes, 120, 20)
  }
  return wb
}

function colsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) out.push(String.fromCharCode(c))
  return out
}

/** The app's download: the audit's own photos, the workbook, its file name. */
export async function buildWelfareExcel(template: InspectionTemplate, ins: Inspection): Promise<{ blob: Blob; fileName: string }> {
  const photos: Photo[] = ins.id === undefined ? [] : (await loadPhotos(ins.id)).filter((p) => p.itemId && ins.responses[p.itemId])
  const wb = await buildWelfareWorkbook(template, ins, await withSizes(photos))
  const buf = await wb.xlsx.writeBuffer()
  return {
    blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName: welfareFileName(ins),
  }
}
