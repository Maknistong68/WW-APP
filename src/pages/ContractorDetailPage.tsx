import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import History from '../components/History'
import ContractorSheet from '../components/ContractorSheet'
import KpiSheet, { ManpowerSheet, emptyKpi, emptyManpower } from '../components/KpiSheet'
import { TicketRow } from './TicketsPage'
import { isOpen } from '../lib/aging'
import { addMonths, monthLabel, monthOf, shortDate } from '../lib/dates'
import { KPI_PARTS, STATUS_LABEL, computeKpi, pct } from '../lib/kpi'
import { auditPctFor, useAllData } from '../lib/kpiData'
import { mentions } from '../lib/names'

function Ring({ value, status }: { value: number | null; status: string }) {
  const r = 30
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value ?? 0))
  const color = status === 'good' ? 'var(--green)' : status === 'warn' ? 'var(--amber-border)' : status === 'bad' ? 'var(--red)' : 'var(--separator)'
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--gray-bg)" strokeWidth="8" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform="rotate(-90 38 38)"
      />
    </svg>
  )
}

export default function ContractorDetailPage() {
  const { uuid = '' } = useParams()
  const navigate = useNavigate()
  const d = useAllData()
  const [month, setMonth] = useState(monthOf())
  const [sheet, setSheet] = useState<'edit' | 'kpi' | 'manpower' | null>(null)
  const c = d.byUuid.get(uuid)

  const data = useMemo(() => {
    if (!c) return null
    const tickets = d.tickets.filter((t) => t.contractorUuid === c.uuid)
    const kpi = d.kpis.find((k) => k.contractorUuid === c.uuid && k.month === month)
    const manpower = d.manpower.find((m) => m.contractorUuid === c.uuid && m.month === month)
    const auditPct = auditPctFor(c, d.inspections, month)
    const result = computeKpi({ kpi, manpower, tickets, month, auditPct })
    const audits = d.inspections
      .filter((i) => mentions(i.info?.contractorNames ?? '', [c.name, ...c.aliases]))
      .sort((a, b) => (a.info.reviewDate < b.info.reviewDate ? 1 : -1))
    return { tickets, kpi, manpower, auditPct, result, lastAudit: audits[0] }
  }, [c, d, month])

  if (!d.loaded) return null
  if (!c || !data) {
    return (
      <Page title="Contractor" back="/contractors" backLabel="Contractors" large={false}>
        <div className="empty-state">
          <b>Contractor not found</b>
        </div>
      </Page>
    )
  }
  const { result, kpi, manpower } = data
  const open = data.tickets.filter(isOpen).sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  const mark = (v: boolean | undefined, label: string) => (
    <span className={v ? 'yes' : 'no'}>
      <Icon name={v ? 'check' : 'x'} size={16} strokeWidth={2.6} /> {label}
    </span>
  )

  return (
    <Page
      title={c.name}
      back="/contractors"
      backLabel="Contractors"
      actions={
        <button className="nav-btn" onClick={() => setSheet('edit')}>
          Edit
        </button>
      }
    >
      <div className="segmented" style={{ gridTemplateColumns: '44px 1fr 44px', display: 'grid', gridAutoFlow: 'unset' }}>
        <button aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <button className="on">{monthLabel(month)}</button>
        <button aria-label="Next month" disabled={month >= monthOf()} onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>

      <div className="ring-wrap">
        <div style={{ position: 'relative' }}>
          <Ring value={result.overall} status={result.status} />
          <div className="ring-num" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 17 }}>
            {pct(result.overall)}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 17 }}>
            <span className={`status-dot ${result.status}`} style={{ marginRight: 6 }} />
            {STATUS_LABEL[result.status]}
          </div>
          <div className="checks" style={{ marginTop: 6 }}>
            {mark(kpi?.wps, 'WPS')}
            {mark(kpi?.manpowerDecl, 'Manpower')}
            {mark(kpi?.salaryDecl, 'Salary')}
          </div>
        </div>
      </div>

      <div className="list">
        {KPI_PARTS.map((p) => (
          <div key={p.key} className="row">
            <span className="row-main">
              {p.label}
              {p.auto && <span className="row-sub" style={{ display: 'inline', marginLeft: 6 }}>auto</span>}
              {p.key === 'accommodation' && kpi?.accommodationPct == null && data.auditPct !== null && (
                <span className="row-sub" style={{ display: 'inline', marginLeft: 6 }}>from audit</span>
              )}
              {p.key === 'quarterly' && <span className="row-sub" style={{ display: 'inline', marginLeft: 6 }}>not averaged</span>}
            </span>
            <span className="row-trail">{pct(result[p.key])}</span>
          </div>
        ))}
      </div>
      <div className="list">
        <button className="row tint" onClick={() => setSheet('kpi')}>
          Score {monthLabel(month)}
        </button>
        <button className="row tint" onClick={() => setSheet('manpower')}>
          Manpower {monthLabel(month)}
        </button>
      </div>

      {manpower && (
        <>
          <div className="section-label">Manpower · {monthLabel(month)}</div>
          <div className="list">
            {[
              ['Total workers', manpower.totalWorkers],
              ['Illegal / freelance', manpower.illegalOrFreelance],
              ['Visas expiring ≤30 days', manpower.visaExpiring30d],
              ['Paid recruitment fees', manpower.paidRecruitmentFees],
            ].map(([l, v]) => (
              <div key={l} className="row">
                <span className="row-main">{l}</span>
                <span className="row-trail">{Number(v).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Open tickets · {open.length}</div>
      {open.length ? (
        <div className="list">
          {open.map((t) => (
            <TicketRow key={t.uuid} t={t} name={t.issue || 'Ticket'} />
          ))}
        </div>
      ) : (
        <div className="list-foot">None.</div>
      )}

      {data.lastAudit && (
        <>
          <div className="section-label">Last audit</div>
          <div className="list">
            <button className="row" onClick={() => navigate(`/inspection/${data.lastAudit!.id}`)}>
              <span className="row-main">
                <div className="row-title">{data.lastAudit.info.facilityLocation || 'Audit'}</div>
                <div className="row-sub">{shortDate(data.lastAudit.info.reviewDate)}</div>
              </span>
              <span className="row-chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
          </div>
        </>
      )}

      {c.aliases.length > 0 && <div className="list-foot">Also known as: {c.aliases.join(' · ')}</div>}
      <History uuid={c.uuid} contractors={d.byUuid} />

      {sheet === 'edit' && <ContractorSheet contractor={c} onClose={() => setSheet(null)} />}
      {sheet === 'kpi' && (
        <KpiSheet contractor={c} kpi={kpi ?? emptyKpi(c.uuid, month)} auditPct={data.auditPct} onClose={() => setSheet(null)} />
      )}
      {sheet === 'manpower' && (
        <ManpowerSheet contractor={c} record={manpower ?? emptyManpower(c.uuid, month)} onClose={() => setSheet(null)} />
      )}
    </Page>
  )
}
