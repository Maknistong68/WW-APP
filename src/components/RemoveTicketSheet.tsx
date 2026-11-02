import { useId, useRef, useState } from 'react'
import Modal, { type ModalHandle } from './Modal'
import { showToast } from './Toast'
import { removeTicket } from '../lib/records'
import { removalProblem } from '../lib/removal'
import { backgroundSync } from '../lib/sync'
import { noun } from '../lib/cases'
import { useSave } from '../lib/useSave'
import type { Ticket } from '../types'

/** The admin removes a ticket or case: a reason is required; it can be restored later. */
export default function RemoveTicketSheet({ ticket, label, onClose, after }: { ticket: Ticket; label: string; onClose: () => void; after?: () => void }) {
  const [reason, setReason] = useState('')
  const kind = noun(ticket)
  const name = ticket.ticketNo || `this ${kind}`
  const sheet = useRef<ModalHandle>(null)
  const reasonId = useId()
  const { saving, alert, run } = useSave(`Remove ${ticket.ticketNo || kind}`)

  const remove = () =>
    run(async () => {
      const problem = removalProblem(reason)
      if (problem) return problem
      await removeTicket(ticket.uuid, reason, label)
      backgroundSync()
      showToast({ text: `${name} removed` })
      const done = () => {
        onClose()
        after?.()
      }
      if (sheet.current) sheet.current.close(done)
      else done()
    })

  return (
    <Modal ref={sheet} title={`Remove ${name}?`} onClose={onClose} alert={alert}>
      <div className="sheet-body">
        <p className="list-foot" style={{ marginTop: 0 }}>
          It leaves every list, count and the Dashboard for the whole team. You can restore it from Tickets › Removed.
        </p>
        <div className="section-label">
          <label htmlFor={reasonId}>Why remove it?</label>
        </div>
        <div className="list">
          <div className="row">
            <textarea id={reasonId} value={reason} autoFocus placeholder="e.g. Duplicate of WWCMPL0009617" onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <button className="btn block danger" style={{ marginTop: 8 }} disabled={saving} onClick={() => void remove()}>
          Remove {kind}
        </button>
      </div>
    </Modal>
  )
}
