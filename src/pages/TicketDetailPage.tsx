import { useState } from 'react'
import { useCachedLiveQuery } from '../lib/useCachedQuery'
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
import { tryWrite } from '../lib/safeWrite'
import { contractorName, ticketLabel, useContractors, woName } from '../lib/useData'
import { sar, sarShort } from '../lib/money'
import { groupOf, uncombine } from '../lib/groups'
import Icon from '../components/Icon'
import CloseTogetherSheet from '../components/CloseTogetherSheet'
import { TicketRow } from './TicketsPage'
import Summary from '../components/Summary'
import IconTile from '../components/IconTile'
import { useLiveQuery } from 'dexie-react-hooks'
import StatusChip from '../components/StatusChip'
import { lastAction, whoName } from '../lib/actor'
import { useTeam } from '../lib/team'
import ActionBar from '../components/ActionBar'
import { ticketTone } from '../lib/tone'
import { ticketMenu } from '../components/menus'
import { useAuthInfo } from '../lib/auth'
import { isCase, noun, sourceLabel } from '../lib/cases'

function Field({ label, value, onOpen }: { label: string; value: string | number; onOpen?: () => void }) {
  if (value === '' || value === null || value === undefined) return null
  if (onOpen) {
    return (
      <button className="row" style={{ width: '100%', border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left' }} onClick={onOpen}>
        <span className="row-label">{label}</span>
        <span className="row-trail" style={{ marginLeft: 'auto', textAlign: 'right', whiteSpace: 'normal', color: 'var(--brand)', fontWeight: 600 }}>
          {value}
        </span>
        <Icon name="chevron-right" size={18} className="irow-chev" />
      </button>
    )
  }
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
  const t = useCachedLiveQuery(`ticket:${uuid}`, () => db.tickets.get(uuid).then((x) => x ?? null), [uuid])
  const allTickets = useCachedLiveQuery('tickets', () => db.tickets.toArray())
  const [sheet, setSheet] = useState<'edit' | 'close' | 'closeGroup' | 'delete' | null>(null)
  const { canEdit, userId } = useAuthInfo()
  const team = useTeam()
  // who closed it: the newest "close" in its history
  const closedBy = useLiveQuery(async () => {
    const e = lastAction(await db.activity.where('entityUuid').equals(uuid).toArray(), 'close')
    return e ? whoName(e, team, userId) : null
  }, [uuid, team, userId])

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
  // A case (the team's own) says "case" and goes back to the Cases tab; a D&C ticket to D&C.
  const kind = noun(t)
  const Kind = kind === 'case' ? 'Case' : 'Ticket'
  const list = isCase(t) ? '/tickets?tab=internal' : '/tickets'
  const listLabel = isCase(t) ? 'Cases' : 'Tickets'
  const isMember = !!t.parentUuid && group.main.uuid !== t.uuid
  const isMain = !isMember && group.members.length > 0
  const groupTotal = group.main.amountOwed
  const tone = ticketTone(t)
  const reopen = () =>
    void tryWrite(`Reopen ${t.ticketNo}`, () => saveRecord('tickets', { ...t, status: 'Open', closedAt: '' }, ticketLabel(t, byUuid), 'reopen')).then(
      (ok) => ok && showToast({ text: `${Kind} reopened` }),
    )
  const more = () =>
    ticketMenu(t, { members: isMain ? group.members.length : 0, onDeleted: () => navigate(list) })

  return (
    <Page title={t.ticketNo || Kind} back={list} backLabel={listLabel} album>
      <Summary
        tile={<IconTile icon={open ? (isCase(t) ? 'megaphone' : 'ticket') : 'check'} tone={tone} size={64} />}
        title={t.ticketNo || Kind}
        sub={[t.issue || Kind, contractorName(byUuid, t.contractorUuid)].filter(Boolean).join(' · ')}
        chips={
          <>
            <StatusChip tone={tone}>{open ? (days > 30 ? 'Overdue' : days > 10 ? 'Due soon' : 'Open') : 'Closed'}</StatusChip>
            <StatusChip tone="none" icon="calendar">
              Opened {shortDate(t.openedAt)}
              {t.closedAt ? ` · closed ${shortDate(t.closedAt)}` : ''}
              {!open && closedBy ? ` by ${closedBy}` : ''}
            </StatusChip>
          </>
        }
        facts={[
          { label: open ? 'Days open' : 'Days to close', value: days, tone: open ? (days > 30 ? 'bad' : days > 10 ? 'warn' : 'good') : undefined },
          { label: 'Workers', value: t.workers || 0 },
          { label: open ? 'SAR still owed' : 'SAR recovered', value: t.amountOwed ? sarShort(t.amountOwed) : '—', tone: open && t.amountOwed ? 'bad' : undefined },
          { label: `Priority ${t.priority}`, value: priorityLabel(t.priority) },
        ]}
      />

      <div className="info-card">
        <Field
          label="Contractor"
          value={contractorName(byUuid, t.contractorUuid)}
          onOpen={t.contractorUuid && byUuid.has(t.contractorUuid) ? () => navigate(`/contractors/${t.contractorUuid}`) : undefined}
        />
        <Field
          label="Work order"
          value={woName(woByUuid.get(t.workOrderUuid))}
          onOpen={t.contractorUuid && woByUuid.has(t.workOrderUuid) ? () => navigate(`/contractors/${t.contractorUuid}`) : undefined}
        />
        <Field
          label={open ? 'Money still owed' : 'Money recovered'}
          value={
            t.amountOwed
              ? `${sar(t.amountOwed)}${isMain ? ` (${group.all.length} ${kind}s)` : ''}`
              : t.amountOwed === 0 && !open
                ? 'None'
                : ''
          }
        />
        <Field label="Source" value={sourceLabel(t.source)} />
        <Field label="Violations" value={t.violations} />
        <Field label="Category" value={t.category} />
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
                  {group.all.length} {kind}s{groupTotal ? ` · ${sar(groupTotal)} total` : ''} · money is on the main {kind}
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
                void tryWrite(`Uncombine ${t.ticketNo}`, () => saveRecord('tickets', uncombine(t, group.main.ticketNo), ticketLabel(t, byUuid))).then(
                  (ok) => ok && showToast({ text: `${t.ticketNo} is no longer combined` }),
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
            Combined {kind}s · {group.all.length} · {group.workers} workers
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

      <ActionBar
        secondary={[
          ...(canEdit ? [{ icon: 'pencil' as const, label: 'Edit', onClick: () => setSheet('edit') }] : []),
          { icon: 'dots', label: 'More actions', onClick: more },
        ]}
        primary={
          !canEdit
            ? undefined
            : open
              ? { icon: 'check-circle', label: isMain ? `Close all ${group.all.length}` : `Close ${kind}`, onClick: () => setSheet(isMain ? 'closeGroup' : 'close') }
              : { icon: 'undo', label: `Reopen ${kind}`, onClick: reopen }
        }
      />
      {sheet === 'edit' && <TicketSheet ticket={t} onClose={() => setSheet(null)} />}
      {sheet === 'close' && <CloseTicketSheet ticket={t} onClose={() => setSheet(null)} />}
      {sheet === 'closeGroup' && (
        <CloseTogetherSheet selected={group.all} all={allTickets ?? []} close onClose={() => setSheet(null)} />
      )}
      {sheet === 'delete' && (
        <ConfirmSheet
          title={`Delete ${t.ticketNo || `this ${kind}`}?`}
          message="It stays in the activity log, but disappears from lists and the dashboard."
          confirmLabel={`Delete ${kind}`}
          destructive
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            void removeRecord('tickets', t.uuid, ticketLabel(t, byUuid)).then(() => {
              showToast({ text: `${Kind} deleted` })
              navigate(list)
            })
          }}
        />
      )}
    </Page>
  )
}
