import { useState } from 'react'
import Modal from './Modal'
import { showToast } from './Toast'
import { saveRecord } from '../lib/records'
import { db } from '../db'
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

  const save = async () => {
    const name = c.name.trim()
    if (!name) {
      showToast({ text: 'Name is required' })
      return
    }
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
    onClose()
  }

  return (
    <Modal
      title={isNew ? 'New contractor' : 'Edit contractor'}
      onClose={onClose}
      header={
        <button className="nav-btn strong" onClick={() => void save()}>
          Save
        </button>
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
              checked={c.active}
              style={{ flex: 'none', width: 22, height: 22 }}
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
  const isNew = !workOrder.updatedAt
  const save = async () => {
    const number = w.number.trim()
    if (!number) return showToast({ text: 'Work order number is required' })
    const dup = await db.workOrders
      .where('contractorUuid')
      .equals(contractor.uuid)
      .filter((x) => x.uuid !== w.uuid && x.number.trim() === number)
      .count()
    if (dup) return showToast({ text: `WO ${number} already exists for ${contractor.name}` })
    await saveRecord('workOrders', { ...w, number, label: w.label.trim() }, `${contractor.name} · WO ${number}`)
    showToast({ text: isNew ? 'Work order added' : 'Work order saved' })
    onClose()
  }
  return (
    <Modal
      title={isNew ? 'New work order' : `WO ${workOrder.number}`}
      onClose={onClose}
      header={
        <button className="nav-btn strong" onClick={() => void save()}>
          Save
        </button>
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
              checked={w.active}
              style={{ flex: 'none', width: 22, height: 22 }}
              onChange={(e) => setW({ ...w, active: e.target.checked })}
            />
          </label>
        </div>
        <div className="list-foot">Inactive work orders are not scored and not counted in missing documents.</div>
      </div>
    </Modal>
  )
}
