import { useMemo, useState } from 'react'
import { useCachedLiveQuery } from '../lib/useCachedQuery'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import Page from '../components/Page'
import Icon from '../components/Icon'
import IconTile from '../components/IconTile'
import ItemRow from '../components/ItemRow'
import SourceTabs from '../components/SourceTabs'
import CardList from '../components/CardList'
import ActionBar from '../components/ActionBar'
import { ticketTone } from '../lib/tone'
import SwipeRow from '../components/SwipeRow'
import { ticketMenu } from '../components/menus'
import { openSheet } from '../components/SheetHost'
import { QUERY_KEYS, filterTickets, hasQuery, parseSourceTab, parseTicketQuery, queryChips, sourceTab, type SourceTab } from '../lib/ticketFilter'
import { haptic } from '../lib/haptics'
import { useAuthInfo } from '../lib/auth'
import CloseTogetherSheet from '../components/CloseTogetherSheet'
import { memberCounts, sameKind } from '../lib/groups'
import { linkIndex, linkText } from '../lib/caseLinks'
import { showToast } from '../components/Toast'
import { ageDays, ageLabel, isOpen } from '../lib/aging'
import { monthLabel } from '../lib/dates'
import { contractorName, ticketSub, useContractors } from '../lib/useData'
import { shortName } from '../lib/names'
import type { Contractor, Ticket, WorkOrder } from '../types'

type Filter = 'open' | 'late' | 'closed' | 'all'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'late', label: '30+d' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

/** The pop-up's line under the ticket number (lives in src/lib/useData.ts). */
export { ticketSub } from '../lib/useData'

/** Copy a ticket number to the clipboard. */
export { copyTicketNo } from '../components/menus'

/**
 * Ticket row: the tile shows its age ("4D", "6W", "4M") in its due colour (0–10 / 11–30 / over 30
 * days; a check once closed); the contractor's short name is the title, with the ticket number · WO · issue · money
 * below. No ⋯: hold opens the pop-up. Without `contractors` (a contractor's own page) the ticket
 * number is the title. In select mode a tap ticks it.
 */
export function TicketRow({
  t,
  contractors,
  wos,
  sub,
  group,
  link,
  selected,
  onSelect,
  onMore,
}: {
  t: Ticket
  /** Contractor names for the title. */
  contractors?: Map<string, Contractor>
  /** Work orders, for "WO 882" on the line below. */
  wos?: Map<string, WorkOrder>
  /** What follows the ticket number on the line below; defaults to WO · issue · money. */
  sub?: string
  /** "+2" on a main ticket, "↳ WWCMPL…" on a combined one */
  group?: string
  /** "→ WWCMPL-123" on a case that turned into a D&C ticket, "From CASE-0004" on that ticket */
  link?: string
  selected?: boolean
  onSelect?: () => void
  /** Long-press actions; defaults to the shared ticket menu. */
  onMore?: () => void
}) {
  const navigate = useNavigate()
  const tone = ticketTone(t)
  const open = () => navigate(`/tickets/${t.uuid}`)
  const members = group?.startsWith('+') ? Number(group.slice(1)) || 0 : 0
  const more = onMore ?? (() => ticketMenu(t, { sub: ticketSub(t, contractors, wos), members }))
  const number = t.ticketNo || 'No number'
  const who = contractors?.get(t.contractorUuid)?.name
  // "CASE-0001 → WWCMPL0009001" on a linked case; "From CASE-0001" after a ticket's number
  const toTicket = !!link && link.startsWith('→')
  const lead = contractors ? (toTicket ? `${number} ${link}` : number) : toTicket ? link : ''
  const line = [lead, !toTicket ? link : '', sub ?? ticketSub(t, undefined, wos)].filter(Boolean).join(' · ')
  return (
    <ItemRow
      selected={selected}
      tile={
        onSelect ? (
          <span className={`select-dot${selected ? ' on' : ''}`} aria-hidden="true">
            {selected && <Icon name="check" size={16} strokeWidth={3} />}
          </span>
        ) : (
          // how old it is ("4D", "6W", "4M") in its due colour: green 0–10 days, amber 11–30, red over 30;
          // a check once closed
          isOpen(t) ? <IconTile label={ageLabel(ageDays(t))} tone={tone} size={52} /> : <IconTile icon="check" tone={tone} size={52} />
        )
      }
      title={
        <span style={contractors ? undefined : { fontVariantNumeric: 'tabular-nums' }}>
          {contractors ? (who ? shortName(who) : 'No contractor') : number}
          {group && <span className="group-chip">{group}</span>}
          {link && <span className="group-chip link-chip">{toTicket ? '→ D&C' : 'From case'}</span>}
        </span>
      }
      sub={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{line}</span>}
      onOpen={onSelect ?? open}
      onMore={onSelect ? undefined : more}
      moreButton={false}
    />
  )
}

/** Open tickets by age (oldest group first); closed ones by the month they closed. */
export function groupTickets(list: Ticket[]): { key: string; title: string; items: Ticket[] }[] {
  const open = list.filter(isOpen)
  const closed = list.filter((t) => !isOpen(t))
  const groups = [
    { key: 'late', title: 'Over 30 days', items: open.filter((t) => ageDays(t) > 30) },
    { key: 'risk', title: '11–30 days', items: open.filter((t) => ageDays(t) > 10 && ageDays(t) <= 30) },
    { key: 'ok', title: '0–10 days', items: open.filter((t) => ageDays(t) <= 10) },
  ]
  const byMonth = new Map<string, Ticket[]>()
  for (const t of closed) {
    const m = (t.closedAt || t.openedAt).slice(0, 7)
    byMonth.set(m, [...(byMonth.get(m) ?? []), t])
  }
  const months = [...byMonth.entries()].map(([m, items]) => ({ key: m, title: `Closed · ${m ? monthLabel(m) : 'no date'}`, items }))
  return [...groups, ...months].filter((g) => g.items.length > 0)
}

export default function TicketsPage() {
  const [params, setParams] = useSearchParams()
  const filter = (params.get('f') as Filter) || 'open'
  // Filters from the link (a Dashboard number, a chart bar, a contractor…)
  const linkQuery = useMemo(() => parseTicketQuery(params), [params])
  const drilled = hasQuery(linkQuery)
  // D&C Tickets | Cases; a link that names a source (a Dashboard bar) decides it instead.
  const source = parseSourceTab(params)
  const bySource = linkQuery.src === undefined
  /** Showing the team's own cases: the title, search and counts say "case". */
  const showingCases = bySource ? source === 'internal' : linkQuery.src === 'Internal'
  const noun = showingCases ? 'case' : 'ticket'
  const [query, setQuery] = useState('')
  const { canEdit, role } = useAuthInfo()
  const navigate = useNavigate()
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [together, setTogether] = useState<'close' | 'combine' | null>(null)
  const { byUuid, woByUuid } = useContractors()
  const tickets = useCachedLiveQuery('tickets', () => db.tickets.toArray())

  /** The tickets the link and the D&C Tickets | Cases tab point at, before the filter and the search. */
  const scoped = useMemo(
    () => filterTickets(tickets ?? [], { ...linkQuery, f: undefined }).filter((t) => !bySource || sourceTab(t) === source),
    [tickets, linkQuery, bySource, source],
  )
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scoped
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
  }, [scoped, filter, query, byUuid, woByUuid])

  const chips = queryChips(linkQuery, {
    contractor: (uuid) => byUuid.get(uuid)?.name ?? 'Contractor',
    workOrder: (uuid) => `WO ${woByUuid.get(uuid)?.number ?? '?'}`,
  })
  /** Remove one filter (or all), keeping the rest of the link. */
  const removeChip = (keys: readonly string[] | 'all') => {
    haptic('tick')
    const next = new URLSearchParams(params)
    for (const k of keys === 'all' ? QUERY_KEYS : keys) next.delete(k)
    if (keys === 'all') next.delete('from')
    setParams(next, { replace: true })
  }
  const setSource = (k: SourceTab) => {
    // a case and a D&C ticket are never ticked together
    setPicked(new Set())
    const next = new URLSearchParams(params)
    if (k === 'tickets') next.delete('tab')
    else next.set('tab', k)
    setParams(next, { replace: true })
  }
  const setTab = (f: Filter) => {
    const next = new URLSearchParams(params)
    if (f === 'open' && !drilled) next.delete('f')
    else next.set('f', f)
    setParams(next, { replace: true })
  }

  const workers = visible.reduce((s, t) => s + (t.workers || 0), 0)
  const byTicketUuid = useMemo(() => new Map((tickets ?? []).map((t) => [t.uuid, t])), [tickets])
  const members = useMemo(() => memberCounts(tickets ?? []), [tickets])
  const links = useMemo(() => linkIndex(tickets ?? []), [tickets])
  const linkLabel = (t: Ticket) => linkText(t, links, byTicketUuid) || undefined
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
  const startTogether = (how: 'close' | 'combine') => {
    if (!sameKind(pickedTickets)) return showToast({ text: 'Cases and D&C tickets can’t be combined' })
    setTogether(how)
  }
  const endSelect = () => {
    setSelecting(false)
    setPicked(new Set())
  }
  /** Holding a ticket: the shared ticket menu, plus "Select several" here. */
  const more = (t: Ticket) =>
    ticketMenu(t, {
      sub: ticketSub(t, byUuid, woByUuid),
      members: t.parentUuid ? 0 : (members.get(t.uuid) ?? 0),
      extra: [
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
    const open = scoped.filter(isOpen)
    return {
      open: open.length,
      late: open.filter((t) => ageDays(t) > 30).length,
      closed: scoped.length - open.length,
      all: scoped.length,
    } as Record<Filter, number>
  }, [scoped])
  const from = params.get('from')

  return (
    <Page
      title={showingCases ? 'Cases' : 'Tickets'}
      back={drilled ? (from ?? '/dashboard') : undefined}
      backLabel={drilled ? (from?.startsWith('/contractors') ? 'Contractor' : from?.startsWith('/kpis') ? 'KPI' : 'Dashboard') : undefined}
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
      {bySource && <SourceTabs value={source} onChange={setSource} />}
      <label className="ios-search">
        <Icon name="search" size={18} />
        <input type="search" placeholder={`${showingCases ? 'Case' : 'Ticket'} no., contractor, WO, issue`} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {drilled && (
        <div className="chip-row drill-chips" aria-label="Filters">
          {chips.map((c) => (
            <span key={c.label} className="filter-chip">
              {c.label}
              <button aria-label={`Remove filter ${c.label}`} onClick={() => removeChip(c.keys)}>
                <Icon name="x" size={16} strokeWidth={2.6} />
              </button>
            </span>
          ))}
          <button className="clear-btn" onClick={() => removeChip('all')}>
            Clear
          </button>
        </div>
      )}
      <div className="segmented fit" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'on' : ''}
            aria-pressed={filter === f.key}
            onClick={() => setTab(f.key)}
          >
            {f.label}
            <b>{tickets ? counts[f.key] : '–'}</b>
          </button>
        ))}
      </div>

      {tickets && visible.length === 0 ? (
        <div className="empty-state">
          <Icon name="ticket" size={44} />
          <b>{tickets.length === 0 ? 'No tickets yet' : showingCases && scoped.length === 0 ? 'No cases yet' : 'Nothing here'}</b>
          {tickets.length === 0 ? (canEdit ? 'Tap Create to log one.' : 'Nothing logged yet.') : 'Try another filter.'}
        </div>
      ) : (
        <>
          {groupTickets(visible).map((g) => (
            <CardList key={g.key} title={g.title} count={g.items.length}>
            {g.items.map((t) =>
              selecting ? (
                <TicketRow
                  key={t.uuid}
                  t={t}
                  contractors={byUuid}
                  wos={woByUuid}
                  group={groupLabel(t)}
                  link={linkLabel(t)}
                  selected={picked.has(t.uuid)}
                  onSelect={() => toggle(t.uuid)}
                />
              ) : isOpen(t) && canEdit ? (
                <SwipeRow key={t.uuid} actionLabel="Close" onAction={() => openSheet({ kind: 'ticketClose', uuid: t.uuid })}>
                  <TicketRow t={t} contractors={byUuid} wos={woByUuid} group={groupLabel(t)} link={linkLabel(t)} onMore={() => more(t)} />
                </SwipeRow>
              ) : (
                <TicketRow key={t.uuid} t={t} contractors={byUuid} wos={woByUuid} group={groupLabel(t)} link={linkLabel(t)} onMore={() => more(t)} />
              ),
            )}
            </CardList>
          ))}
          {visible.length > 0 && (
            <div className="list-foot">
              {visible.length} {noun}{visible.length === 1 ? '' : 's'} · {workers} workers
              {!selecting && (filter === 'open' && canEdit ? ' · swipe left to close · hold for more' : ' · hold for more')}
            </div>
          )}
        </>
      )}

      {role === 'admin' && !selecting && (
        <div className="list" style={{ marginTop: 8 }}>
          <button className="row" onClick={() => navigate('/tickets/removed')}>
            <span className="row-main">Removed tickets</span>
            <Icon name="chevron-right" size={20} />
          </button>
        </div>
      )}
      {selecting && (
        <ActionBar
          secondary={[{ label: 'Combine', icon: 'checklist', onClick: () => startTogether('combine'), disabled: picked.size < 2 }]}
          primary={{
            label: picked.size < 2 ? 'Tick 2 or more' : `Close together (${picked.size})`,
            icon: 'check-circle',
            onClick: () => startTogether('close'),
            disabled: picked.size < 2,
          }}
        />
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
    </Page>
  )
}
