import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { Inspection, InspectionTemplate } from '../types'
import { RESULT_LABELS } from '../types'
import { exportFileName, itemLabel, loadPhotos, withSizes } from './common'

// NOTE: This layout is a PLACEHOLDER. It will be rebuilt to match the
// official checklist template 100% (headers, columns, logos, formatting)
// once the template document is provided.

const THIN = { style: 'thin' as const }
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN }

export async function exportExcel(template: InspectionTemplate, inspection: Inspection): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = inspection.meta.inspector || 'WW App'
  wb.created = new Date()

  const ws = wb.addWorksheet('Checklist', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  ws.columns = [
    { width: 6 },
    { width: 58 },
    { width: 16 },
    { width: 45 },
    { width: 45 },
    { width: 10 },
  ]

  // Title + metadata block
  ws.mergeCells('A1:F1')
  const title = ws.getCell('A1')
  title.value = template.name.toUpperCase()
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }
  ws.getRow(1).height = 28

  const meta: Array<[string, string, string, string]> = [
    ['Reference', inspection.meta.reference, 'Date', inspection.meta.date],
    ['Contractor / Camp', inspection.meta.contractor, 'Inspector', inspection.meta.inspector],
    ['Location', inspection.meta.location, 'Status', inspection.status === 'completed' ? 'Completed' : 'Draft'],
  ]
  meta.forEach((m, i) => {
    const row = ws.getRow(2 + i)
    row.getCell(1).value = m[0]
    ws.mergeCells(2 + i, 2, 2 + i, 2)
    row.getCell(2).value = m[1]
    row.getCell(3).value = m[2]
    ws.mergeCells(2 + i, 4, 2 + i, 6)
    row.getCell(4).value = m[3]
    row.getCell(1).font = { bold: true }
    row.getCell(3).font = { bold: true }
    for (const c of [1, 2, 3, 4]) row.getCell(c).border = BORDER
  })

  // Checklist table
  let rowIdx = 6
  const header = ws.getRow(rowIdx)
  const headers = ['#', 'Checklist Item', 'Result', 'Observation', 'Corrective Action', 'Photos']
  headers.forEach((h, i) => {
    const cell = header.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF115E59' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = BORDER
  })
  rowIdx++

  const photos = await loadPhotos(inspection.id!)
  const photoCount = (itemId: string) => photos.filter((p) => p.itemId === itemId).length

  let itemNo = 0
  for (const section of template.sections) {
    ws.mergeCells(rowIdx, 1, rowIdx, 6)
    const sc = ws.getCell(rowIdx, 1)
    sc.value = section.title
    sc.font = { bold: true }
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFBF1' } }
    sc.border = BORDER
    rowIdx++

    for (const item of section.items) {
      itemNo++
      const resp = inspection.responses[item.id]
      const row = ws.getRow(rowIdx)
      row.getCell(1).value = itemNo
      row.getCell(2).value = item.text
      row.getCell(3).value = RESULT_LABELS[resp?.result ?? 'not_checked']
      row.getCell(4).value = resp?.observation ?? ''
      row.getCell(5).value = resp?.correctiveAction ?? ''
      const n = photoCount(item.id)
      row.getCell(6).value = n > 0 ? n : ''
      row.alignment = { vertical: 'top', wrapText: true }
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' }
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'top' }
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'top' }
      if (resp?.result === 'non_compliant') {
        row.getCell(3).font = { bold: true, color: { argb: 'FFB91C1C' } }
      }
      for (let c = 1; c <= 6; c++) row.getCell(c).border = BORDER
      rowIdx++
    }
  }

  // Photo evidence sheet
  if (photos.length > 0) {
    const pws = wb.addWorksheet('Photo Evidence')
    pws.columns = [{ width: 8 }, { width: 60 }, { width: 60 }]
    pws.getCell('A1').value = '#'
    pws.getCell('B1').value = 'Checklist Item'
    pws.getCell('C1').value = 'Caption'
    pws.getRow(1).font = { bold: true }

    const sized = await withSizes(photos)
    let prow = 2
    for (let i = 0; i < sized.length; i++) {
      const { photo, buffer, width, height } = sized[i]
      pws.getCell(prow, 1).value = i + 1
      pws.getCell(prow, 2).value = photo.itemId ? itemLabel(template, photo.itemId) : 'Unassigned'
      pws.getCell(prow, 3).value = photo.caption
      pws.getRow(prow).alignment = { vertical: 'top', wrapText: true }
      prow++
      const imgId = wb.addImage({ buffer, extension: 'jpeg' })
      const displayW = 320
      const displayH = Math.round((height / width) * displayW)
      pws.addImage(imgId, {
        tl: { col: 1, row: prow - 1 },
        ext: { width: displayW, height: displayH },
      })
      // leave room below the image (~20px per default row)
      prow += Math.ceil(displayH / 20) + 2
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    exportFileName(template, inspection, 'xlsx'),
  )
}
