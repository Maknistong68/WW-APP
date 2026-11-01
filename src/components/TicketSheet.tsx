import { useState, useRef } from 'react'
import Modal, { type ModalHandle } from './Modal'
import { showToast } from './Toast'
import Icon from './Icon'
import { saveRecord } from '../lib/records'
import { localDate } from '../lib/dates'
import { CATEGORIES, CHANNELS, ISSUES, PRIORITIES, SEVERITIES } from '../lib/lists'
import { TICKET_PREFIX, newContractor, ticketLabel, useContractors, validTicketNo } from '../lib/useData'
import { db } from '../db'
import type { Ticket } from '../types'

const NEW = '__new__'

function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <span className="stepper">
      <button type="button" aria-label="Less" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <input
        inputMode="numeric"
        aria-label="Count"
        value={value}
        style={{ width: 44, textAlign: 'center', fontWeight: 600, flex: 'none' }}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))}
      />
      <button type="button" aria-label="More" onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  )
}

/** Add / edit a ticket. Four things up front; the rest under "More". */
export default function TicketSheet({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { all: contractors, byUuid, workOrders } = useContractors()
  const [t, setT] = useState(ticket)
  const [more, setMore] = useState(!!ticket.updatedAt)
  const [newName, setNewName] = useState('')
  const isNew = !ticket.updatedAt
  const set = <K extends keyof Ticket>(k: K, v: Ticket[K]) => setT((p) => ({ ...p, [k]: v }))
  const addingContractor = t.contractorUuid === NEW
  const cWos = workOrders.filter((w) => w.contractorUuid === t.contractorUuid)

  const sheet = useRef<ModalHandle>(null)
  const save = async () => {
    let rec = { ...t, ticketNo: t.ticketNo.trim().toUpperCase() }
    if (addingContractor) {
      const name = newName.trim()
      if (!name) return showToast({ text: 'Type the new contractor name' })
      const c = await saveRecord('contractors', newContractor(name), name)
      byUuid.set(c.uuid, c)
      rec = { ...rec, contractorUuid: c.uuid }
    }
    if (!validTicketNo(rec.ticketNo)) return showToast({ text: `Complete the ticket number (${TICKET_PREFIX}…)` })
    const clash = await db.tickets.where('ticketNo').equals(rec.ticketNo).filter((x) => x.uuid !== rec.uuid).count()
    if (clash) return showToast({ text: `${rec.ticketNo} already exists` })
    if (!rec.contractorUuid) return showToast({ text: 'Pick a contractor' })
    if (!rec.issue) return showToast({ text: 'Pick an issue' })
    await saveRecord('tickets', rec, ticketLabel(rec, byUuid))
    showToast({ text: isNew ? 'Ticket added' : 'Ticket saved' })
    // slide the sheet away, then close
    if (sheet.current) sheet.current.close()
    else onClose()
  }

  return (
    <Modal
      ref={sheet}
      title={isNew ? 'New ticket' : 'Edit ticket'}
      onClose={onClose}
      header={
        <button className="nav-btn strong" onClick={() => void save()}>
          {isNew ? 'Add' : 'Save'}
        </button>
      }
    >
      <div className="sheet-body">
        <div className="list">
          <label className="row">
            <span className="row-label">Ticket no.</span>
            <input
              value={t.ticketNo}
              autoCapitalize="characters"
              autoFocus={isNew}
              style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
              onChange={(e) => set('ticketNo', e.target.value.toUpperCase())}
            />
          </label>
        </div>
        <div className="segmented" role="tablist" aria-label="Source">
          {(['System', 'Internal'] as const).map((s) => (
            <button key={s} className={t.source === s ? 'on' : ''} onClick={() => set('source', s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="list">
          <label className="row">
            <span className="row-label">Contractor</span>
            <select
              value={t.contractorUuid}
              onChange={(e) => setT((p) => ({ ...p, contractorUuid: e.target.value, workOrderUuid: '' }))}
            >
              <option value="">Choose…</option>
              {[...contractors]
                .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.uuid} value={c.uuid}>
                    {c.name}
                  </option>
                ))}
              <option value={NEW}>＋ New contractor…</option>
            </select>
          </label>
          {addingContractor && (
            <label className="row">
              <span className="row-label">Name</span>
              <input autoFocus value={newName} placeholder="New contractor" onChange={(e) => setNewName(e.target.value)} />
            </label>
          )}
          {cWos.length > 0 && (
            <label className="row">
              <span className="row-label">Work order</span>
              <select value={t.workOrderUuid} onChange={(e) => set('workOrderUuid', e.target.value)}>
                <option value="">Not specific</option>
                {cWos.map((w) => (
                  <option key={w.uuid} value={w.uuid}>
                    WO {w.number}
                    {w.label ? ` · ${w.label}` : ''}
                    {w.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="row">
            <span className="row-label">Money owed</span>
            <input
              inputMode="decimal"
              placeholder="SAR"
              value={t.amountOwed ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, '')
                set('amountOwed', v === '' ? null : Number(v))
              }}
            />
            <span className="row-trail">SAR</span>
          </label>
          <div className="row">
            <span className="row-label" style={{ flex: 1 }}>
              Workers
            </span>
            <Stepper value={t.workers} min={0} onChange={(n) => set('workers', n)} />
          </div>
        </div>

        <div className="section-label">Issue</div>
        <div className="list">
          <div className="pill-row">
            {ISSUES.map((i) => (
              <button key={i} className={`pill${t.issue === i ? ' on' : ''}`} onClick={() => set('issue', i)}>
                {i}
              </button>
            ))}
          </div>
        </div>

        {!more ? (
          <button className="row tint list" style={{ marginTop: 8 }} onClick={() => setMore(true)}>
            <span className="row-main">More details</span>
            <Icon name="chevron-down" size={20} />
          </button>
        ) : (
          <>
            <div className="section-label">Details</div>
            <div className="list">
              <label className="row">
                <span className="row-label">Opened</span>
                <input type="date" value={t.openedAt} onChange={(e) => set('openedAt', e.target.value)} />
              </label>
              <label className="row">
                <span className="row-label">Channel</span>
                <select value={t.channel} onChange={(e) => set('channel', e.target.value)}>
                  {[...new Set([...CHANNELS, t.channel])].filter(Boolean).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="row">
                <span className="row-label">Category</span>
                <select value={t.category} onChange={(e) => set('category', e.target.value)}>
                  {[...new Set([...CATEGORIES, t.category])].filter(Boolean).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="row">
                <span className="row-label">Priority</span>
                <select value={t.priority} onChange={(e) => set('priority', Number(e.target.value))}>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.value} · {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="row">
                <span className="row-label">Severity</span>
                <select value={t.severity} onChange={(e) => set('severity', e.target.value)}>
                  {[...new Set([...SEVERITIES, t.severity])].filter(Boolean).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="row">
                <span className="row-label">Sub-contractor</span>
                <input value={t.subcontractor} onChange={(e) => set('subcontractor', e.target.value)} />
              </label>
              <div className="row">
                <span className="row-label" style={{ flex: 1 }}>
                  Violations
                </span>
                <Stepper value={t.violations} min={0} onChange={(n) => set('violations', n)} />
              </div>
              <label className="row">
                <span className="row-label">Assigned to</span>
                <input value={t.assignedTo} onChange={(e) => set('assignedTo', e.target.value)} />
              </label>
            </div>
            <div className="section-label">Notes</div>
            <div className="list">
              <label className="row">
                <textarea
                  value={t.notes}
                  placeholder="No worker names or ID numbers"
                  onChange={(e) => set('notes', e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/** Close a ticket: what was done + closing date. */
export function CloseTicketSheet({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { byUuid } = useContractors()
  const [action, setAction] = useState(ticket.wwAction)
  const [contractorAction, setContractorAction] = useState(ticket.contractorAction)
  const [date, setDate] = useState(localDate())

  const sheet = useRef<ModalHandle>(null)
  const save = async () => {
    if (date < ticket.openedAt) return showToast({ text: 'Closing date is before the opening date' })
    await saveRecord(
      'tickets',
      { ...ticket, status: 'Closed', closedAt: date, wwAction: action.trim(), contractorAction: contractorAction.trim() },
      ticketLabel(ticket, byUuid),
      'close',
    )
    showToast({ text: 'Ticket closed' })
    // slide the sheet away, then close
    if (sheet.current) sheet.current.close()
    else onClose()
  }

  return (
    <Modal
      ref={sheet}
      title="Close ticket"
      onClose={onClose}
      header={
        <button className="nav-btn strong" onClick={() => void save()}>
          Close
        </button>
      }
    >
      <div className="sheet-body">
        <div className="list">
          <label className="row">
            <span className="row-label">Closed on</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="section-label">Contractor action</div>
        <div className="list">
          <label className="row">
            <textarea value={contractorAction} placeholder="e.g. Salary paid" onChange={(e) => setContractorAction(e.target.value)} />
          </label>
        </div>
        <div className="section-label">WW action</div>
        <div className="list">
          <label className="row">
            <textarea value={action} placeholder="e.g. Verified with workers on site" onChange={(e) => setAction(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  )
}
