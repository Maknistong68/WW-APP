import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page, { SettingsButton } from '../components/Page'
import Icon from '../components/Icon'
import TicketSheet from '../components/TicketSheet'
import { TicketRow } from './TicketsPage'
import { isOpen } from '../lib/aging'
import { missingSubmissions, overdueTickets } from '../lib/dashboard'
import { monthLabel, monthOf } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { contractorName, newTicket } from '../lib/useData'
import type { Ticket } from '../types'

export default function TodayPage() {
  const navigate = useNavigate()
  const d = useAllData()
  const [adding, setAdding] = useState<Ticket | null>(null)
  const month = monthOf()

  const s = useMemo(() => {
    const open = d.tickets.filter(isOpen)
    const late = overdueTickets(d.tickets)
    const missing = missingSubmissions(d.contractors, d.kpis, month)
    return { open, late, missing }
  }, [d, month])

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const empty = d.loaded && d.tickets.length === 0 && d.contractors.length === 0

  return (
    <Page
      title="Today"
      actions={
        <>
          <button className="nav-btn" aria-label="New ticket" onClick={() => setAdding(newTicket())}>
            <Icon name="plus" size={26} />
          </button>
          <SettingsButton />
        </>
      }
    >
      <div className="chart-sub" style={{ margin: '-6px 4px 12px' }}>
        {today}
      </div>

      <div className="hero-row">
        <button className="hero" onClick={() => navigate('/tickets')}>
          <div className="hero-num">{s.open.length}</div>
          <div className="hero-label">Open tickets</div>
        </button>
        <button className="hero" onClick={() => navigate('/tickets?f=late')}>
          <div className={`hero-num${s.late.length ? ' bad' : ''}`}>{s.late.length}</div>
          <div className="hero-label">Over 30 days</div>
        </button>
        <button className="hero" onClick={() => navigate('/contractors')}>
          <div className={`hero-num${s.missing.length ? ' warn' : ''}`}>{s.missing.length}</div>
          <div className="hero-label">Missing {monthLabel(month).split(' ')[0]} docs</div>
        </button>
      </div>

      {empty ? (
        <>
          <div className="section-label">Get started</div>
          <div className="list">
            <button className="row" onClick={() => navigate('/settings/import')}>
              <span className="row-icon">
                <Icon name="inbox" size={18} />
              </span>
              <span className="row-main">
                <div className="row-title">Import your history</div>
                <div className="row-sub">Violation Log · Ticket Tracker · KPI System</div>
              </span>
              <span className="row-chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
            <button className="row" onClick={() => setAdding(newTicket())}>
              <span className="row-icon">
                <Icon name="plus" size={18} />
              </span>
              <span className="row-main">
                <div className="row-title">Log a ticket</div>
              </span>
              <span className="row-chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
          </div>
        </>
      ) : s.late.length === 0 && s.missing.length === 0 ? (
        <div className="empty-state">
          <Icon name="check" size={44} />
          <b>All clear</b>
          Nothing overdue, all documents in.
        </div>
      ) : (
        <>
          {s.late.length > 0 && (
            <>
              <div className="section-label">Overdue</div>
              <div className="list">
                {s.late.slice(0, 5).map((t) => (
                  <TicketRow key={t.uuid} t={t} name={contractorName(d.byUuid, t.contractorUuid)} />
                ))}
              </div>
              {s.late.length > 5 && (
                <button className="list-foot nav-btn" onClick={() => navigate('/tickets?f=late')}>
                  See all {s.late.length}
                </button>
              )}
            </>
          )}
          {s.missing.length > 0 && (
            <>
              <div className="section-label">Missing {monthLabel(month)} documents</div>
              <div className="list">
                {s.missing.slice(0, 5).map((c) => {
                  const k = d.kpis.find((x) => x.contractorUuid === c.uuid && x.month === month)
                  const miss = [!k?.wps && 'WPS', !k?.manpowerDecl && 'Manpower', !k?.salaryDecl && 'Salary']
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <button key={c.uuid} className="row" onClick={() => navigate(`/contractors/${c.uuid}`)}>
                      <span className="row-main">
                        <div className="row-title">{c.name}</div>
                        <div className="row-sub">{miss}</div>
                      </span>
                      <span className="row-chev">
                        <Icon name="chevron-right" size={18} />
                      </span>
                    </button>
                  )
                })}
              </div>
              {s.missing.length > 5 && (
                <button className="list-foot nav-btn" onClick={() => navigate('/contractors')}>
                  See all {s.missing.length}
                </button>
              )}
            </>
          )}
        </>
      )}

      {adding && <TicketSheet ticket={adding} onClose={() => setAdding(null)} />}
    </Page>
  )
}
