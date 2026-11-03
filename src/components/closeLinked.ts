import { db } from '../db'
import { closeLinkedCase, openLinkedCases } from '../lib/caseLinks'
import { isCase } from '../lib/cases'
import { haptic } from '../lib/haptics'
import { saveRecord } from '../lib/records'
import { tryWrite } from '../lib/safeWrite'
import { ticketLabel } from '../lib/useData'
import { openSheet } from './SheetHost'
import { showToast } from './Toast'
import type { Ticket } from '../types'

/**
 * After D&C tickets were closed: their cases that are still open are offered
 * ("Close CASE-0004 too?"). Linking never closes a case; this only asks.
 */
export async function askCloseLinkedCases(closed: Ticket[], date: string): Promise<void> {
  const tickets = closed.filter((t) => !isCase(t))
  if (!tickets.length) return
  const all = await db.tickets.toArray()
  const cases = openLinkedCases(
    tickets.map((t) => t.uuid),
    all,
  )
  if (!cases.length) return
  const ticketOf = (c: Ticket) => tickets.find((t) => t.uuid === c.linkedTicketUuid) ?? tickets[0]
  const numbers = cases.map((c) => c.ticketNo).join(', ')
  const one = cases.length === 1
  openSheet({
    kind: 'confirm',
    title: one ? `Close ${cases[0].ticketNo} too?` : `Close ${cases.length} cases too?`,
    message: one ? `It turned into ${ticketOf(cases[0]).ticketNo}.` : `${numbers} turned into the ticket you closed.`,
    confirmLabel: 'Yes',
    cancelLabel: 'Keep open',
    onConfirm: () =>
      void tryWrite(one ? `Close ${cases[0].ticketNo}` : `Close ${cases.length} cases`, async () => {
        const names = new Map((await db.contractors.toArray()).map((c) => [c.uuid, c]))
        for (const c of cases) {
          const fresh = (await db.tickets.get(c.uuid)) ?? c
          if (fresh.status === 'Closed') continue
          await saveRecord('tickets', closeLinkedCase(fresh, ticketOf(c), date), ticketLabel(fresh, names), 'close')
        }
      }).then((ok) => {
        if (!ok) return
        haptic('success')
        showToast({ text: one ? `${cases[0].ticketNo} closed` : `${cases.length} cases closed` })
      }),
  })
}
