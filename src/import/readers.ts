import {
  cellText,
  cellValue,
  cleanCategory,
  cleanChannel,
  cleanIssue,
  cleanPriority,
  cleanSeverity,
  cleanStatus,
  isYes,
  parseDate,
  parseSheetDate,
  toInt,
  toPct,
} from './clean'

// Readers for the old workbooks. They work on plain grids (rows of cell
// values) so they can be tested without Excel files; gridsFromExcel() turns
// an uploaded .xlsx into grids. Columns are found by header text, never by
// position, because the weekly tabs all differ slightly.

export interface Grid {
  name: string
  rows: unknown[][]
}

export type FileKind = 'violationLog' | 'ticketTracker' | 'kpiSystem' | 'workforce' | 'unknown'

export interface RawTicket {
  ticketNo: string
  source: '' | 'Internal'
  channel: string
  contractor: string
  subcontractor: string
  category: string
  issue: string
  priority: number
  severity: string
  workers: number
  violations: number
  assignedTo: string
  status: 'Open' | 'In progress' | 'Closed'
  openedAt: string
  closedAt: string
  /** closedAt worked out from the weekly tabs, not typed in the file */
  closedEstimated: boolean
  contractorAction: string
  wwAction: string
}

export interface RawKpi {
  contractor: string
  month: string
  wps: boolean
  manpowerDecl: boolean
  salaryDecl: boolean
  accommodationPct: number | null
  onboardingPct: number | null
  offboardingPct: number | null
  formalPct: number | null
  meetingPct: number | null
  quarterlyAuditPct: number | null
}

export interface RawContractor {
  name: string
  active: boolean
}

export interface Skipped {
  sheet: string
  row: number
  reason: string
}

export interface ReadResult {
  kind: FileKind
  tickets: RawTicket[]
  weekly: { weekEnding: string; openTickets: number }[]
  kpis: RawKpi[]
  contractors: RawContractor[]
  skipped: Skipped[]
  /** Short note for the preview, e.g. why a file was not imported. */
  note?: string
}

const empty = (kind: FileKind): ReadResult => ({ kind, tickets: [], weekly: [], kpis: [], contractors: [], skipped: [] })

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Header text → field. Description columns ("Violation", "Updates") are left out on purpose. */
const HEADERS: Record<string, string> = {
  ticketno: 'ticketNo',
  number: 'ticketNo',
  date: 'openedAt',
  openeddate: 'openedAt',
  informationsource: 'channel',
  contactchannel: 'channel',
  typeofticket: 'cat1',
  violationcategory: 'cat1',
  typeofviolation: 'cat2',
  typeofcategory: 'sub',
  violationsubcategory: 'sub',
  contractors: 'contractor',
  contractor: 'contractor',
  subcontractor: 'subcontractor',
  priority: 'priority',
  inspector: 'assignedTo',
  assignedto: 'assignedTo',
  noofviolations: 'violations',
  numberofviolationinstances: 'violations',
  issue1: 'issue',
  significantissues: 'issue',
  severity: 'severity',
  violationseverity: 'severity',
  noofwokersimpacted: 'workers',
  noofworkersimpacted: 'workers',
  numberofimpactedworkers: 'workers',
  numberofimpactedworker: 'workers',
  ticketclosure: 'status',
  state: 'status',
  closuredate: 'closedAt',
  closeddatesystem: 'closedAt',
  actiontakenbycontracto: 'contractorAction',
  actiontakenbycontractor: 'contractorAction',
  actiontakebyoxagonww: 'wwAction',
  actiontakenbyoxagonww: 'wwAction',
}

function findHeader(g: Grid): { row: number; cols: Map<string, number> } | null {
  for (let r = 0; r < Math.min(8, g.rows.length); r++) {
    const cols = new Map<string, number>()
    g.rows[r].forEach((v, i) => {
      const key = norm(cellText(v))
      const field = HEADERS[key] ?? (key.startsWith('actiontakenbycontract') ? 'contractorAction' : undefined)
      if (field && !cols.has(field)) cols.set(field, i)
    })
    if (cols.size >= 4 && cols.has('ticketNo')) return { row: r, cols }
  }
  return null
}

export function detect(grids: Grid[]): FileKind {
  const names = grids.map((g) => g.name.trim().toLowerCase())
  if (names.includes('overall')) return 'violationLog'
  if (names.includes('tracker') && names.includes('contractors')) return 'kpiSystem'
  if (names.some((n) => n.includes('workforce') || n.includes('manpower'))) return 'workforce'
  if (grids.some((g) => findHeader(g)?.cols.has('status'))) return 'ticketTracker'
  return 'unknown'
}

function rowTicket(row: unknown[], cols: Map<string, number>, source: '' | 'Internal'): RawTicket {
  const get = (f: string) => (cols.has(f) ? row[cols.get(f)!] : undefined)
  const closedAt = parseDate(get('closedAt'))
  const status = cleanStatus(get('status')) || (closedAt ? 'Closed' : 'Open')
  return {
    ticketNo: source === '' ? cellText(get('ticketNo')).toUpperCase() : '',
    source,
    channel: cleanChannel(get('channel')),
    contractor: cellText(get('contractor')),
    subcontractor: (() => {
      const s = cellText(get('subcontractor'))
      return /^(n\/?a|na|-|none)$/i.test(s) ? '' : s
    })(),
    category: cleanCategory(get('sub'), get('cat1'), get('cat2')),
    issue: cleanIssue(get('issue'), get('sub'), get('cat1')),
    priority: cleanPriority(get('priority')),
    severity: cleanSeverity(get('severity')),
    workers: toInt(get('workers')),
    violations: toInt(get('violations')) || 1,
    assignedTo: cellText(get('assignedTo')),
    status,
    openedAt: parseDate(get('openedAt')),
    closedAt: status === 'Closed' ? closedAt : '',
    closedEstimated: false,
    contractorAction: cellText(get('contractorAction')),
    wwAction: cellText(get('wwAction')),
  }
}

const isNo = (v: unknown) => /^WWCMPL\d+/i.test(cellText(v))

/** Same ticket listed twice: keep the most finished version, max workers. */
function mergeTicket(a: RawTicket, b: RawTicket): RawTicket {
  const rank = (t: RawTicket) => (t.status === 'Closed' ? 2 : t.status === 'In progress' ? 1 : 0)
  const best = rank(b) > rank(a) || (rank(b) === rank(a) && !!b.closedAt && !a.closedAt) ? b : a
  return {
    ...best,
    workers: Math.max(a.workers, b.workers),
    openedAt: [a.openedAt, b.openedAt].filter(Boolean).sort()[0] ?? '',
    contractor: best.contractor || a.contractor || b.contractor,
  }
}

export function readViolationLog(grids: Grid[]): ReadResult {
  const out = empty('violationLog')
  const byNo = new Map<string, RawTicket>()
  const noDate = new Map<string, Skipped>()
  /** Listed twice in Overall with different states — the weekly tabs decide. */
  const conflicted = new Set<string>()
  const overall = grids.find((g) => g.name.trim().toLowerCase() === 'overall')
  if (overall) {
    const h = findHeader(overall)
    if (!h) out.skipped.push({ sheet: overall.name, row: 0, reason: 'No header row found' })
    else {
      overall.rows.slice(h.row + 1).forEach((row, i) => {
        if (!isNo(row[h.cols.get('ticketNo')!])) return
        const t = rowTicket(row, h.cols, '')
        if (!t.openedAt) {
          noDate.set(t.ticketNo, { sheet: overall.name, row: h.row + i + 2, reason: `${t.ticketNo}: no opening date` })
          return
        }
        if (byNo.has(t.ticketNo)) {
          const prev = byNo.get(t.ticketNo)!
          if (prev.status !== t.status) conflicted.add(t.ticketNo)
          byNo.set(t.ticketNo, mergeTicket(prev, t))
        } else byNo.set(t.ticketNo, t)
      })
    }
  }

  // Weekly tabs: each one lists the tickets open that week.
  const weeks = grids
    .map((g) => ({ g, date: parseSheetDate(g.name) }))
    .filter((w) => w.date)
    .sort((a, b) => a.date.localeCompare(b.date))
  const seenIn = new Map<string, string[]>()
  const fromWeekly = new Map<string, RawTicket>()
  for (const { g, date } of weeks) {
    const h = findHeader(g)
    if (!h) {
      out.skipped.push({ sheet: g.name, row: 0, reason: 'No header row found' })
      continue
    }
    let open = 0
    for (const row of g.rows.slice(h.row + 1)) {
      if (!isNo(row[h.cols.get('ticketNo')!])) continue
      const t = rowTicket(row, h.cols, '')
      if (h.cols.has('status') && cleanStatus(row[h.cols.get('status')!]) === 'Closed') continue
      open++
      seenIn.set(t.ticketNo, [...(seenIn.get(t.ticketNo) ?? []), date])
      if (t.openedAt) fromWeekly.set(t.ticketNo, t)
    }
    out.weekly.push({ weekEnding: date, openTickets: open })
  }

  // Fill gaps in Overall rows from the weekly listing of the same ticket,
  // and add tickets only found in weekly tabs (older ones dropped from Overall).
  const latest = weeks.length ? weeks[weeks.length - 1].date : ''
  const FILL = ['contractor', 'subcontractor', 'channel', 'category', 'issue', 'assignedTo'] as const
  for (const [no, w] of fromWeekly) {
    const t = byNo.get(no)
    if (!t) {
      const stillOpen = seenIn.get(no)?.includes(latest)
      byNo.set(no, { ...w, status: stillOpen ? 'Open' : 'Closed', closedAt: '' })
      continue
    }
    for (const f of FILL) if (!t[f]) t[f] = w[f]
    if (!t.workers) t.workers = w.workers
    if (w.openedAt && (!t.openedAt || w.openedAt < t.openedAt)) t.openedAt = w.openedAt
  }
  for (const no of conflicted) {
    const t = byNo.get(no)!
    if (seenIn.get(no)?.includes(latest)) byNo.set(no, { ...t, status: 'Open', closedAt: '' })
  }
  for (const [no, row] of noDate) {
    if (byNo.has(no)) continue
    out.skipped.push(row)
  }

  // Closed with no closing date: the first weekly tab after its last listing.
  for (const t of byNo.values()) {
    if (t.status !== 'Closed' || t.closedAt) continue
    const dates = seenIn.get(t.ticketNo)
    if (!dates?.length) continue
    const last = dates[dates.length - 1]
    const next = weeks.find((w) => w.date > last)?.date
    if (next && next >= t.openedAt) {
      t.closedAt = next
      t.closedEstimated = true
    }
  }

  out.tickets = [...byNo.values()]
  return out
}

export function readTicketTracker(grids: Grid[]): ReadResult {
  const out = empty('ticketTracker')
  for (const g of grids) {
    const h = findHeader(g)
    if (!h || !h.cols.has('status')) continue
    g.rows.slice(h.row + 1).forEach((row, i) => {
      const contractor = cellText(row[h.cols.get('contractor') ?? -1])
      const status = cellText(row[h.cols.get('status')!])
      if (!contractor && !status) return
      const t = rowTicket(row, h.cols, isNo(row[h.cols.get('ticketNo')!]) ? '' : 'Internal')
      if (!t.openedAt) {
        out.skipped.push({ sheet: g.name, row: h.row + i + 2, reason: 'No opening date' })
        return
      }
      if (!t.contractor) {
        out.skipped.push({ sheet: g.name, row: h.row + i + 2, reason: 'No contractor' })
        return
      }
      out.tickets.push(t)
    })
  }
  return out
}

export function readKpiSystem(grids: Grid[], currentMonth: string): ReadResult {
  const out = empty('kpiSystem')
  const master = grids.find((g) => g.name.trim().toLowerCase() === 'contractors')
  if (master) {
    const hr = master.rows.findIndex((r) => r.some((v) => norm(cellText(v)) === 'contractorname'))
    if (hr >= 0) {
      const col = master.rows[hr].findIndex((v) => norm(cellText(v)) === 'contractorname')
      const st = master.rows[hr].findIndex((v) => norm(cellText(v)) === 'status')
      for (const r of master.rows.slice(hr + 1)) {
        const name = cellText(r[col])
        if (name) out.contractors.push({ name, active: st < 0 || !/inactive/i.test(cellText(r[st])) })
      }
    }
  }
  const tracker = grids.find((g) => g.name.trim().toLowerCase() === 'tracker')
  if (!tracker) return out
  const hr = tracker.rows.findIndex((r) => r.some((v) => norm(cellText(v)) === 'month'))
  if (hr < 0) return out
  const col = new Map<string, number>()
  tracker.rows[hr].forEach((v, i) => col.set(norm(cellText(v)), i))
  const at = (row: unknown[], key: string) => (col.has(key) ? row[col.get(key)!] : undefined)
  const find = (prefix: string) => [...col.keys()].find((k) => k.startsWith(prefix)) ?? prefix
  const K = {
    wps: find('wps'),
    man: find('manpowerdeclaration'),
    sal: find('salarydeclaration'),
    acc: find('accommodation'),
    on: find('onboarding'),
    offN: find('offboardedworkers'),
    offT: find('totalworkers'),
    off: find('offboarding'),
    formal: find('formalvsillegal'),
    meet: find('monthlymeeting'),
    quarter: find('quartly'),
  }
  let blank = 0
  for (const row of tracker.rows.slice(hr + 1)) {
    const month = parseDate(at(row, 'month')).slice(0, 7)
    if (!month || month > currentMonth) continue
    const hasInput = [K.wps, K.man, K.sal, K.acc, K.on, K.offN, K.off, K.formal, K.meet, K.quarter].some(
      (k) => cellText(at(row, k)) !== '',
    )
    if (!hasInput) continue
    const contractor = cellText(at(row, 'contractor'))
    if (!contractor) {
      blank++
      continue
    }
    const offN = cellValue(at(row, K.offN))
    const offT = cellValue(at(row, K.offT))
    out.kpis.push({
      contractor,
      month,
      wps: isYes(at(row, K.wps)),
      manpowerDecl: isYes(at(row, K.man)),
      salaryDecl: isYes(at(row, K.sal)),
      accommodationPct: toPct(at(row, K.acc)),
      onboardingPct: toPct(at(row, K.on)),
      offboardingPct:
        typeof offN === 'number' && typeof offT === 'number' && offT > 0
          ? Math.min(100, (offN / offT) * 100)
          : toPct(at(row, K.off)),
      formalPct: toPct(at(row, K.formal)),
      meetingPct: toPct(at(row, K.meet)),
      quarterlyAuditPct: toPct(at(row, K.quarter)),
    })
  }
  if (blank) out.skipped.push({ sheet: tracker.name, row: 0, reason: `${blank} rows with inputs but no contractor` })
  return out
}

export function readGrids(grids: Grid[], currentMonth: string): ReadResult {
  const kind = detect(grids)
  if (kind === 'violationLog') return readViolationLog(grids)
  if (kind === 'ticketTracker') return readTicketTracker(grids)
  if (kind === 'kpiSystem') return readKpiSystem(grids, currentMonth)
  if (kind === 'workforce') {
    return { ...empty('workforce'), note: 'Worker list holds personal data — not imported. Enter counts per contractor instead.' }
  }
  return { ...empty('unknown'), note: 'Not a file this app knows' }
}

/** .xlsx bytes → grids (first 40 columns only; the old files carry thousands of empty ones). */
export async function gridsFromExcel(data: ArrayBuffer): Promise<Grid[]> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data)
  return wb.worksheets.map((ws) => {
    const rows: unknown[][] = []
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const vals: unknown[] = []
      for (let c = 1; c <= 40; c++) vals.push(row.getCell(c).value)
      rows[n - 1] = vals
    })
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = []
    return { name: ws.name, rows }
  })
}
