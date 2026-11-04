import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Icon from './Icon'
import { useSave } from '../lib/useSave'
import SaveButton from './SaveButton'
import Modal, { type ModalHandle } from './Modal'
import { showToast } from './Toast'
import { saveRecord } from '../lib/records'
import { db } from '../db'
import { takenContractorName } from '../lib/names'
import { mergeEdited } from '../lib/merge'
import { addSubcon, removeSubcon, ticketSubcons } from '../lib/subcons'
import type { Contractor, WorkOrder } from '../types'

export default function ContractorSheet({
  contractor,
  onClose,
  onSaved,
}: {
  contractor: Contractor
  onClose: () => void
  onSaved?: (c: Contractor) => void
}) {
  const [c, setC] = useState(contractor)
  const [aliases, setAliases] = useState(contractor.aliases.join(', '))
  const isNew = !contractor.updatedAt

  const sheet = useRef<ModalHandle>(null)
  const { saving, alert, run } = useSave(contractor.name ? `Contractor ${contractor.name}` : 'New contractor')
  const save = () =>
    run(async () => {
      const name = c.name.trim()
      if (!name) return 'Name is required'
      const taken = takenContractorName(name, await db.contractors.toArray(), c.uuid)
      if (taken) return `${taken} is already in the list`
      const rec: Contractor = {
        ...c,
        name,
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a && a.toLowerCase() !== name.toLowerCase()),
      }
      const saved = await saveRecord('contractors', rec, name)
      onSaved?.(saved)
      // slide the sheet away, then close
      if (sheet.current) sheet.current.close()
      else onClose()
    })

  return (
    <Modal
      ref={sheet}
      title={isNew ? 'New contractor' : 'Edit contractor'}
      onClose={onClose}
      alert={alert}
      header={
        <SaveButton saving={saving} onClick={() => void save()}>
          Save
        </SaveButton>
      }
    >
      <div className="sheet-body">
        <div className="list">
          <label className="row">
            <span className="row-label">Name</span>
            <input value={c.name} placeholder="Required" onChange={(e) => setC({ ...c, name: e.target.value })} />
          </label>
          <label className="row">
            <span className="row-label">Active</span>
            <input
              type="checkbox"
              role="switch"
              checked={c.active}
              onChange={(e) => setC({ ...c, active: e.target.checked })}
            />
          </label>
        </div>
        <div className="section-label">Other names</div>
        <div className="list">
          <label className="row">
            <textarea
              value={aliases}
              placeholder="Comma-separated spellings, e.g. legal name, short name"
              onChange={(e) => setAliases(e.target.value)}
            />
          </label>
        </div>
        <div className="list-foot">Tickets, imports and audits under any of these names count for this contractor.</div>
      </div>
    </Modal>
  )
}

/** Add / edit one work order of a contractor. */
export function WorkOrderSheet({
  contractor,
  workOrder,
  onClose,
}: {
  contractor: Contractor
  workOrder: WorkOrder
  onClose: () => void
}) {
  const [w, setW] = useState(workOrder)
  const [draft, setDraft] = useState('')
  const isNew = !workOrder.updatedAt
  const sheet = useRef<ModalHandle>(null)
  const { saving, alert, run } = useSave(`Work order ${contractor.name}`)
  // Names typed on this work order's tickets and cases, offered to add.
  const tickets = useLiveQuery(() => db.tickets.filter((t) => t.workOrderUuid === workOrder.uuid).toArray(), [workOrder.uuid])
  const subs = w.subcons ?? []
  const suggest = isNew ? [] : ticketSubcons(workOrder.uuid, tickets ?? [], subs).slice(0, 8)
  const addName = (name: string) => {
    setW((p) => ({ ...p, subcons: addSubcon(p.subcons, name) }))
    setDraft('')
  }
  const save = () =>
    run(async () => {
      const number = w.number.trim()
      if (!number) return 'Work order number is required'
      const dup = await db.workOrders
        .where('contractorUuid')
        .equals(contractor.uuid)
        .filter((x) => x.uuid !== w.uuid && x.number.trim() === number)
        .count()
      if (dup) return `WO ${number} already exists for ${contractor.name}`
      // a name typed but not added yet still counts
      const edited: WorkOrder = { ...w, number, label: w.label.trim(), subcons: addSubcon(w.subcons, draft) }
      if (!edited.subcons?.length) delete edited.subcons
      // only what was changed here, over a fresh copy: a teammate's change made meanwhile stays
      const fresh = isNew ? undefined : await db.workOrders.get(w.uuid)
      const out = fresh ? mergeEdited(fresh, workOrder, edited, ['number', 'label', 'active', 'subcons']) : edited
      await saveRecord('workOrders', out, `${contractor.name} · WO ${number}`)
      showToast({ text: isNew ? 'Work order added' : 'Work order saved' })
      if (sheet.current) sheet.current.close()
      else onClose()
    })
  return (
    <Modal
      ref={sheet}
      title={isNew ? 'New work order' : `WO ${workOrder.number}`}
      onClose={onClose}
      alert={alert}
      header={
        <SaveButton saving={saving} onClick={() => void save()}>
          Save
        </SaveButton>
      }
    >
      <div className="sheet-body">
        <div className="list">
          <label className="row">
            <span className="row-label">WO number</span>
            <input value={w.number} inputMode="numeric" placeholder="Required" onChange={(e) => setW({ ...w, number: e.target.value })} />
          </label>
          <label className="row">
            <span className="row-label">Description</span>
            <input value={w.label} placeholder="Camp, scope…" onChange={(e) => setW({ ...w, label: e.target.value })} />
          </label>
          <label className="row">
            <span className="row-label">Active</span>
            <input
              type="checkbox"
              role="switch"
              checked={w.active}
              onChange={(e) => setW({ ...w, active: e.target.checked })}
            />
          </label>
        </div>
        <div className="list-foot">Inactive work orders are not scored and not counted in missing documents.</div>
        <div className="section-label">Subcontractors{subs.length ? ` · ${subs.length}` : ''}</div>
        <div className="list">
          {subs.map((name) => (
            <div key={name} className="row">
              <span className="row-main">
                <div className="row-title wrap">{name}</div>
              </span>
              <button type="button" className="round-btn" aria-label={`Remove ${name}`} onClick={() => setW((p) => ({ ...p, subcons: removeSubcon(p.subcons, name) }))}>
                <Icon name="x" size={18} />
              </button>
            </div>
          ))}
          <form
            className="row add-row"
            onSubmit={(e) => {
              e.preventDefault()
              addName(draft)
            }}
          >
            <input aria-label="Add a subcontractor" placeholder="Add a subcontractor" value={draft} autoCapitalize="words" onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className="round-btn" aria-label="Add" disabled={!draft.trim()}>
              <Icon name="plus" size={20} />
            </button>
          </form>
        </div>
        {suggest.length > 0 && (
          <>
            <div className="list-foot" style={{ marginBottom: 6 }}>From this work order’s tickets: tap to add</div>
            <div className="obs-chips">
              {suggest.map((name) => (
                <button key={name} type="button" className="obs-chip" onClick={() => addName(name)}>
                  + {name}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="list-foot">Company names only. When WPS comes in, it asks if all of them are included.</div>
      </div>
    </Modal>
  )
}
