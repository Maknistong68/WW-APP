import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { FIELD_LABELS } from '../lib/useData'
import type { ActivityChange, ActivityEntry, Contractor } from '../types'

const ACTION_LABEL: Record<ActivityEntry['action'], string> = {
  add: 'Added',
  edit: 'Edited',
  close: 'Closed',
  reopen: 'Reopened',
  delete: 'Deleted',
  import: 'Imported',
}

export const fmtWhen = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function show(v: unknown, field: string, contractors?: Map<string, Contractor>): string {
  if (v === null || v === undefined || v === '') return '—'
  if (field === 'contractorUuid' && contractors) return contractors.get(String(v))?.name ?? '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.join(', ') || '—'
  const s = String(v)
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}

export function changeText(c: ActivityChange, contractors?: Map<string, Contractor>) {
  return `${FIELD_LABELS[c.field] ?? c.field}: ${show(c.from, c.field, contractors)} → ${show(c.to, c.field, contractors)}`
}

/** Activity entries for one record, newest first. */
export default function History({ uuid, contractors }: { uuid: string; contractors?: Map<string, Contractor> }) {
  const entries = useLiveQuery(() => db.activity.where('entityUuid').equals(uuid).reverse().sortBy('time'), [uuid])
  if (!entries || entries.length === 0) return null
  return (
    <>
      <div className="section-label">History</div>
      <div className="list">
        {entries.map((e) => (
          <div key={e.uuid} className="row" style={{ alignItems: 'flex-start' }}>
            <div className="row-main">
              <div className="row-title" style={{ fontSize: 15 }}>
                {ACTION_LABEL[e.action]}
              </div>
              {e.action !== 'add' &&
                e.changes.slice(0, 6).map((c) => (
                  <div key={c.field} className="row-sub" style={{ whiteSpace: 'normal' }}>
                    {changeText(c, contractors)}
                  </div>
                ))}
            </div>
            <span className="row-trail" style={{ fontSize: 13 }}>
              {fmtWhen(e.time)}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
