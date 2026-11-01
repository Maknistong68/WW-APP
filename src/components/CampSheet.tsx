import { useState } from 'react'
import Modal from './Modal'
import { showToast } from './Toast'
import { saveRecord } from '../lib/records'
import { useContractors } from '../lib/useData'
import type { Camp } from '../types'

/** Add / edit a camp. */
export default function CampSheet({ camp, onClose }: { camp: Camp; onClose: () => void }) {
  const { all: contractors, workOrders } = useContractors()
  const [c, setC] = useState(camp)
  const isNew = !camp.updatedAt
  const wos = workOrders.filter((w) => w.contractorUuid === c.contractorUuid)

  const save = async () => {
    const name = c.name.trim()
    if (!name) return showToast({ text: 'Camp name is required' })
    await saveRecord('camps', { ...c, name, location: c.location.trim(), cycleDays: c.cycleDays || 90 }, name)
    showToast({ text: isNew ? 'Camp added' : 'Camp saved' })
    onClose()
  }

  return (
    <Modal
      title={isNew ? 'New camp' : 'Edit camp'}
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
            <input value={c.name} placeholder="e.g. Al Fahad Camp 3" onChange={(e) => setC({ ...c, name: e.target.value })} />
          </label>
          <label className="row">
            <span className="row-label">Location</span>
            <input value={c.location} placeholder="Area / region" onChange={(e) => setC({ ...c, location: e.target.value })} />
          </label>
          <label className="row">
            <span className="row-label">Contractor</span>
            <select value={c.contractorUuid} onChange={(e) => setC({ ...c, contractorUuid: e.target.value, workOrderUuid: '' })}>
              <option value="">Choose…</option>
              {[...contractors]
                .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
                .map((x) => (
                  <option key={x.uuid} value={x.uuid}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          {wos.length > 0 && (
            <label className="row">
              <span className="row-label">Work order</span>
              <select value={c.workOrderUuid} onChange={(e) => setC({ ...c, workOrderUuid: e.target.value })}>
                <option value="">Not specific</option>
                {wos.map((w) => (
                  <option key={w.uuid} value={w.uuid}>
                    WO {w.number}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="row">
            <span className="row-label">Inspect every</span>
            <input
              inputMode="numeric"
              value={c.cycleDays || ''}
              onChange={(e) => setC({ ...c, cycleDays: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
            <span className="row-trail">days</span>
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
        <div className="list-foot">Shows as expired on Home when not inspected within the cycle (default 90 days).</div>
      </div>
    </Modal>
  )
}
