import { useState } from 'react'
import Modal from './Modal'
import { showToast } from './Toast'
import { saveRecord } from '../lib/records'
import type { Contractor } from '../types'

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
      workOrder: c.workOrder.trim(),
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
            <span className="row-label">Work order</span>
            <input value={c.workOrder} onChange={(e) => setC({ ...c, workOrder: e.target.value })} />
          </label>
          <label className="row">
            <span className="row-label">Track KPIs</span>
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
