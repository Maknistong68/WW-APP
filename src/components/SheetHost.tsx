import { useEffect, useState } from 'react'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { db } from '../db'
import TicketSheet, { CloseTicketSheet } from './TicketSheet'
import CloseTogetherSheet from './CloseTogetherSheet'
import KpiSheet, { ManpowerSheet } from './KpiSheet'
import { ConfirmSheet } from './Modal'
import CampSheet from './CampSheet'
import ContractorSheet from './ContractorSheet'
import { showToast } from './Toast'
import { groupOf } from '../lib/groups'
import { removeRecord } from '../lib/records'
import { ticketLabel } from '../lib/useData'
import { auditPctFor } from '../lib/kpiData'
import { emptyKpi, emptyManpower } from '../lib/subjects'
import type { Camp, Contractor, KpiMonth, Manpower, Ticket } from '../types'

// The edit sheets that menus open (close a ticket, fill in a month, delete…),
// hosted once near the root so any screen's long-press menu can open them.
// Each reads its record fresh when it opens, so it never saves a stale copy,
// and closes if the screen changes underneath it.

export type SheetRequest =
  | { kind: 'ticketEdit' | 'ticketClose'; uuid: string }
  | { kind: 'ticketDelete'; uuid: string; after?: () => void }
  | { kind: 'kpi' | 'manpower'; contractorUuid: string; workOrderUuid: string; month: string }
  | { kind: 'campEdit' | 'contractorEdit'; uuid: string }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void }

type Shown =
  | { kind: 'campEdit'; camp: Camp }
  | { kind: 'contractorEdit'; contractor: Contractor }
  | { kind: 'ticketEdit' | 'ticketClose'; ticket: Ticket }
  | { kind: 'ticketGroup'; group: Ticket[]; all: Ticket[] }
  | { kind: 'ticketDelete'; ticket: Ticket; label: string; after?: () => void }
  | { kind: 'kpi'; contractor: Contractor; label: string; kpi: KpiMonth; auditPct: number | null }
  | { kind: 'manpower'; label: string; record: Manpower }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void }

let opener: ((r: SheetRequest) => void) | null = null
let nav: NavigateFunction | null = null

/** Open an edit sheet from anywhere (long-press menus, swipe actions). */
export function openSheet(r: SheetRequest) {
  opener?.(r)
}

/** Navigate from code that isn't a screen (menus). */
export function go(to: string) {
  nav?.(to)
}

async function subjectOf(contractorUuid: string, workOrderUuid: string) {
  const contractor = await db.contractors.get(contractorUuid)
  if (!contractor) return null
  const wo = workOrderUuid ? await db.workOrders.get(workOrderUuid) : undefined
  return { contractor, label: wo ? `${contractor.name} · WO ${wo.number}` : contractor.name }
}

async function load(r: SheetRequest): Promise<Shown | null> {
  switch (r.kind) {
    case 'confirm':
      return r
    case 'campEdit': {
      const camp = await db.camps.get(r.uuid)
      return camp ? { kind: 'campEdit', camp } : null
    }
    case 'contractorEdit': {
      const contractor = await db.contractors.get(r.uuid)
      return contractor ? { kind: 'contractorEdit', contractor } : null
    }
    case 'ticketEdit':
    case 'ticketDelete':
    case 'ticketClose': {
      const ticket = await db.tickets.get(r.uuid)
      if (!ticket) return null
      if (r.kind === 'ticketEdit') return { kind: 'ticketEdit', ticket }
      if (r.kind === 'ticketDelete') {
        const contractors = new Map((await db.contractors.toArray()).map((c) => [c.uuid, c]))
        return { kind: 'ticketDelete', ticket, label: ticketLabel(ticket, contractors), after: r.after }
      }
      // A main ticket closes together with the tickets combined into it.
      const all = await db.tickets.toArray()
      const g = groupOf(ticket, all)
      if (g.main.uuid === ticket.uuid && g.members.length > 0) return { kind: 'ticketGroup', group: g.all, all }
      return { kind: 'ticketClose', ticket }
    }
    case 'kpi':
    case 'manpower': {
      const s = await subjectOf(r.contractorUuid, r.workOrderUuid)
      if (!s) return null
      const key = [r.contractorUuid, r.workOrderUuid, r.month]
      if (r.kind === 'manpower') {
        const record = (await db.manpower.where('[contractorUuid+workOrderUuid+month]').equals(key).first()) ?? emptyManpower(r.contractorUuid, r.workOrderUuid, r.month)
        return { kind: 'manpower', label: s.label, record }
      }
      const kpi = (await db.kpiMonths.where('[contractorUuid+workOrderUuid+month]').equals(key).first()) ?? emptyKpi(r.contractorUuid, r.workOrderUuid, r.month)
      const auditPct = auditPctFor(s.contractor, await db.inspections.toArray(), r.month)
      return { kind: 'kpi', contractor: s.contractor, label: s.label, kpi, auditPct }
    }
  }
}

export default function SheetHost() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [shown, setShown] = useState<Shown | null>(null)

  useEffect(() => {
    nav = navigate
  }, [navigate])

  useEffect(() => {
    opener = (r) => void load(r).then(setShown)
    return () => {
      opener = null
    }
  }, [])

  // A sheet belongs to the screen it was opened on.
  useEffect(() => setShown(null), [pathname])

  if (!shown) return null
  const done = () => setShown(null)
  switch (shown.kind) {
    case 'campEdit':
      return <CampSheet camp={shown.camp} onClose={done} />
    case 'contractorEdit':
      return <ContractorSheet contractor={shown.contractor} onClose={done} />
    case 'ticketEdit':
      return <TicketSheet ticket={shown.ticket} onClose={done} />
    case 'ticketClose':
      return <CloseTicketSheet ticket={shown.ticket} onClose={done} />
    case 'ticketGroup':
      return <CloseTogetherSheet selected={shown.group} all={shown.all} close onClose={done} />
    case 'ticketDelete': {
      const t = shown.ticket
      return (
        <ConfirmSheet
          title={`Delete ${t.ticketNo || 'this ticket'}?`}
          message="It stays in the activity log, but disappears from lists and the dashboard."
          confirmLabel="Delete ticket"
          destructive
          onCancel={done}
          onConfirm={() => {
            done()
            void removeRecord('tickets', t.uuid, shown.label).then(() => {
              showToast({ text: `${t.ticketNo || 'Ticket'} deleted` })
              shown.after?.()
            })
          }}
        />
      )
    }
    case 'kpi':
      return <KpiSheet contractor={shown.contractor} subjectLabel={shown.label} kpi={shown.kpi} auditPct={shown.auditPct} onClose={done} />
    case 'manpower':
      return <ManpowerSheet subjectLabel={shown.label} record={shown.record} onClose={done} />
    case 'confirm':
      return (
        <ConfirmSheet
          title={shown.title}
          message={shown.message}
          confirmLabel={shown.confirmLabel}
          destructive={shown.destructive}
          onCancel={done}
          onConfirm={() => {
            done()
            shown.onConfirm()
          }}
        />
      )
  }
}
