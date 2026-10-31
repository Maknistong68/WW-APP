import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import Page from '../components/Page'
import History from '../components/History'
import { ConfirmSheet } from '../components/Modal'
import TicketSheet, { CloseTicketSheet } from '../components/TicketSheet'
import { showToast } from '../components/Toast'
import { ageDays, ageTone, isOpen } from '../lib/aging'
import { shortDate } from '../lib/dates'
import { priorityLabel } from '../lib/lists'
import { removeRecord, saveRecord } from '../lib/records'
import { contractorName, ticketLabel, useContractors, woName } from '../lib/useData'
import { sar } from '../lib/money'
import { groupOf, uncombine } from '../lib/groups'
import Icon from '../components/Icon'
import CloseTogetherSheet from '../components/CloseTogetherSheet'
import { TicketRow } from './TicketsPage'

function Field({ label, value }: { label: string; value: string | number }) {
  if (value === '' || value === null || value === undefined) return null
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-trail" style={{ marginLeft: 'auto', textAlign: 'right', whiteSpace: 'normal' }}>
        {value}
      </span>
    </div>
  )
}

export default function TicketDetailPage() {
  const { uuid = '' } = useParams()
  const navigate = useNavigate()
  const { byUuid, woByUuid } = useContractors()
  const t = useLiveQuery(() => db.tickets.get(uuid).then((x) => x ?? null), [uuid])
  const allTickets = useLiveQuery(() => db.tickets.toArray())
  const [sheet, setSheet] = useState<'edit' | 'close' | 'closeGroup' | 'delete' | null>(null)

  if (t === undefined) return null
  if (t === null) {
    return (
      <Page title="Ticket" back="/tickets" backLabel="Tickets" large={false}>
        <div className="empty-state">
          <b>Ticket not found</b>
        </div>
      </Page>
    )
  }
  const days = ageDays(t)
  const open = isOpen(t)
  const group = groupOf(t, allTickets ?? [t])
  const isMember = !!t.parentUuid && group.main.uuid !== t.uuid
  const isMain = !isMember && group.members.length > 0
  const groupTotal = group.main.amountOwed

  return (
    <Page title={t.ticketNo || 'Ticket'} back="/tickets" backLabel="Tickets">
      <div className="list">
        <div className="row">
          <div className="row-main">
            <div className="row-title" style={{ fontWeight: 600 }}>
              {t.issue || 'Ticket'}
            </div>
            <div className="row-sub">
              {t.status} · opened {shortDate(t.openedAt)}
              {t.closedAt ? ` · closed ${shortDate(t.closedAt)}` : ''}
            </div>
          </div>
          <span className={`age-chip ${open ? ageTone(days) : ''}`}>{days}d</span>
        </div>
      </div>

      <div className="list">
        <Field label="Contractor" value={contractorName(byUuid, t.contractorUuid)} />
        <Field label="Work order" value={woName(woByUuid.get(t.workOrderUuid))} />
        <Field
          label={open ? 'Money still owed' : 'Money recovered'}
          value={t.amountOwed ? `${sar(t.amountOwed)}${isMain ? ` · for all ${group.all.length} tickets` : ''}` : ''}
        />
        <Field label="Source" value={t.source} />
        <Field label="Workers" value={t.workers} />
        <Field label="Violations" value={t.violations} />
        <Field label="Category" value={t.category} />
        <Field label="Priority" value={`${t.priority} · ${priorityLabel(t.priority)}`} />
        <Field label="Severity" value={t.severity} />
        <Field label="Channel" value={t.channel} />
        <Field label="Sub-contractor" value={t.subcontractor} />
        <Field label="Assigned to" value={t.assignedTo} />
        <Field label="Contractor action" value={t.contractorAction} />
        <Field label="WW action" value={t.wwAction} />
        <Field label="Notes" value={t.notes} />
      </div>

      {isMember && (
        <>
          <div className="section-label">Combined</div>
          <div className="list">
            <button className="row" onClick={() => navigate(`/tickets/${group.main.uuid}`)}>
              <span className="row-main">
                <div className="row-title">Part of {group.main.ticketNo}</div>
                <div className="row-sub">
                  {group.all.length} tickets{groupTotal ? ` · ${sar(groupTotal)} total` : ''} · money is on the main ticket
                </div>
              </span>
              <span className="row-chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
            <button
              className="row tint"
              onClick={() =>
                void saveRecord('tickets', uncombine(t, group.main.ticketNo), ticketLabel(t, byUuid)).then(() =>
                  showToast({ text: `${t.ticketNo} is no longer combined` }),
                )
              }
            >
              Uncombine
            </button>
          </div>
        </>
      )}
      {isMain && (
        <>
          <div className="section-label">
            Combined tickets · {group.all.length} · {group.workers} workers
            {groupTotal ? ` · ${sar(groupTotal)}` : ''}
          </div>
          <div className="list">
            {group.members.map((m) => (
              <TicketRow key={m.uuid} t={m} sub={`${m.issue || '—'} · ${m.workers} worker${m.workers === 1 ? '' : 's'} · ${m.status}`} />
            ))}
          </div>
        </>
      )}

      <div className="list">
        {open ? (
          <button className="row tint" onClick={() => setSheet(isMain ? 'closeGroup' : 'close')}>
            {isMain ? `Close all ${group.all.length} together` : 'Close ticket'}
          </button>
        ) : (
          <button
            className="row tint"
            onClick={() =>
              void saveRecord('tickets', { ...t, status: 'Open', closedAt: '' }, ticketLabel(t, byUuid), 'reopen').then(
                () => showToast({ text: 'Ticket reopened' }),
              )
            }
          >
            Reopen ticket
          </button>
        )}
        <button className="row tint" onClick={() => setSheet('edit')}>
          Edit
        </button>
      </div>

      <History uuid={t.uuid} contractors={byUuid} />

      <div className="list" style={{ marginTop: 20 }}>
        <button className="row destructive" onClick={() => setSheet('delete')}>
          Delete ticket
        </button>
      </div>

      {sheet === 'edit' && <TicketSheet ticket={t} onClose={() => setSheet(null)} />}
      {sheet === 'close' && <CloseTicketSheet ticket={t} onClose={() => setSheet(null)} />}
      {sheet === 'closeGroup' && (
        <CloseTogetherSheet selected={group.all} all={allTickets ?? []} close onClose={() => setSheet(null)} />
      )}
      {sheet === 'delete' && (
        <ConfirmSheet
          title="Delete ticket?"
          message="It stays in the activity log, but disappears from lists and the dashboard."
          confirmLabel="Delete"
          destructive
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            void removeRecord('tickets', t.uuid, ticketLabel(t, byUuid)).then(() => {
              showToast({ text: 'Ticket deleted' })
              navigate('/tickets')
            })
          }}
        />
      )}
    </Page>
  )
}
