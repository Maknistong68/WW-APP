import { useMemo, useRef, useState } from 'react'
import { db } from '../db'
import Icon from './Icon'
import IconTile from './IconTile'
import Modal, { type ModalHandle } from './Modal'
import StatusChip from './StatusChip'
import TicketSheet from './TicketSheet'
import { showToast } from './Toast'
import { isOpen } from '../lib/aging'
import { linkCase, linkedTicket, pickerTickets, ticketFromCase, unlinkCase } from '../lib/caseLinks'
import { shortDate } from '../lib/dates'
import { haptic } from '../lib/haptics'
import { saveRecord } from '../lib/records'
import { useCachedLiveQuery } from '../lib/useCachedQuery'
import { contractorName, newTicket, ticketLabel, useContractors } from '../lib/useData'
import { useSave } from '../lib/useSave'
import type { Ticket } from '../types'

/**
 * A case that turned into a D&C ticket: pick that ticket (or add it from the
 * case), or take the link off. The case stays as it is — nothing is closed.
 */
export default function LinkTicketSheet({ kase, onClose }: { kase: Ticket; onClose: () => void }) {
  const { byUuid } = useContractors()
  const all = useCachedLiveQuery('tickets', () => db.tickets.toArray()) ?? []
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<Ticket | null>(null)
  const current = linkedTicket(kase, all)
  const picks = useMemo(
    () => pickerTickets(kase, all, query, (u) => byUuid.get(u)?.name ?? '').slice(0, 40),
    [kase, all, query, byUuid],
  )

  const sheet = useRef<ModalHandle>(null)
  const { saving, alert, run } = useSave(`Link ${kase.ticketNo}`)
  const done = () => (sheet.current ? sheet.current.close() : onClose())

  /** Save the case (read fresh) with or without its link. */
  const write = async (to: Ticket | null) => {
    const fresh = (await db.tickets.get(kase.uuid)) ?? kase
    const rec = to ? linkCase(fresh, to) : unlinkCase(fresh)
    await saveRecord('tickets', rec, ticketLabel(fresh, byUuid))
    haptic('success')
    showToast({ text: to ? `${kase.ticketNo} linked to ${to.ticketNo}` : `${kase.ticketNo} unlinked` })
  }
  const pick = (t: Ticket) =>
    run(async () => {
      if (saving || t.uuid === kase.linkedTicketUuid) return done()
      await write(t)
      done()
    })

  return (
    <>
      <Modal ref={sheet} title="Turned into a ticket" onClose={onClose} alert={alert}>
        <div className="sheet-body">
          <div className="list-foot" style={{ marginTop: 0 }}>
            {kase.ticketNo} stays as it is. Pick the D&C ticket it turned into.
          </div>
          {current && (
            <>
              <div className="section-label">Linked to</div>
              <div className="list">
                <div className="row">
                  <span className="row-main">
                    <div className="row-title">{current.ticketNo}</div>
                    <div className="row-sub">
                      {contractorName(byUuid, current.contractorUuid)} · {current.issue || '—'}
                    </div>
                  </span>
                  <StatusChip tone={isOpen(current) ? 'info' : 'none'}>{isOpen(current) ? 'Open' : 'Closed'}</StatusChip>
                </div>
                <button className="row tint" disabled={saving} onClick={() => void run(async () => (await write(null), done()))}>
                  Unlink
                </button>
              </div>
            </>
          )}
          {kase.linkedTicketUuid && !current && (
            <div className="list">
              <button className="row tint" disabled={saving} onClick={() => void run(async () => (await write(null), done()))}>
                Unlink (that ticket was removed)
              </button>
            </div>
          )}
          <div className="section-label">{current ? 'Change to' : 'D&C ticket'}</div>
          <label className="ios-search">
            <Icon name="search" size={18} />
            <input type="search" placeholder="Ticket no. or contractor" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="list">
            <button className="row tint" onClick={() => setAdding(ticketFromCase(kase, newTicket()))}>
              <Icon name="plus" size={20} />
              <span className="row-main">New D&C ticket from this case</span>
            </button>
            {picks.map((t) => (
              <button key={t.uuid} className="row" disabled={saving} aria-pressed={t.uuid === kase.linkedTicketUuid} onClick={() => void pick(t)}>
                <IconTile icon="ticket" tone={isOpen(t) ? 'info' : 'none'} size={40} />
                <span className="row-main">
                  <div className="row-title" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {t.ticketNo}
                  </div>
                  <div className="row-sub">
                    {contractorName(byUuid, t.contractorUuid)} · {t.issue || '—'} · {shortDate(t.openedAt)}
                  </div>
                </span>
                {t.uuid === kase.linkedTicketUuid ? <Icon name="check" size={20} /> : !isOpen(t) && <StatusChip tone="none">Closed</StatusChip>}
              </button>
            ))}
          </div>
          {!picks.length && (
            <div className="list-foot">{query.trim() ? 'No D&C ticket matches.' : 'No open D&C tickets. Type to find a closed one.'}</div>
          )}
        </div>
      </Modal>
      {adding && (
        <TicketSheet
          ticket={adding}
          onClose={() => setAdding(null)}
          onSaved={async (t) => {
            // the new ticket's panel closes itself; this one follows
            await write(t)
            done()
          }}
        />
      )}
    </>
  )
}
