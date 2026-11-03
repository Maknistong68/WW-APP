import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { FIELD_LABELS } from '../lib/useData'
import { DECLARATIONS, meetingAttended } from '../lib/kpi'
import { sourceLabel } from '../lib/cases'
import { docChangeText } from '../lib/submissions'
import type { ActivityChange, ActivityEntry, Contractor } from '../types'
import { whoName } from '../lib/actor'
import { useTeam } from '../lib/team'
import { useAuthInfo } from '../lib/auth'

const ACTION_LABEL: Record<ActivityEntry['action'], string> = {
  add: 'Added',
  edit: 'Edited',
  close: 'Closed',
  reopen: 'Reopened',
  delete: 'Deleted',
  restore: 'Restored',
  import: 'Imported',
}

export const fmtWhen = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function show(v: unknown, field: string, contractors?: Map<string, Contractor>, ticketNos?: Map<string, string>): string {
  if (v === null || v === undefined || v === '') return '—'
  if (field === 'contractorUuid' && contractors) return contractors.get(String(v))?.name ?? '—'
  if (field === 'linkedTicketUuid') return ticketNos?.get(String(v)) ?? 'a removed ticket'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (field === 'source') return sourceLabel(String(v))
  if (field === 'meetingPct' && typeof v === 'number') return meetingAttended(v) ? 'Yes' : 'No'
  if (field === 'notProvided' && Array.isArray(v)) return v.map((f) => DECLARATIONS.find((x) => x.key === f)?.short ?? f).join(', ') || '—'
  if (Array.isArray(v)) return v.join(', ') || '—'
  const s = String(v)
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}

export function changeText(c: ActivityChange, contractors?: Map<string, Contractor>, ticketNos?: Map<string, string>) {
  return `${FIELD_LABELS[c.field] ?? c.field}: ${show(c.from, c.field, contractors, ticketNos)} → ${show(c.to, c.field, contractors, ticketNos)}`
}

/** The fields the KPI score reads, also written with each document change (said once, by the document line). */
const DOC_MIRRORS = new Set(['wps', 'manpowerDecl', 'salaryDecl', 'notProvided'])

/** One line per change: a document change reads "Water test certificates: waiting → in 2 Nov". */
export function changeLines(changes: ActivityChange[], contractors?: Map<string, Contractor>, ticketNos?: Map<string, string>): string[] {
  const docs = changes.some((c) => c.field === 'docs')
  return changes.flatMap((c) => {
    if (c.field === 'docs') {
      const lines = docChangeText((c.from ?? undefined) as Parameters<typeof docChangeText>[0], (c.to ?? undefined) as Parameters<typeof docChangeText>[1])
      return lines.length ? lines : [changeText(c, contractors, ticketNos)]
    }
    if (docs && DOC_MIRRORS.has(c.field)) return []
    return [changeText(c, contractors, ticketNos)]
  })
}

/** Activity entries for one record, newest first. */
export default function History({
  uuid,
  contractors,
  ticketNos,
}: {
  uuid: string
  contractors?: Map<string, Contractor>
  /** Ticket numbers by uuid (a case's link to its D&C ticket reads as the number). */
  ticketNos?: Map<string, string>
}) {
  const entries = useLiveQuery(() => db.activity.where('entityUuid').equals(uuid).reverse().sortBy('time'), [uuid])
  const team = useTeam()
  const { userId } = useAuthInfo()
  if (!entries || entries.length === 0) return null
  return (
    <>
      <div className="section-label">History</div>
      <div className="list">
        {entries.map((e) => (
          <div key={e.uuid} className="row" style={{ alignItems: 'flex-start' }}>
            <div className="row-main">
              <div className="row-title" style={{ fontSize: 15 }}>
                {ACTION_LABEL[e.action] ?? e.action}
                {whoName(e, team, userId) && <span className="by"> · by {whoName(e, team, userId)}</span>}
              </div>
              {/* a new record lists only its documents (the rest is "Added") */}
              {changeLines(e.action === 'add' ? e.changes.filter((c) => c.field === 'docs') : e.changes, contractors, ticketNos)
                  .slice(0, 6)
                  .map((line, i) => (
                    <div key={i} className="row-sub" style={{ whiteSpace: 'normal' }}>
                      {line}
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
