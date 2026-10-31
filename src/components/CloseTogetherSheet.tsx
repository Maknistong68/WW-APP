import { useState } from 'react'
import Modal from './Modal'
import { showToast } from './Toast'
import { combineTickets, groupOf, suggestMain } from '../lib/groups'
import { localDate } from '../lib/dates'
import { saveRecord } from '../lib/records'
import { sar } from '../lib/money'
import { ticketLabel, useContractors } from '../lib/useData'
import type { Ticket } from '../types'

/**
 * Close (or just combine) related tickets in one go: one main ticket holds
 * the total the contractor paid; the others are marked "Combined with …".
 */
export default function CloseTogetherSheet({
  selected,
  all,
  close,
  onClose,
}: {
  selected: Ticket[]
  all: Ticket[]
  close: boolean
  onClose: (done: boolean) => void
}) {
  const { byUuid } = useContractors()
  const [mainUuid, setMainUuid] = useState(() => suggestMain(selected).uuid)
  // existing amounts in the selected groups, as a starting point
  const existing = selected
    .flatMap((t) => groupOf(t, all).all)
    .filter((t, i, arr) => arr.findIndex((x) => x.uuid === t.uuid) === i)
    .reduce((s, t) => s + (t.amountOwed ?? 0), 0)
  const [amount, setAmount] = useState(existing ? String(existing) : '')
  const [date, setDate] = useState(localDate())
  const [contractorAction, setContractorAction] = useState('')
  const [wwAction, setWwAction] = useState('')
  const [saving, setSaving] = useState(false)
  const workers = selected.reduce((s, t) => s + (t.workers || 0), 0)

  const save = async () => {
    const main = selected.find((t) => t.uuid === mainUuid)!
    if (close && selected.some((t) => date < t.openedAt)) {
      return showToast({ text: 'Closing date is before a ticket was opened' })
    }
    const value = amount.replace(/[^\d.]/g, '')
    setSaving(true)
    try {
      const updates = combineTickets(selected, all, {
        mainUuid,
        amount: value === '' ? null : Number(value),
        closedAt: date,
        contractorAction: contractorAction.trim(),
        wwAction: wwAction.trim(),
        close,
      })
      for (const u of updates) {
        const before = all.find((t) => t.uuid === u.uuid)
        const closing = close && before?.status !== 'Closed'
        await saveRecord('tickets', u, ticketLabel(u, byUuid), closing ? 'close' : undefined)
      }
      showToast({
        text: close
          ? `${updates.length} tickets closed together under ${main.ticketNo}`
          : `${updates.length} tickets combined under ${main.ticketNo}`,
        duration: 5000,
      })
      onClose(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={close ? 'Close together' : 'Combine tickets'}
      onClose={() => onClose(false)}
      header={
        <button className="nav-btn strong" disabled={saving} onClick={() => void save()}>
          {close ? 'Close all' : 'Combine'}
        </button>
      }
    >
      <div className="sheet-body">
        <div className="section-label">Main ticket · holds the money</div>
        <div className="list">
          {selected.map((t) => (
            <button key={t.uuid} className="row" aria-pressed={t.uuid === mainUuid} onClick={() => setMainUuid(t.uuid)}>
              <span className={`select-dot${t.uuid === mainUuid ? ' on' : ''}`} aria-hidden="true" />
              <span className="row-main">
                <div className="row-title" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t.ticketNo}
                </div>
                <div className="row-sub">
                  {t.issue || '—'} · {t.workers} worker{t.workers === 1 ? '' : 's'}
                  {t.amountOwed ? ` · ${sar(t.amountOwed)}` : ''}
                </div>
              </span>
            </button>
          ))}
        </div>
        <div className="list-foot">
          {selected.length} tickets · {workers} workers. The others will show “Combined with{' '}
          {selected.find((t) => t.uuid === mainUuid)?.ticketNo}”.
        </div>

        <div className="section-label">{close ? 'Closure' : 'Money'}</div>
        <div className="list">
          <label className="row">
            <span className="row-label">{close ? 'Total paid' : 'Total owed'}</span>
            <input inputMode="decimal" placeholder="SAR" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span className="row-trail">SAR</span>
          </label>
          {close && (
            <label className="row">
              <span className="row-label">Closed on</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          )}
        </div>
        {close && (
          <>
            <div className="section-label">Contractor action</div>
            <div className="list">
              <label className="row">
                <textarea
                  value={contractorAction}
                  placeholder="e.g. Paid all workers SAR 20,000"
                  onChange={(e) => setContractorAction(e.target.value)}
                />
              </label>
            </div>
            <div className="section-label">WW action</div>
            <div className="list">
              <label className="row">
                <textarea value={wwAction} placeholder="e.g. Verified with workers" onChange={(e) => setWwAction(e.target.value)} />
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
