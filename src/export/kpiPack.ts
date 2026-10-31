import ExcelJS from 'exceljs'
import { BORDER, font, tableHeader } from './excel'
import { addMonths, monthLabel } from '../lib/dates'
import { periodStats } from '../lib/dashboard'
import { KPI_PARTS, STATUS_LABEL, kpiStatus } from '../lib/kpi'
import { itemStats, subjectKpis, type AllData, type KpiItemKey } from '../lib/kpiData'
import { moneyStats } from '../lib/money'

// Monthly KPI pack for building slides: plain tables (no merged cells, one
// header row) so each sheet pastes or uploads cleanly into a slide tool.

const round = (v: number | null) => (v === null ? null : Math.round(v))
const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round(a - b))

function table(ws: ExcelJS.Worksheet, headers: string[], rows: (string | number | null)[][], widths: number[]) {
  const head = ws.addRow(headers)
  head.eachCell((c, i) => tableHeader(c, headers[i - 1]))
  for (const r of rows) {
    const row = ws.addRow(r.map((v) => (v === null ? '' : v)))
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = font()
      c.border = BORDER
    })
  }
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))
  ws.views = [{ state: 'frozen', ySplit: head.number }]
}

export async function buildKpiPack(d: AllData, month: string): Promise<{ blob: Blob; fileName: string }> {
  const prevMonth = addMonths(month, -1)
  const now = subjectKpis(d, month)
  const prev = new Map(subjectKpis(d, prevMonth).map((s) => [s.subject.key, s.result]))
  const wb = new ExcelJS.Workbook()
  wb.creator = 'WW Co-pilot'

  // Summary: one row per KPI + ticket and money headline numbers.
  const sum = wb.addWorksheet('Summary')
  const items: { key: KpiItemKey; label: string }[] = [{ key: 'overall', label: 'Overall KPI' }, ...KPI_PARTS]
  const prevRows = subjectKpis(d, prevMonth)
  table(
    sum,
    ['KPI', `Average ${monthLabel(month)} %`, `Average ${monthLabel(prevMonth)} %`, 'Change (pts)', 'On track', 'At risk', 'Critical', 'No data'],
    items.map((it) => {
      const a = itemStats(now, it.key)
      const b = itemStats(prevRows, it.key)
      return [it.label, round(a.avg), round(b.avg), delta(a.avg, b.avg), a.good, a.warn, a.bad, a.none]
    }),
    [26, 18, 18, 13, 10, 10, 10, 10],
  )
  sum.addRow([])
  const t = periodStats(d.tickets, month, d.byUuid)
  const m = moneyStats(t.opened)
  table(
    sum,
    ['Tickets', 'Value'],
    [
      ['Opened', t.opened.length],
      ['Closed', t.closed.length],
      ['Open at month end', t.openAtEnd],
      ['Open over 30 days', t.over30AtEnd],
      ['Workers affected (opened)', t.workersOpened],
      ['Average days to close', t.avgDaysToClose === null ? null : Math.round(t.avgDaysToClose)],
      ['Money total, tickets opened (SAR)', Math.round(m.total)],
      ['Still owed (SAR)', Math.round(m.outstanding)],
      ['Recovered (SAR)', Math.round(m.settled)],
    ],
    [34, 14],
  )

  // One sheet per KPI item.
  for (const it of items) {
    const ws = wb.addWorksheet(it.label.slice(0, 31))
    const rows = [...now].sort((a, b) => (a.result[it.key] ?? 101) - (b.result[it.key] ?? 101))
    table(
      ws,
      ['Contractor', 'Work order', `${monthLabel(month)} %`, 'Status', `${monthLabel(prevMonth)} %`, 'Change (pts)'],
      rows.map(({ subject, result }) => {
        const v = result[it.key]
        const p = prev.get(subject.key)?.[it.key] ?? null
        return [
          subject.contractor.name,
          subject.workOrder ? subject.workOrder.number : '—',
          round(v),
          STATUS_LABEL[kpiStatus(v)],
          round(p),
          delta(v, p),
        ]
      }),
      [30, 12, 14, 12, 14, 13],
    )
  }

  // Top issues for the "what happened" slide.
  const issues = wb.addWorksheet('Top issues')
  table(
    issues,
    ['Issue', 'Tickets opened', 'Workers'],
    t.byIssue.map((i) => [i.label, i.count, i.workers]),
    [34, 16, 12],
  )

  const buf = await wb.xlsx.writeBuffer()
  return {
    blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName: `WW_KPI_Pack_${monthLabel(month).replace(' ', '_')}.xlsx`,
  }
}
