import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import Page from '../components/Page'
import History from '../components/History'
import { ConfirmSheet } from '../components/Modal'
import TicketSheet, { CloseTicketSheet } from '../components/TicketSheet'
import { showToast } from '../components/Toast'
import { ageDays, isOpen } from '../lib/aging'
import { shortDate } from '../lib/dates'
import { priorityLabel } from '../lib/lists'
import { removeRecord, saveRecord } from '../lib/records'
import { contractorName, ticketLabel, useContractors, woName } from '../lib/useData'
import { sar } from '../lib/money'
import { groupOf, uncombine } from '../lib/groups'
import Icon from '../components/Icon'
import CloseTogetherSheet from '../components/CloseTogetherSheet'
import { TicketRow, copyTicketNo } from './TicketsPage'
import AlbumHeader from '../components/AlbumHeader'
import Cover from '../components/Cover'
import { showActions } from '../components/ActionSheet'
import { useAuthInfo } from '../lib/auth'

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
  const { canEdit } = useAuthInfo()

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
  const reopen = () =>
    void saveRecord('tickets', { ...t, status: 'Open', closedAt: '' }, ticketLabel(t, byUuid), 'reopen').then(() =>
      showToast({ text: 'Ticket reopened' }),
    )
  const more = () =>
    showActions({
      title: t.ticketNo || 'Ticket',
      sub: t.issue,
      cover: <Cover section="tickets" seed={t.ticketNo} icon="ticket" size={56} />,
      actions: [
        ...(open
          ? [{ label: isMain ? `Close all ${group.all.length} together` : 'Close ticket', icon: 'check-circle' as const, onSelect: () => setSheet(isMain ? 'closeGroup' : 'close'), edit: true }]
          : [{ label: 'Reopen ticket', icon: 'undo' as const, onSelect: reopen, edit: true }]),
        { label: 'Edit', icon: 'pencil', onSelect: () => setSheet('edit'), edit: true },
        { label: 'Copy number', icon: 'copy', onSelect: () => copyTicketNo(t) },
        ...(isMember ? [{ label: `Open main ticket ${group.main.ticketNo}`, icon: 'arrow-right' as const, onSelect: () => navigate(`/tickets/${group.main.uuid}`) }] : []),
        { label: 'Delete ticket', icon: 'trash', onSelect: () => setSheet('delete'), danger: true, edit: true },
      ],
    })

  return (
    <Page title={t.ticketNo || 'Ticket'} back="/tickets" backLabel="Tickets" album>
      <AlbumHeader
        cover={<Cover section="tickets" seed={t.ticketNo} icon="ticket" size={156} />}
        title={t.ticketNo || 'Ticket'}
        sub={[t.issue || 'Ticket', contractorName(byUuid, t.contractorUuid)].filter(Boolean).join(' · ')}
        meta={
          <>
            <span className={`status-chip ${open ? (days > 30 ? 'bad' : days > 10 ? 'warn' : '') : 'good'}`}>
              {open ? `${t.status} · ${days}d` : 'Closed'}
            </span>
            <span>
              Opened {shortDate(t.openedAt)}
              {t.closedAt ? ` · closed ${shortDate(t.closedAt)}` : ''}
            </span>
          </>
        }
        buttons={[
          ...(canEdit ? [{ icon: 'pencil' as const, label: 'Edit', onClick: () => setSheet('edit') }] : []),
          { icon: 'copy', label: 'Copy number', onClick: () => copyTicketNo(t) },
          { icon: 'dots', label: 'More actions', onClick: more },
        ]}
        primary={
          !canEdit
            ? undefined
            : open
              ? { icon: 'check', label: isMain ? `Close all ${group.all.length} together` : 'Close ticket', onClick: () => setSheet(isMain ? 'closeGroup' : 'close') }
              : { icon: 'undo', label: 'Reopen ticket', onClick: reopen }
        }
      />

      <div className="info-card">
        <Field label="Contractor" value={contractorName(byUuid, t.contractorUuid)} />
        <Field label="Work order" value={woName(woByUuid.get(t.workOrderUuid))} />
        <Field
          label={open ? 'Money still owed' : 'Money recovered'}
          value={t.amountOwed ? `${sar(t.amountOwed)}${isMain ? ` (${group.all.length} tickets)` : ''}` : ''}
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
            {canEdit && (
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
            )}
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

      <History uuid={t.uuid} contractors={byUuid} />

      {sheet === 'edit' && <TicketSheet ticket={t} onClose={() => setSheet(null)} />}
      {sheet === 'close' && <CloseTicketSheet ticket={t} onClose={() => setSheet(null)} />}
      {sheet === 'closeGroup' && (
        <CloseTogetherSheet selected={group.all} all={allTickets ?? []} close onClose={() => setSheet(null)} />
      )}
      {sheet === 'delete' && (
        <ConfirmSheet
          title={`Delete ${t.ticketNo || 'this ticket'}?`}
          message="It stays in the activity log, but disappears from lists and the dashboard."
          confirmLabel="Delete ticket"
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
