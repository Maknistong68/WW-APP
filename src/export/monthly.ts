import ExcelJS from 'exceljs'
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
  WidthType,
} from 'docx'
import { BORDER, NAVY, font, tableHeader } from './excel'
import { ageDays, agingBucket, isOpen } from '../lib/aging'
import { overdueTickets, periodStats, weeklyTrend } from '../lib/dashboard'
import { monthLabel } from '../lib/dates'
import { KPI_PARTS, STATUS_LABEL, pct, type KpiResult } from '../lib/kpi'
import { kpisForMonth, type AllData } from '../lib/kpiData'
import { priorityLabel } from '../lib/lists'
import coverLogoUrl from '../assets/oxagon-logo.png'
import oxagonLogoUrl from '../assets/oxagon-logo.png'

const fileBase = (month: string) => `WW_Monthly_${monthLabel(month).replace(' ', '_')}`

function addTable(ws: ExcelJS.Worksheet, headers: string[], rows: (string | number | null)[][], widths: number[]) {
  const head = ws.addRow(headers)
  head.eachCell((c, i) => tableHeader(c, headers[i - 1]))
  head.height = 30
  for (const r of rows) {
    const row = ws.addRow(r.map((v) => (v === null ? '' : v)))
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = font()
      c.border = BORDER
      c.alignment = { vertical: 'top', wrapText: true }
    })
  }
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))
  ws.views = [{ state: 'frozen', ySplit: head.number }]
  ws.autoFilter = { from: { row: head.number, column: 1 }, to: { row: head.number, column: headers.length } }
}

const kpiCell = (r: KpiResult, key: (typeof KPI_PARTS)[number]['key']) => {
  const v = r[key]
  return v === null ? null : Math.round(v)
}

export async function buildMonthlyExcel(d: AllData, month: string): Promise<{ blob: Blob; fileName: string }> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'WW Co-pilot'
  const name = (uuid: string) => d.byUuid.get(uuid)?.name ?? ''

  const ts = wb.addWorksheet('Tickets')
  ts.addRow([`Tickets — all records (exported ${new Date().toLocaleDateString()})`]).font = font({
    size: 14,
    bold: true,
    color: { argb: NAVY },
  })
  ts.addRow([])
  addTable(
    ts,
    ['Source', 'no.', 'Status', 'Contractor', 'Sub-contractor', 'Issue', 'Category', 'Priority', 'Workers', 'Violations', 'Opened', 'Closed', 'Days', 'Aging', 'Channel', 'Assigned to', 'Contractor action', 'WW action'],
    [...d.tickets]
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .map((t) => {
        const days = ageDays(t)
        return [
          t.source, t.ticketNo, t.status, name(t.contractorUuid), t.subcontractor, t.issue, t.category,
          `${t.priority} - ${priorityLabel(t.priority)}`, t.workers, t.violations, t.openedAt, t.closedAt, days,
          isOpen(t) ? agingBucket(days) : '', t.channel, t.assignedTo, t.contractorAction, t.wwAction,
        ]
      }),
    [9, 16, 10, 28, 20, 24, 18, 12, 9, 9, 11, 11, 7, 8, 16, 16, 30, 30],
  )

  const ks = wb.addWorksheet('KPIs')
  ks.addRow([`Contractor KPIs — ${monthLabel(month)}`]).font = font({ size: 14, bold: true, color: { argb: NAVY } })
  ks.addRow([])
  const kmap = kpisForMonth(d, month)
  addTable(
    ks,
    ['Contractor', ...KPI_PARTS.map((p) => `${p.label} %`), 'Overall %', 'Status'],
    d.contractors
      .filter((c) => c.active)
      .map((c) => {
        const r = kmap.get(c.uuid)!
        return [c.name, ...KPI_PARTS.map((p) => kpiCell(r, p.key)), r.overall === null ? null : Math.round(r.overall), STATUS_LABEL[r.status]]
      }),
    [28, ...KPI_PARTS.map(() => 12), 11, 12],
  )

  const ms = wb.addWorksheet('Manpower')
  ms.addRow([`Manpower — ${monthLabel(month)}`]).font = font({ size: 14, bold: true, color: { argb: NAVY } })
  ms.addRow([])
  addTable(
    ms,
    ['Contractor', 'Total workers', 'Illegal / freelance', 'Visas expiring (30d)', 'Paid recruitment fees'],
    d.manpower
      .filter((m) => m.month === month)
      .map((m) => [name(m.contractorUuid), m.totalWorkers, m.illegalOrFreelance, m.visaExpiring30d, m.paidRecruitmentFees]),
    [28, 14, 16, 18, 20],
  )

  const ws = wb.addWorksheet('Weekly trend')
  ws.addRow(['Open tickets per week']).font = font({ size: 14, bold: true, color: { argb: NAVY } })
  ws.addRow([])
  addTable(
    ws,
    ['Week ending', 'Open tickets', 'Source'],
    weeklyTrend(d.weekly, d.tickets).map((p) => [p.date, p.open, p.imported ? 'Imported' : 'Computed']),
    [14, 14, 12],
  )

  const buf = await wb.xlsx.writeBuffer()
  return {
    blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName: `${fileBase(month)}.xlsx`,
  }
}

const W = 9360
const tcell = (text: string, width: number, header = false) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: 'D9E2F3' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 20 })] })],
  })

const table = (headers: string[], rows: string[][], widths: number[]) =>
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => tcell(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((v, i) => tcell(v, widths[i])) })),
    ],
  })

export async function buildMonthlyWord(d: AllData, month: string): Promise<{ blob: Blob; fileName: string }> {
  const [, oxagon] = await Promise.all([coverLogoUrl, oxagonLogoUrl].map((u) => fetch(u).then((r) => r.arrayBuffer())))
  const s = periodStats(d.tickets, month, d.byUuid)
  const kmap = kpisForMonth(d, month)
  const name = (uuid: string) => d.byUuid.get(uuid)?.name ?? '—'
  const late = overdueTickets(d.tickets)
  const kpiRows = d.contractors
    .filter((c) => c.active)
    .map((c) => ({ c, r: kmap.get(c.uuid)! }))
    .filter(({ r }) => r.overall !== null)
    .sort((a, b) => (a.r.overall ?? 101) - (b.r.overall ?? 101))

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 21 } } } },
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new ImageRun({ type: 'jpg', data: , transformation: { width: 110, height: 44 } }),
              new TextRun('      '),
              new ImageRun({ type: 'png', data: oxagon, transformation: { width: 120, height: 40 } }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { before: 240 },
            children: [new TextRun({ text: `Worker Welfare — ${monthLabel(month)}`, bold: true, size: 40 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Prepared ${new Date().toLocaleDateString()}`, color: '666666' })],
          }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280 }, children: [new TextRun('Tickets')] }),
          table(
            ['Open', 'Opened', 'Closed', 'Over 30 days', 'Workers', 'Avg days to close'],
            [[
              String(s.openAtEnd), String(s.opened.length), String(s.closed.length), String(s.over30AtEnd),
              String(s.workersOpened), s.avgDaysToClose === null ? '—' : String(Math.round(s.avgDaysToClose)),
            ]],
            [1560, 1560, 1560, 1560, 1560, 1560],
          ),
          new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280 }, children: [new TextRun('Contractor KPIs')] }),
          kpiRows.length
            ? table(
                ['Contractor', 'Overall', 'Status'],
                kpiRows.map(({ c, r }) => [c.name, pct(r.overall), STATUS_LABEL[r.status]]),
                [5360, 2000, 2000],
              )
            : new Paragraph('No KPI data for this month.'),
          new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280 }, children: [new TextRun('Open over 30 days')] }),
          late.length
            ? table(
                ['Contractor', 'Issue', 'Workers', 'Days'],
                late.map((t) => [name(t.contractorUuid), t.issue, String(t.workers), String(ageDays(t))]),
                [3760, 3200, 1200, 1200],
              )
            : new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun('None.')] }),
        ],
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  return { blob, fileName: `${fileBase(month)}.docx` }
}
