import ExcelJS from 'exceljs'
import type { Inspection, InspectionTemplate, Section } from '../types'
import { assessmentPct, assessmentScore, isFinding } from '../lib/score'
import {
  excelFileName,
  facilityPhotos,
  loadPhotos,
  parseDate,
  questionPhotos,
  withSizes,
} from './common'

// Reproduces the official workbook layout 1:1
// ("AL FAHD Workers Camp Welfare Inspection Report"):
// Cover · Table of Contents · General Information · Assessment Scale ·
// Assessment Questionnaire · Summary of observations · Photo Evidence.
// Only the content (answers, observations, photos, general info) changes.

const NAVY = 'FF003865'
const GOLD = 'FFEBC03F'
const CREAM = 'FFFEF8E3'
const GRAY = 'FFCCCCCC'
const WHITE = 'FFFFFFFF'

const FMT_DATE_LONG = '[$-409]mmmm\\ d\\,\\ yyyy'
const FMT_DATE_SHORT = '[$-409]d\\-mmm\\-yy;@'
const FMT_DATE_DDMMM = '[$-409]dd\\-mmm\\-yy;@'

type Cell = ExcelJS.Cell

const thin = { style: 'thin' as const }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }

const fill = (argb: string): ExcelJS.FillPattern => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
})

const font = (opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({
  name: 'Arial',
  size: 10,
  ...opts,
})

const sheetTitle = (cell: Cell, text: string, center = false) => {
  cell.value = text
  cell.font = font({ size: 14, bold: true, color: { argb: NAVY } })
  if (center) cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

const tableHeader = (cell: Cell, text: string) => {
  cell.value = text
  cell.font = font({ color: { argb: WHITE } })
  cell.fill = fill(NAVY)
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = BORDER
}

/** Rough height (pt) needed to render `text` wrapped inside `chars`-wide column. */
const wrapHeight = (text: string, chars: number, min = 15.75): number => {
  const lines = Math.max(
    1,
    ...text.split('\n').map(() => 0),
    text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / chars)), 0),
  )
  return Math.max(min, lines * 12.75 + 4)
}

const ifsScore = (e: string) =>
  `_xlfn.IFS(${e}="Full compliance",2,${e}="partial compliance",1,${e}="no compliance",0,${e}="N/A","-",${e}="","")`
const ifsOutOf100 = (f: string) => `_xlfn.IFS(${f}=2,100,${f}=1,50,${f}=0,0,${f}="-","-",${f}="","")`
// IFERROR keeps sections with no answers yet showing blank instead of #DIV/0!.
const ifsAssessment = (f: string) =>
  `IFERROR(_xlfn.IFS(${f}<1, "No compliance", ${f}<=1.5,"Partial compliance", ${f}>1.5,"Full compliance"),"")`
const safeAvg = (range: string) => `IFERROR(AVERAGE(${range}),"")`

interface SectionRows {
  section: Section
  headerRow: number
  firstQ: number
  lastQ: number
  scoreRow: number
}

export async function buildExcel(
  template: InspectionTemplate,
  inspection: Inspection,
): Promise<{ blob: Blob; fileName: string }> {
  const wb = new ExcelJS.Workbook()
  wb.creator = inspection.info.auditTeam || 'WW App'
  wb.created = new Date()

  const info = inspection.info
  const reviewDate = parseDate(info.reviewDate)
  const allPhotos = await loadPhotos(inspection.id!)

  // ---------------------------------------------------------------- Cover
  const cover = wb.addWorksheet('Cover', { views: [{ showGridLines: false }] })
  cover.getColumn(1).width = 2.6
  cover.getColumn(3).width = 14.9
  cover.getRow(1).height = 20.25
  for (let r = 2; r <= 42; r++) {
    cover.getRow(r).height = r === 6 ? 19.5 : 15.75
    for (let c = 1; c <= 8; c++) {
      cover.getCell(r, c).fill = fill(r >= 5 && r <= 9 ? NAVY : CREAM)
    }
  }
  const coverTitle = cover.getCell('C6')
  coverTitle.value = template.coverTitle
  coverTitle.font = font({ size: 16, bold: true, color: { argb: WHITE } })
  coverTitle.fill = fill(NAVY)
  const coverDate = cover.getCell('C7')
  coverDate.value = { formula: "'General Information'!C7" }
  coverDate.font = font({ bold: true, color: { argb: WHITE } })
  coverDate.fill = fill(NAVY)
  coverDate.numFmt = FMT_DATE_LONG

  // ----------------------------------------------------- Table of Contents
  const toc = wb.addWorksheet('Table of Contents', { views: [{ showGridLines: false }] })
  toc.getColumn(1).width = 3.1
  toc.getColumn(2).width = 2.6
  toc.getColumn(3).width = 32.9
  sheetTitle(toc.getCell('B4'), 'Table of Contents')
  const tocEntries = [
    '1.General Information',
    '2.Assessment Scale',
    '3.Summary of Observations',
    '4.Detailed Observations & Action plans',
    '5.Assessment Questionaire',
    '6.Photo Evidence',
  ]
  tocEntries.forEach((entry, i) => {
    const r = 6 + i
    toc.mergeCells(r, 3, r, 4)
    const cell = toc.getCell(r, 3)
    cell.value = entry
    cell.font = font()
    cell.border = { right: { style: 'dotted' }, bottom: { style: 'dotted' } }
  })

  // --------------------------------------------------- General Information
  const gi = wb.addWorksheet('General Information', { views: [{ showGridLines: false }] })
  gi.getColumn(1).width = 2.6
  gi.getColumn(2).width = 37.9
  gi.getColumn(3).width = 37.6
  gi.getColumn(4).width = 8.6
  sheetTitle(gi.getCell('B3'), '1. Report General Information')

  const giRows: Array<[string, ExcelJS.CellValue]> = [
    ['Type of review', info.typeOfReview],
    ['Review Date', reviewDate],
    ['Member(s) of the Audit team', info.auditTeam],
    ['Region', info.region],
    ['facility Location', info.facilityLocation],
    ['facility Type', info.facilityType],
    ['Map coordinates', info.mapCoordinates],
    ['Link for google maps', info.googleMapsLink],
    ['Facility Management', info.facilityManagement],
    ['Occupants Number', numOrText(info.occupantsNumber)],
    ['Number of Rooms', numOrText(info.numberOfRooms)],
    ['Maximum number of occupancy', numOrText(info.maxOccupancy)],
    ['facility occupancy level (as a percentage)', { formula: 'IFERROR(C15/C17,"")' }],
    ['Number of contractor(s) within the facility', numOrText(info.contractorsCount)],
    ['Name of Contractor(s)', info.contractorNames],
    ['Projects served by contractors in the facility', info.projectsServed],
    ['Facility Representative', info.facilityRepresentative],
  ]
  giRows.forEach(([label, value], i) => {
    const r = 6 + i
    const b = gi.getCell(r, 2)
    const c = gi.getCell(r, 3)
    b.value = label
    c.value = value
    for (const cell of [b, c]) {
      cell.font = font({ size: 9 })
      cell.border = BORDER
      cell.alignment = { horizontal: 'left', wrapText: true }
    }
    if (label === 'Review Date') c.numFmt = FMT_DATE_SHORT
    if (label.startsWith('facility occupancy')) c.numFmt = '0.00%'
    if (label === 'Link for google maps' && info.googleMapsLink) {
      c.value = { text: info.googleMapsLink, hyperlink: info.googleMapsLink }
      c.font = font({ size: 9, color: { argb: 'FF0563C1' }, underline: true })
    }
  })

  // Facility/site photos below the table (as in the sample report)
  const sitePhotos = await withSizes(facilityPhotos(allPhotos))
  let giAnchorRow = 24
  for (const { buffer, width, height } of sitePhotos) {
    const imgId = wb.addImage({ buffer, extension: 'jpeg' })
    const displayW = 340
    const displayH = Math.round((height / width) * displayW)
    gi.addImage(imgId, {
      tl: { col: 1, row: giAnchorRow - 1 },
      ext: { width: displayW, height: displayH },
    })
    giAnchorRow += Math.ceil(displayH / 21) + 2
  }

  // ------------------------------------------------------ Assessment Scale
  const scale = wb.addWorksheet('Assessment Scale', { views: [{ showGridLines: false }] })
  scale.getColumn(1).width = 2.6
  scale.getColumn(2).width = 18.4
  scale.getColumn(3).width = 43.4
  scale.getColumn(4).width = 8.4
  scale.getColumn(5).width = 15.9
  scale.getColumn(6).width = 15.9
  sheetTitle(scale.getCell('B3'), '2. Assessment Scale')

  const firstLetter = template.sections[0].letter
  const lastLetter = template.sections[template.sections.length - 1].letter
  const scaleIntro = `The questionnaire is divided into ${template.sections.length} sections which are from Section ${firstLetter} to Section ${lastLetter}, each section has questions that must be answered as Yes, No, or Not Applicable, in addition to assigning a risk assessment to the criteria of the question as a full compliance, Partial compliance, no compliance or not applicable. `
  scale.mergeCells('B5:E5')
  const b5 = scale.getCell('B5')
  b5.value = scaleIntro
  b5.font = font()
  b5.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  scale.getRow(5).height = 52

  scale.getCell('B7').value = 'Calculation of Section Compliance Rate'
  scale.getCell('B7').font = font({ bold: true, color: { argb: NAVY } })
  scale.mergeCells('B8:E8')
  const b8 = scale.getCell('B8')
  b8.value =
    'For each section, the risk points are totaled and divided by the number of questions in the section to give \na risk rating for the section. The method of calculation is an average of the questions risk rates.'
  b8.font = font()
  b8.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  scale.getRow(8).height = 30

  scale.getCell('B10').value = 'Calculation of Overall Compliance Score'
  scale.getCell('B10').font = font({ bold: true, color: { argb: NAVY } })
  scale.mergeCells('B11:E11')
  const b11 = scale.getCell('B11')
  b11.value =
    'The Risk Rate for all sections are totaled and divided by number of sections to give an Overall Risk Score.\nThe method of calculation is an average of the Sections Risk Rates.'
  b11.font = font()
  b11.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  scale.getRow(11).height = 30

  tableHeader(scale.getCell('B13'), 'Compliance Assessment')
  scale.mergeCells('C13:D13')
  tableHeader(scale.getCell('C13'), 'Description')
  tableHeader(scale.getCell('E13'), 'Compliance score')
  tableHeader(scale.getCell('F13'), 'Score (Out of 100)')
  const scaleRows: Array<[string, string, number | string, number | string]> = [
    [
      'Full compliance',
      'The camp is supporting or implementing all of the portions of the question criteria which are defined to be required.',
      2,
      100,
    ],
    [
      'Partial compliance',
      'The camp is not supporting or implementing all of the portions of the question criteria which are defined to be required.',
      1,
      50,
    ],
    ['No compliance', 'The camp is not supporting or implementing any portions of the question criteria.', 0, 0],
    ['Not applicable', 'The question criteria does not apply to the camp.', '-', '-'],
  ]
  scaleRows.forEach((rowVals, i) => {
    const r = 14 + i
    scale.mergeCells(r, 3, r, 4)
    const cells = [scale.getCell(r, 2), scale.getCell(r, 3), scale.getCell(r, 5), scale.getCell(r, 6)]
    cells[0].value = rowVals[0]
    cells[1].value = rowVals[1]
    cells[2].value = rowVals[2]
    cells[3].value = rowVals[3]
    cells.forEach((cell, ci) => {
      cell.font = font()
      cell.border = BORDER
      cell.alignment =
        ci === 1
          ? { vertical: 'middle', wrapText: true }
          : ci >= 2
            ? { horizontal: 'center', vertical: 'middle' }
            : { vertical: 'middle' }
    })
    scale.getCell(r, 4).border = BORDER
    scale.getRow(r).height = wrapHeight(rowVals[1], 42, 26)
  })

  // ----------------------------------------------- Assessment Questionnaire
  const q = wb.addWorksheet('Assessment Questionnaire', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  const qWidths = [2.6, 32.3, 63.7, 11.7, 19.4, 12.7, 15.6, 36.6]
  qWidths.forEach((w, i) => (q.getColumn(i + 1).width = w))

  q.getCell('A1').value = '  '
  const qTitle = q.getCell('C1')
  qTitle.value = `${info.contractorNames || info.facilityManagement} ${template.reportHeading} `
  qTitle.font = font({ size: 14, bold: true })
  qTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  const qDate = q.getCell('E1')
  qDate.value = reviewDate
  qDate.font = font({ size: 16, bold: true })
  qDate.alignment = { horizontal: 'center', vertical: 'middle' }
  qDate.numFmt = FMT_DATE_DDMMM

  sheetTitle(q.getCell('B3'), '5. Assessment Questionaire')
  const c4 = q.getCell('C4')
  c4.value = template.questionnaireTitle
  c4.font = font({ color: { argb: WHITE } })
  c4.fill = fill(NAVY)
  c4.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  c4.border = { left: { style: 'medium' }, right: { style: 'medium' }, top: { style: 'medium' } }

  const sectionRows: SectionRows[] = []
  let r = 5
  template.sections.forEach((section, si) => {
    const headerRow = r
    const bh = q.getCell(r, 2)
    bh.value = `Section ${section.letter}`
    bh.font = font({ size: 14, bold: true, color: { argb: GOLD } })
    bh.fill = fill(NAVY)
    bh.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    bh.border = BORDER
    tableHeader(q.getCell(r, 3), section.title)
    tableHeader(q.getCell(r, 4), 'Yes/No/NA')
    tableHeader(q.getCell(r, 5), 'Compliance Assessment ')
    tableHeader(q.getCell(r, 6), 'Compliance Score')
    tableHeader(q.getCell(r, 7), 'Score (out of 100)')
    tableHeader(q.getCell(r, 8), si === 0 ? 'Observations/Comments' : 'Observations')
    q.getRow(r).height = 30
    r++

    const firstQ = r
    for (const question of section.questions) {
      const resp = inspection.responses[question.code]
      q.getCell(r, 2).value = question.code
      q.getCell(r, 3).value = question.text
      q.getCell(r, 4).value = resp?.yesNo || ''
      q.getCell(r, 5).value = resp?.assessment || ''
      q.getCell(r, 6).value = { formula: ifsScore(`E${r}`) }
      q.getCell(r, 7).value = { formula: ifsOutOf100(`F${r}`) }
      q.getCell(r, 8).value = resp?.observation || ''
      for (let c = 2; c <= 8; c++) {
        const cell = q.getCell(r, c)
        cell.font = font()
        cell.border = BORDER
        cell.alignment =
          c === 3 || c === 8
            ? { vertical: 'middle', wrapText: true }
            : { horizontal: 'center', vertical: 'middle' }
      }
      q.getCell(r, 4).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Yes,No,N/A"'],
      }
      q.getCell(r, 5).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Full compliance,Partial compliance,No compliance,N/A"'],
      }
      q.getRow(r).height = Math.max(
        wrapHeight(question.text, 60, 26),
        wrapHeight(resp?.observation || '', 34, 26),
      )
      r++
    }
    const lastQ = r - 1

    // Score per section row
    q.mergeCells(r, 3, r, 4)
    const label = q.getCell(r, 3)
    label.value = 'Score per section '
    label.font = font({ bold: true, color: { argb: WHITE } })
    label.fill = fill(NAVY)
    label.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    label.border = BORDER
    const eCell = q.getCell(r, 5)
    eCell.value = { formula: ifsAssessment(`F${r}`) }
    const fCell = q.getCell(r, 6)
    fCell.value = { formula: safeAvg(`F${firstQ}:F${lastQ}`) }
    fCell.numFmt = '0.000'
    const gCell = q.getCell(r, 7)
    gCell.value = { formula: safeAvg(`G${firstQ}:G${lastQ}`) }
    gCell.numFmt = '0.000'
    for (const cell of [eCell, fCell, gCell]) {
      cell.font = font()
      cell.fill = fill(GRAY)
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = BORDER
    }
    sectionRows.push({ section, headerRow, firstQ, lastQ, scoreRow: r })
    r += 2 // blank row between sections
  })

  // --------------------------------------------- Summary of observations
  const sm = wb.addWorksheet('Summary of observations', { views: [{ showGridLines: false }] })
  const smWidths = [2.6, 11.4, 8.4, 40.2, 16.4, 12.4, 15.0, 18.0, 26.6]
  smWidths.forEach((w, i) => (sm.getColumn(i + 1).width = w))

  sm.mergeCells('D1:E1')
  const smType = sm.getCell('D1')
  smType.value = `${info.typeOfReview} `
  smType.font = font({ bold: true })
  smType.alignment = { horizontal: 'center' }
  const smDate = sm.getCell('G1')
  smDate.value = reviewDate
  smDate.font = font({ bold: true })
  smDate.numFmt = FMT_DATE_SHORT

  sheetTitle(sm.getCell('C3'), 'Summary of Observations', true)

  tableHeader(sm.getCell('B4'), 'Section')
  sm.mergeCells('C4:D4')
  tableHeader(sm.getCell('C4'), 'Area')
  tableHeader(sm.getCell('E4'), 'Section Assessment')
  tableHeader(sm.getCell('F4'), 'Number of Observations')
  tableHeader(sm.getCell('G4'), 'Section Compliance score ')
  tableHeader(sm.getCell('H4'), 'Compliance score  (out of 100)')
  sm.getRow(4).height = 39.6

  const QN = "'Assessment Questionnaire'"
  sectionRows.forEach((sr, i) => {
    const row = 5 + i
    sm.getCell(row, 2).value = `Section ${sr.section.letter}`
    sm.mergeCells(row, 3, row, 4)
    sm.getCell(row, 3).value = sr.section.title
    sm.getCell(row, 5).value = { formula: `IFERROR(${QN}!E${sr.scoreRow},"")` }
    sm.getCell(row, 6).value = { formula: `COUNTIF(${QN}!F${sr.firstQ}:F${sr.lastQ},"<2")` }
    sm.getCell(row, 7).value = { formula: `IFERROR(${QN}!F${sr.scoreRow},"")` }
    sm.getCell(row, 7).numFmt = '0.00'
    sm.getCell(row, 8).value = { formula: `IFERROR(${QN}!G${sr.scoreRow},"")` }
    sm.getCell(row, 8).numFmt = '0.00'
    for (let c = 2; c <= 8; c++) {
      const cell = sm.getCell(row, c)
      cell.font = font()
      cell.fill = fill(WHITE)
      cell.border = BORDER
      cell.alignment =
        c === 3 ? { horizontal: 'center', vertical: 'middle', wrapText: true } : { horizontal: 'center', vertical: 'middle' }
    }
  })

  const lastSectionRow = 4 + sectionRows.length
  const overall = lastSectionRow + 1
  sm.mergeCells(overall, 3, overall, 4)
  const ov = sm.getCell(overall, 3)
  ov.value = 'Overall Risk Score'
  ov.font = font({ color: { argb: WHITE } })
  ov.fill = fill(NAVY)
  ov.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  ov.border = BORDER
  const ovE = sm.getCell(overall, 5)
  ovE.value = { formula: ifsAssessment(`G${overall}`) }
  ovE.fill = fill(GRAY)
  const ovF = sm.getCell(overall, 6)
  ovF.value = { formula: `SUM(F5:F${lastSectionRow})` }
  ovF.fill = fill(GRAY)
  const ovG = sm.getCell(overall, 7)
  ovG.value = { formula: safeAvg(`G5:G${lastSectionRow}`) }
  ovG.numFmt = '0.000'
  ovG.font = font({ bold: true })
  ovG.fill = fill(GRAY)
  const ovH = sm.getCell(overall, 8)
  ovH.value = { formula: safeAvg(`H5:H${lastSectionRow}`) }
  ovH.numFmt = '0.000'
  ovH.fill = fill(GRAY)
  for (const cell of [ovE, ovF, ovG, ovH]) {
    if (!cell.font) cell.font = font()
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = BORDER
  }

  // Observations & Action plans table
  const obsTitleRow = overall + 3
  sheetTitle(sm.getCell(obsTitleRow, 2), '4. Observations & Action plans')
  const obsHeaderRow = obsTitleRow + 1
  const obsHeaders = [
    'Observation Ref.',
    'Question Number',
    'Compliance  Assessment',
    'Compliance  Score',
    'Compliance Score (Out of 100)',
    'Observation',
    'Action Plan',
  ]
  obsHeaders.forEach((h, i) => tableHeader(sm.getCell(obsHeaderRow, 2 + i), h))
  sm.getRow(obsHeaderRow).height = 30

  let obsRow = obsHeaderRow + 1
  let obsRef = 1
  for (const section of template.sections) {
    for (const question of section.questions) {
      const resp = inspection.responses[question.code]
      if (!resp) continue
      if (!isFinding(resp)) continue
      const score = assessmentScore(resp.assessment) ?? '-'
      const out100 = assessmentPct(resp.assessment) ?? '-'
      const vals: ExcelJS.CellValue[] = [
        `${obsRef}.`,
        question.code,
        resp.assessment || '',
        score,
        out100,
        resp.observation,
        resp.actionPlan,
      ]
      vals.forEach((v, i) => {
        const cell = sm.getCell(obsRow, 2 + i)
        cell.value = v
        cell.font = font()
        cell.border = BORDER
        cell.alignment =
          i >= 5
            ? { vertical: 'middle', wrapText: true }
            : { horizontal: 'center', vertical: 'middle', wrapText: true }
      })
      sm.getRow(obsRow).height = Math.max(
        wrapHeight(resp.observation, 34, 26),
        wrapHeight(resp.actionPlan, 24, 26),
      )
      obsRef++
      obsRow++
    }
  }

  // ---------------------------------------------------------- Photo Evidence
  const pe = wb.addWorksheet('Photo Evidence', { views: [{ showGridLines: false }] })
  pe.getColumn(1).width = 2.6
  pe.getColumn(2).width = 12.6
  pe.getColumn(4).width = 13.9
  pe.getColumn(5).width = 13.1
  pe.getColumn(6).width = 40.4
  pe.getColumn(7).width = 26
  sheetTitle(pe.getCell('B3'), '6. Photo Evidence', true)
  const peHeaders = ['Photo Ref.', 'Section', 'Question Number', 'Compliance / No Compliance', 'Photo Evidence', 'Caption']
  peHeaders.forEach((h, i) => tableHeader(pe.getCell(5, 2 + i), h))
  pe.getRow(5).height = 30

  const evidence = await withSizes(questionPhotos(allPhotos))
  let peRow = 6
  evidence.forEach(({ photo, buffer, width, height }, i) => {
    const code = photo.itemId ?? ''
    const letter = code.replace(/\d+$/, '')
    const resp = inspection.responses[code]
    const rag =
      resp?.assessment === 'No compliance'
        ? 'Red'
        : resp?.assessment === 'Partial compliance'
          ? 'Amber'
          : resp?.assessment === 'Full compliance'
            ? 'Green'
            : ''
    const refCell = pe.getCell(peRow, 2)
    refCell.value = `${i + 1}.`
    refCell.font = font({ bold: true })
    pe.getCell(peRow, 3).value = letter
    pe.getCell(peRow, 4).value = code
    pe.getCell(peRow, 5).value = rag
    pe.getCell(peRow, 7).value = photo.caption
    for (let c = 2; c <= 7; c++) {
      const cell = pe.getCell(peRow, c)
      if (!cell.font) cell.font = font()
      cell.border = BORDER
      cell.alignment = { horizontal: c >= 6 ? 'left' : 'center', vertical: 'middle', wrapText: true }
    }
    const displayW = 275
    const displayH = Math.round((height / width) * displayW)
    const imgId = wb.addImage({ buffer, extension: 'jpeg' })
    pe.addImage(imgId, {
      tl: { col: 5, row: peRow - 1 },
      ext: { width: displayW, height: displayH },
    })
    pe.getRow(peRow).height = Math.max(displayH * 0.75 + 6, 40)
    peRow++
  })

  const buf = await wb.xlsx.writeBuffer()
  return {
    blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName: excelFileName(inspection),
  }
}

function numOrText(s: string): ExcelJS.CellValue {
  const t = s.trim()
  if (t !== '' && !isNaN(Number(t))) return Number(t)
  return t
}
