import { useState } from 'react'
import { useSave } from '../lib/useSave'
import SaveButton from './SaveButton'
import Modal from './Modal'
import { showToast } from './Toast'
import { haptic } from '../lib/haptics'
import { combineTickets, groupOf, suggestMain } from '../lib/groups'
import { localDate } from '../lib/dates'
import { saveRecord } from '../lib/records'
import { closingAmount, owedOf, parseSar, sar } from '../lib/money'
import { ticketLabel, useContractors } from '../lib/useData'
import { noun } from '../lib/cases'
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
  // all cases or all D&C tickets (never mixed: src/lib/groups.ts sameKind)
  const kind = selected.length ? noun(selected[0]) : 'ticket'
  const [mainUuid, setMainUuid] = useState(() => suggestMain(selected).uuid)
  // existing amounts in the selected groups, as a starting point
  const inGroups = selected
    .flatMap((t) => groupOf(t, all).all)
    .filter((t, i, arr) => arr.findIndex((x) => x.uuid === t.uuid) === i)
  const existing = inGroups.reduce((s, t) => s + owedOf(t), 0)
  const [amount, setAmount] = useState(existing ? String(existing) : '')
  // "Nothing owed" when closing: already answered if a ticket says 0 and none has an amount
  const [none, setNone] = useState(existing === 0 && inGroups.some((t) => t.amountOwed === 0))
  const [date, setDate] = useState(localDate())
  const [contractorAction, setContractorAction] = useState('')
  const [wwAction, setWwAction] = useState('')
  const workers = selected.reduce((s, t) => s + (t.workers || 0), 0)

  const { saving, alert, run } = useSave(close ? `Close ${selected.length} together` : `Combine ${selected.length}`)
  const save = () =>
    run(async () => {
      const main = selected.find((t) => t.uuid === mainUuid)!
      if (close && selected.some((t) => date < t.openedAt)) return `Closing date is before a ${kind} was opened`
      // Closing asks for the money (an amount or Nothing owed); combining only keeps it optional.
      let value: number | null
      if (close) {
        const r = closingAmount(amount, none)
        if ('error' in r) return r.error
        value = r.amount
      } else {
        const v = parseSar(amount)
        if (v === undefined) return 'Check the amount'
        value = v
      }
      const updates = combineTickets(selected, all, {
        mainUuid,
        amount: value,
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
      haptic('success')
      showToast({
        text: close
          ? `${updates.length} ${kind}s closed together under ${main.ticketNo}`
          : `${updates.length} ${kind}s combined under ${main.ticketNo}`,
        duration: 5000,
      })
      onClose(true)
    })

  return (
    <Modal
      title={close ? 'Close together' : `Combine ${kind}s`}
      onClose={() => onClose(false)}
      alert={alert}
      header={
        <SaveButton saving={saving} onClick={() => void save()}>
          {close ? 'Close all' : 'Combine'}
        </SaveButton>
      }
    >
      <div className="sheet-body">
        <div className="section-label">Main {kind} · holds the money</div>
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
          {selected.length} {kind}s · {workers} workers. The others will show “Combined with{' '}
          {selected.find((t) => t.uuid === mainUuid)?.ticketNo}”.
        </div>

        <div className="section-label">{close ? 'Closure' : 'Money'}</div>
        <div className="list">
          <label className="row">
            <span className="row-label">{close ? 'Total paid' : 'Total owed'}</span>
            <input
              inputMode="decimal"
              placeholder="e.g. 4,500"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (e.target.value.trim()) setNone(false)
              }}
            />
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
          <div className="pill-row" style={{ marginTop: -4 }}>
            <button
              type="button"
              className={`pill${none ? ' on' : ''}`}
              aria-pressed={none}
              onClick={() => {
                haptic('tick')
                setNone((v) => !v)
                setAmount('')
              }}
            >
              Nothing owed
            </button>
          </div>
        )}
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
