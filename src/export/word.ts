import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { saveAs } from 'file-saver'
import type { Inspection, InspectionTemplate } from '../types'
import { RESULT_LABELS } from '../types'
import { exportFileName, itemLabel, loadPhotos, withSizes } from './common'

// NOTE: This report layout is a PLACEHOLDER. It will be rebuilt to match the
// official report template 100% (cover, logos, headers/footers, tables)
// once the template document is provided.

const cell = (text: string, opts: { bold?: boolean; width?: number; color?: string } = {}) =>
  new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold, color: opts.color })],
      }),
    ],
  })

export async function exportWord(template: InspectionTemplate, inspection: Inspection): Promise<void> {
  const photos = await loadPhotos(inspection.id!)
  const sized = await withSizes(photos)

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: template.name, bold: true })],
    }),
    new Paragraph({ text: '' }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell('Reference', { bold: true, width: 25 }), cell(inspection.meta.reference, { width: 25 }), cell('Date', { bold: true, width: 25 }), cell(inspection.meta.date, { width: 25 })] }),
        new TableRow({ children: [cell('Contractor / Camp', { bold: true }), cell(inspection.meta.contractor), cell('Inspector', { bold: true }), cell(inspection.meta.inspector)] }),
        new TableRow({ children: [cell('Location', { bold: true }), cell(inspection.meta.location), cell('Status', { bold: true }), cell(inspection.status === 'completed' ? 'Completed' : 'Draft')] }),
      ],
    }),
    new Paragraph({ text: '' }),
  ]

  // Summary of findings
  const allResponses = Object.values(inspection.responses)
  const counts = {
    compliant: allResponses.filter((r) => r.result === 'compliant').length,
    non_compliant: allResponses.filter((r) => r.result === 'non_compliant').length,
    na: allResponses.filter((r) => r.result === 'na').length,
  }
  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Summary')] }),
    new Paragraph({
      children: [
        new TextRun(
          `Compliant: ${counts.compliant}   •   Non-compliant: ${counts.non_compliant}   •   N/A: ${counts.na}`,
        ),
      ],
    }),
  )
  if (inspection.meta.notes) {
    children.push(new Paragraph({ children: [new TextRun({ text: inspection.meta.notes })] }))
  }

  // Checklist detail
  let itemNo = 0
  for (const section of template.sections) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.title)] }),
    )
    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          cell('#', { bold: true, width: 5 }),
          cell('Checklist Item', { bold: true, width: 40 }),
          cell('Result', { bold: true, width: 13 }),
          cell('Observation', { bold: true, width: 21 }),
          cell('Corrective Action', { bold: true, width: 21 }),
        ],
      }),
    ]
    for (const item of section.items) {
      itemNo++
      const resp = inspection.responses[item.id]
      const result = resp?.result ?? 'not_checked'
      rows.push(
        new TableRow({
          children: [
            cell(String(itemNo)),
            cell(item.text),
            cell(RESULT_LABELS[result], result === 'non_compliant' ? { bold: true, color: 'B91C1C' } : {}),
            cell(resp?.observation ?? ''),
            cell(resp?.correctiveAction ?? ''),
          ],
        }),
      )
    }
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
    children.push(new Paragraph({ text: '' }))
  }

  // Photo evidence
  if (sized.length > 0) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Photo Evidence')] }),
    )
    sized.forEach(({ photo, buffer, width, height }, i) => {
      const displayW = 420
      const displayH = Math.round((height / width) * displayW)
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Photo ${i + 1}: ${photo.itemId ? itemLabel(template, photo.itemId) : 'Unassigned'}`,
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new ImageRun({
              type: 'jpg',
              data: buffer,
              transformation: { width: displayW, height: displayH },
            }),
          ],
        }),
      )
      if (photo.caption) {
        children.push(new Paragraph({ children: [new TextRun({ text: photo.caption, italics: true })] }))
      }
      children.push(new Paragraph({ text: '' }))
    })
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, exportFileName(template, inspection, 'docx'))
}
