import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import Page, { SettingsButton } from '../components/Page'
import Icon from '../components/Icon'
import SwipeRow from '../components/SwipeRow'
import TicketSheet, { CloseTicketSheet } from '../components/TicketSheet'
import { ageDays, ageTone, isOpen } from '../lib/aging'
import { shortDate } from '../lib/dates'
import { contractorName, newTicket, useContractors } from '../lib/useData'
import type { Ticket } from '../types'

type Filter = 'open' | 'late' | 'closed' | 'all'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'late', label: '30+ days' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

export function TicketRow({ t, name }: { t: Ticket; name: string }) {
  const navigate = useNavigate()
  const days = ageDays(t)
  return (
    <button className="row" onClick={() => navigate(`/tickets/${t.uuid}`)}>
      <div className="row-main">
        <div className="row-title">{name}</div>
        <div className="row-sub">
          {t.issue || '—'} · {t.workers} worker{t.workers === 1 ? '' : 's'}
          {t.source === '' ? ' · ' : ''}
        </div>
      </div>
      {isOpen(t) ? (
        <span className={`age-chip ${ageTone(days)}`}>{days}d</span>
      ) : (
        <span className="row-trail">{shortDate(t.closedAt)}</span>
      )}
      <span className="row-chev">
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  )
}

export default function TicketsPage() {
  const [params, setParams] = useSearchParams()
  const filter = (params.get('f') as Filter) || 'open'
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [closing, setClosing] = useState<Ticket | null>(null)
  const { byUuid } = useContractors()
  const tickets = useLiveQuery(() => db.tickets.toArray())

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (tickets ?? [])
      .filter((t) => {
        if (filter === 'open' && !isOpen(t)) return false
        if (filter === 'late' && !(isOpen(t) && ageDays(t) > 30)) return false
        if (filter === 'closed' && isOpen(t)) return false
        if (!q) return true
        return [contractorName(byUuid, t.contractorUuid), t.issue, t.ticketNo, t.subcontractor, t.category]
          .some((s) => s.toLowerCase().includes(q))
      })
      .sort((a, b) =>
        isOpen(a) && isOpen(b)
          ? ageDays(b) - ageDays(a)
          : (b.closedAt || b.openedAt).localeCompare(a.closedAt || a.openedAt),
      )
  }, [tickets, filter, query, byUuid])

  const workers = visible.reduce((s, t) => s + (t.workers || 0), 0)

  return (
    <Page
      title="Tickets"
      actions={
        <>
          <button className="nav-btn" aria-label="New ticket" onClick={() => setEditing(newTicket())}>
            <Icon name="plus" size={26} />
          </button>
          <SettingsButton />
        </>
      }
    >
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="segmented">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'on' : ''}
            onClick={() => setParams(f.key === 'open' ? {} : { f: f.key }, { replace: true })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tickets && visible.length === 0 ? (
        <div className="empty-state">
          <Icon name="ticket" size={44} />
          <b>{tickets.length === 0 ? 'No tickets yet' : 'Nothing here'}</b>
          {tickets.length === 0 ? 'Tap + to log one.' : 'Try another filter.'}
        </div>
      ) : (
        <>
          <div className="list">
            {visible.map((t) =>
              isOpen(t) ? (
                <SwipeRow key={t.uuid} actionLabel="Close" onAction={() => setClosing(t)}>
                  <TicketRow t={t} name={contractorName(byUuid, t.contractorUuid)} />
                </SwipeRow>
              ) : (
                <TicketRow key={t.uuid} t={t} name={contractorName(byUuid, t.contractorUuid)} />
              ),
            )}
          </div>
          {visible.length > 0 && (
            <div className="list-foot">
              {visible.length} ticket{visible.length === 1 ? '' : 's'} · {workers} workers
              {filter === 'open' && ' · swipe left to close'}
            </div>
          )}
        </>
      )}

      {editing && <TicketSheet ticket={editing} onClose={() => setEditing(null)} />}
      {closing && <CloseTicketSheet ticket={closing} onClose={() => setClosing(null)} />}
    </Page>
  )
}
