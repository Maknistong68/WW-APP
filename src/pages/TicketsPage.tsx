import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Cover from '../components/Cover'
import MediaRow from '../components/MediaRow'
import { showActions } from '../components/ActionSheet'
import { showToast } from '../components/Toast'
import SwipeRow from '../components/SwipeRow'
import TicketSheet, { CloseTicketSheet } from '../components/TicketSheet'
import { useAuthInfo } from '../lib/auth'
import CloseTogetherSheet from '../components/CloseTogetherSheet'
import { memberCounts } from '../lib/groups'
import { ageDays, ageTone, isOpen } from '../lib/aging'
import { shortDate } from '../lib/dates'
import { contractorName, useContractors } from '../lib/useData'
import { sar } from '../lib/money'
import type { Contractor, Ticket, WorkOrder } from '../types'

type Filter = 'open' | 'late' | 'closed' | 'all'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'late', label: '30+d' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

/** "RPCO · WO 882 · Final salary · SAR 4,500" — what's under the ticket number. */
export function ticketSub(t: Ticket, contractors?: Map<string, Contractor>, wos?: Map<string, WorkOrder>): string {
  const wo = wos?.get(t.workOrderUuid)
  return [
    contractors ? contractorName(contractors, t.contractorUuid) : '',
    wo ? `WO ${wo.number}` : '',
    t.issue || '—',
    t.amountOwed ? sar(t.amountOwed) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Copy a ticket number to the clipboard. */
export function copyTicketNo(t: Ticket) {
  void navigator.clipboard?.writeText(t.ticketNo).then(
    () => showToast({ text: `Copied ${t.ticketNo}` }),
    () => showToast({ text: t.ticketNo }),
  )
}

/** Ticket row: the ticket number is the title. In select mode a tap ticks it. */
export function TicketRow({
  t,
  sub,
  group,
  selected,
  onSelect,
  onMore,
}: {
  t: Ticket
  sub?: string
  /** "+2" on a main ticket, "↳ WWCMPL…" on a combined one */
  group?: string
  selected?: boolean
  onSelect?: () => void
  /** Long-press / ⋯ actions; defaults to Open + Copy number. */
  onMore?: () => void
}) {
  const navigate = useNavigate()
  const days = ageDays(t)
  const open = () => navigate(`/tickets/${t.uuid}`)
  const more =
    onMore ??
    (() =>
      showActions({
        title: t.ticketNo || 'Ticket',
        sub: sub ?? ticketSub(t),
        cover: <Cover section="tickets" seed={t.ticketNo} icon="ticket" size={56} />,
        actions: [
          { label: 'Open ticket', icon: 'arrow-right', onSelect: open },
          { label: 'Copy number', icon: 'copy', onSelect: () => copyTicketNo(t) },
        ],
      }))
  return (
    <MediaRow
      selected={selected}
      cover={
        onSelect ? (
          <span className={`select-dot${selected ? ' on' : ''}`} aria-hidden="true">
            {selected && <Icon name="check" size={14} strokeWidth={3} />}
          </span>
        ) : (
          <Cover section="tickets" seed={t.ticketNo} icon="ticket" size={48} />
        )
      }
      title={
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t.ticketNo || 'No number'}
          {group && <span className="group-chip">{group}</span>}
        </span>
      }
      sub={sub ?? ticketSub(t)}
      trail={
        isOpen(t) ? (
          <span className={`age-chip ${ageTone(days)}`}>{days}d</span>
        ) : (
          <span className="row-trail">{shortDate(t.closedAt)}</span>
        )
      }
      onOpen={onSelect ?? open}
      onMore={onSelect ? undefined : more}
    />
  )
}

export default function TicketsPage() {
  const [params, setParams] = useSearchParams()
  const filter = (params.get('f') as Filter) || 'open'
  const [query, setQuery] = useState('')
  const { canEdit } = useAuthInfo()
  const [closing, setClosing] = useState<Ticket | null>(null)
  const [editing, setEditing] = useState<Ticket | null>(null)
  const navigate = useNavigate()
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [together, setTogether] = useState<'close' | 'combine' | null>(null)
  const { byUuid, woByUuid } = useContractors()
  const tickets = useLiveQuery(() => db.tickets.toArray())

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (tickets ?? [])
      .filter((t) => {
        if (filter === 'open' && !isOpen(t)) return false
        if (filter === 'late' && !(isOpen(t) && ageDays(t) > 30)) return false
        if (filter === 'closed' && isOpen(t)) return false
        if (!q) return true
        return [t.ticketNo, contractorName(byUuid, t.contractorUuid), woByUuid.get(t.workOrderUuid)?.number ?? '', t.issue, t.subcontractor, t.category]
          .some((s) => s.toLowerCase().includes(q))
      })
      .sort((a, b) =>
        isOpen(a) && isOpen(b)
          ? ageDays(b) - ageDays(a)
          : (b.closedAt || b.openedAt).localeCompare(a.closedAt || a.openedAt),
      )
  }, [tickets, filter, query, byUuid, woByUuid])

  const workers = visible.reduce((s, t) => s + (t.workers || 0), 0)
  const byTicketUuid = useMemo(() => new Map((tickets ?? []).map((t) => [t.uuid, t])), [tickets])
  const members = useMemo(() => memberCounts(tickets ?? []), [tickets])
  const groupLabel = (t: Ticket) =>
    t.parentUuid ? `↳ ${byTicketUuid.get(t.parentUuid)?.ticketNo ?? 'combined'}` : members.get(t.uuid) ? `+${members.get(t.uuid)}` : undefined
  const toggle = (uuid: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(uuid)) n.delete(uuid)
      else n.add(uuid)
      return n
    })
  const pickedTickets = (tickets ?? []).filter((t) => picked.has(t.uuid))
  const endSelect = () => {
    setSelecting(false)
    setPicked(new Set())
  }
  // Hide the global + while the select bar is up.
  useEffect(() => {
    document.body.classList.toggle('selecting', selecting)
    return () => document.body.classList.remove('selecting')
  }, [selecting])
  /** Long-press / ⋯ on a ticket. */
  const more = (t: Ticket) =>
    showActions({
      title: t.ticketNo || 'Ticket',
      sub: ticketSub(t, byUuid, woByUuid),
      cover: <Cover section="tickets" seed={t.ticketNo} icon="ticket" size={56} />,
      actions: [
        { label: 'Open ticket', icon: 'arrow-right', onSelect: () => navigate(`/tickets/${t.uuid}`) },
        ...(isOpen(t) ? [{ label: 'Close ticket', icon: 'check-circle' as const, onSelect: () => setClosing(t), edit: true }] : []),
        { label: 'Edit', icon: 'pencil', onSelect: () => setEditing(t), edit: true },
        { label: 'Copy number', icon: 'copy', onSelect: () => copyTicketNo(t) },
        {
          label: 'Select several',
          icon: 'checklist',
          edit: true,
          onSelect: () => {
            setSelecting(true)
            setPicked(new Set([t.uuid]))
          },
        },
      ],
    })

  const counts = useMemo(() => {
    const all = tickets ?? []
    const open = all.filter(isOpen)
    return {
      open: open.length,
      late: open.filter((t) => ageDays(t) > 30).length,
      closed: all.length - open.length,
      all: all.length,
    } as Record<Filter, number>
  }, [tickets])

  return (
    <Page
      title="Tickets"
      actions={
        selecting ? (
          <button className="nav-btn strong" onClick={endSelect}>
            Done
          </button>
        ) : (
          canEdit && (
            <button className="nav-btn" onClick={() => setSelecting(true)}>
              Select
            </button>
          )
        )
      }
    >
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Ticket no., contractor, WO, issue" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="segmented">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'on' : ''}
            onClick={() => setParams(f.key === 'open' ? {} : { f: f.key }, { replace: true })}
          >
            {f.label} {tickets ? <b style={{ fontVariantNumeric: 'tabular-nums' }}>{counts[f.key]}</b> : null}
          </button>
        ))}
      </div>

      {tickets && visible.length === 0 ? (
        <div className="empty-state">
          <Icon name="ticket" size={44} />
          <b>{tickets.length === 0 ? 'No tickets yet' : 'Nothing here'}</b>
          {tickets.length === 0 ? (canEdit ? 'Tap + to log one.' : 'Nothing logged yet.') : 'Try another filter.'}
        </div>
      ) : (
        <>
          <div className="list">
            {visible.map((t) =>
              selecting ? (
                <TicketRow
                  key={t.uuid}
                  t={t}
                  sub={ticketSub(t, byUuid, woByUuid)}
                  group={groupLabel(t)}
                  selected={picked.has(t.uuid)}
                  onSelect={() => toggle(t.uuid)}
                />
              ) : isOpen(t) && canEdit ? (
                <SwipeRow key={t.uuid} actionLabel="Close" onAction={() => setClosing(t)}>
                  <TicketRow t={t} sub={ticketSub(t, byUuid, woByUuid)} group={groupLabel(t)} onMore={() => more(t)} />
                </SwipeRow>
              ) : (
                <TicketRow key={t.uuid} t={t} sub={ticketSub(t, byUuid, woByUuid)} group={groupLabel(t)} onMore={() => more(t)} />
              ),
            )}
          </div>
          {visible.length > 0 && (
            <div className="list-foot">
              {visible.length} ticket{visible.length === 1 ? '' : 's'} · {workers} workers
              {filter === 'open' && !selecting && canEdit && ' · swipe left to close · hold for more'}
            </div>
          )}
        </>
      )}

      {selecting && <div style={{ height: 70 }} />}
      {selecting && (
        <div className="save-bar btn-row" style={{ marginTop: 0 }}>
          <button className="btn" disabled={picked.size < 2} onClick={() => setTogether('combine')}>
            Combine {picked.size >= 2 ? `(${picked.size})` : ''}
          </button>
          <button className="btn primary" disabled={picked.size < 2} onClick={() => setTogether('close')}>
            {picked.size < 2 ? 'Tick 2 or more' : `Close together (${picked.size})`}
          </button>
        </div>
      )}
      {together && (
        <CloseTogetherSheet
          selected={pickedTickets}
          all={tickets ?? []}
          close={together === 'close'}
          onClose={(done) => {
            setTogether(null)
            if (done) endSelect()
          }}
        />
      )}
      {editing && <TicketSheet ticket={editing} onClose={() => setEditing(null)} />}
      {closing && <CloseTicketSheet ticket={closing} onClose={() => setClosing(null)} />}
    </Page>
  )
}
