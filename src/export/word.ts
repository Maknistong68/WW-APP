import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import type { Inspection, InspectionTemplate, Photo } from '../types'
import { isFinding, isFlagged } from '../lib/score'
import { loadPhotos, longDate, questionPhotos, withSizes, wordFileName, type PhotoWithSize } from './common'
import neomLogoUrl from '../assets/neom-logo.jpeg'
import oxagonLogoUrl from '../assets/oxagon-logo.png'

// Reproduces the official non-compliance report layout
// ("AL FAHD Workers Camp NonCompliance.docx"):
// cover logos · Findings title · Contents · Objective · Methodology ·
// Reference · Observation and recommendation (general info + findings
// tables with photos) · Conclusion. Only the content changes.

const GOLD = 'F2C200'
const BLUE = '2E74B5'
const CONTENT_DXA = 9360 // 6.5in inside 1in margins on US Letter

const heading1 = (text: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] })

const body = (text: string) => new Paragraph({ children: [new TextRun(text)] })

const cell = (
  children: Array<Paragraph>,
  width: number,
  opts: { header?: boolean } = {},
): TableCell =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.header ? { type: ShadingType.CLEAR, fill: 'D9E2F3' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children,
  })

const textCell = (text: string, width: number, opts: { bold?: boolean; header?: boolean } = {}) =>
  cell([new Paragraph({ children: [new TextRun({ text, bold: opts.bold ?? opts.header })] })], width, opts)

async function fetchImage(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  return res.arrayBuffer()
}

export async function buildWord(
  template: InspectionTemplate,
  inspection: Inspection,
): Promise<{ blob: Blob; fileName: string }> {
  const info = inspection.info
  const contractor = info.contractorNames || info.facilityManagement || 'Contractor'
  const photos = await loadPhotos(inspection.id!)
  const evidence = await withSizes(questionPhotos(photos))
  const byCode = new Map<string, PhotoWithSize[]>()
  for (const e of evidence) {
    const code = (e.photo as Photo).itemId!
    byCode.set(code, [...(byCode.get(code) ?? []), e])
  }

  const [neomLogo, oxagonLogo] = await Promise.all([fetchImage(neomLogoUrl), fetchImage(oxagonLogoUrl)])

  // Findings: questions marked non-/partially compliant, or with an observation
  interface Finding {
    code: string
    text: string
    remarks: string
    photos: PhotoWithSize[]
  }
  const findings: Finding[] = []
  for (const section of template.sections) {
    for (const question of section.questions) {
      const resp = inspection.responses[question.code]
      if (!resp) continue
      if (!isFinding(resp)) continue
      const base = resp.observation.trim() || question.text.trim().replace(/[.?]*$/, '')
      findings.push({
        code: question.code,
        text: `${base.replace(/\.$/, '')} (Section ${question.code}).`,
        remarks: resp.actionPlan,
        photos: byCode.get(question.code) ?? [],
      })
    }
  }

  const nonCompliantAreas = template.sections
    .filter((s) => s.questions.some((qq) => isFlagged(inspection.responses[qq.code])))
    .map((s) => s.title.trim().toLowerCase())

  const coveringList = template.sections.map((s) => s.title.trim().toLowerCase())
  const joinList = (items: string[]) =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`

  const children: Array<Paragraph | Table> = [
    // Cover: full-width NEOM logo + OXAGON logo (as in the template)
    new Paragraph({
      children: [
        new ImageRun({
          type: 'jpg',
          data: neomLogo,
          transformation: { width: 624, height: 768 },
        }),
        new ImageRun({
          type: 'png',
          data: oxagonLogo,
          transformation: { width: 77, height: 80 },
        }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(template.wordTitle)],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(`${contractor} – ${info.workOrder}`)],
    }),
    heading1('1.  Contents'),
    body('1.  Contents'),
    body('2.  Objective'),
    body('3.  Methodology'),
    body('4.  Reference'),
    body('5.  Observation and recommendation'),
    body('6.  Conclusion'),
    heading1('2.  Objective'),
    body(
      `The primary objective of this report is to evaluate compliance with NEOM Worker Welfare Standards and contractual requirements against ${contractor} regarding the workers camp operated by the Contractor in ${info.facilityLocation} (${info.region} region) under Work Order ${contractor} – ${info.workOrder}.`,
    ),
    heading1('3.  Methodology'),
    body(
      `Welfare inspection of the ${contractor} workers camp using the NEOM Worker Welfare Standards assessment questionnaire (Sections ${template.sections[0].letter}–${template.sections[template.sections.length - 1].letter}), covering ${joinList(coveringList)}.`,
    ),
    heading1('4.  Reference'),
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [textCell('Reference', 4680, { header: true }), textCell('Description', 4680, { header: true })],
        }),
        new TableRow({
          children: [
            textCell('NEOM-NDC-STD-001 Rev 04.00, November 2025', 4680),
            textCell('NEOM Worker Welfare Standards', 4680),
          ],
        }),
        new TableRow({
          children: [
            textCell('KSA Labor Law and its Implementing Regulations', 4680),
            textCell('Ministry of Human Resources and Social Development', 4680),
          ],
        }),
        new TableRow({
          children: [textCell('NEOM Public Safety Schedule S', 4680), textCell('Security requirements', 4680)],
        }),
        new TableRow({
          children: [textCell('Contractual agreement', 4680), textCell('Contractor agreement with NEOM', 4680)],
        }),
      ],
    }),
    heading1('5.  Observation and recommendation'),
  ]

  // General information table
  const occupants = Number(info.occupantsNumber)
  const maxOcc = Number(info.maxOccupancy)
  const occupancy =
    occupants > 0 && maxOcc > 0 ? `${((occupants / maxOcc) * 100).toFixed(2)}%` : ''
  const giRows: Array<[string, string]> = [
    ['Project / Work Order', info.workOrder],
    ['Contractor', contractor],
    ['Type of review', info.typeOfReview],
    ['Date of inspection', longDate(info.reviewDate)],
    ['Region', info.region],
    ['Facility Location', info.facilityLocation],
    ['Facility Type', info.facilityType],
    ['Map coordinates', info.mapCoordinates],
    ['Facility Management', info.facilityManagement],
    ['Facility Representative', info.facilityRepresentative],
    ['Auditor', info.auditTeam],
    ['Occupants Number', info.occupantsNumber],
    ['Number of Rooms', info.numberOfRooms],
    ['Maximum number of occupancy', info.maxOccupancy],
    ['Facility occupancy level', occupancy],
  ]
  children.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: giRows.map(
        ([k, v]) =>
          new TableRow({ children: [textCell(k, 4680, { bold: true }), textCell(v, 4680)] }),
      ),
    }),
    new Paragraph({ text: '' }),
  )

  // Observations table
  const OBS_W = 3120
  const obsRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        textCell('Observations', OBS_W, { header: true }),
        textCell('Photos', OBS_W, { header: true }),
        textCell('Remarks', OBS_W, { header: true }),
      ],
    }),
  ]
  for (const f of findings) {
    const photoParas: Paragraph[] = f.photos.length
      ? f.photos.flatMap(({ photo, buffer, width, height }) => {
          const displayW = 190
          const displayH = Math.round((height / width) * displayW)
          const paras = [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({ type: 'jpg', data: buffer, transformation: { width: displayW, height: displayH } }),
              ],
            }),
          ]
          if (photo.caption.trim()) {
            paras.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: photo.caption.trim(), italics: true, size: 18 })],
              }),
            )
          }
          return paras
        })
      : [new Paragraph({ children: [new TextRun('NO PHOTO')] })]
    obsRows.push(
      new TableRow({
        children: [
          textCell(f.text, OBS_W),
          cell(photoParas, OBS_W),
          textCell(f.remarks, OBS_W),
        ],
      }),
    )
  }
  children.push(new Table({ width: { size: CONTENT_DXA, type: WidthType.DXA }, columnWidths: [OBS_W, OBS_W, OBS_W], rows: obsRows }))

  // Conclusion
  children.push(heading1('6.  Conclusion'))
  if (nonCompliantAreas.length > 0) {
    children.push(
      body(
        `The ${contractor} workers camp in ${info.facilityLocation} shows multiple non-compliances against the NEOM Worker Welfare Standards across ${joinList(nonCompliantAreas)}. These findings require remediation by the Contractor and follow-up verification.`,
      ),
    )
  } else {
    children.push(
      body(
        `The inspection of the ${contractor} workers camp in ${info.facilityLocation} did not identify non-compliances against the NEOM Worker Welfare Standards.`,
      ),
    )
  }
  if (inspection.notes.trim()) {
    children.push(body(inspection.notes.trim()))
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Arial', size: 56 },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 30, bold: true, color: GOLD },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 26, color: BLUE },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  return { blob, fileName: wordFileName(inspection) }
}
