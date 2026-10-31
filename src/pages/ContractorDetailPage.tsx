import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import History from '../components/History'
import ContractorSheet, { WorkOrderSheet } from '../components/ContractorSheet'
import KpiSheet, { ManpowerSheet, emptyKpi, emptyManpower } from '../components/KpiSheet'
import { showToast } from '../components/Toast'
import { TicketRow } from './TicketsPage'
import { isOpen } from '../lib/aging'
import { addMonths, monthLabel, monthOf, shortDate } from '../lib/dates'
import { KPI_PARTS, STATUS_LABEL, pct, type KpiResult } from '../lib/kpi'
import { auditPctFor, kpiForSubject, rollup, useAllData } from '../lib/kpiData'
import { mentions } from '../lib/names'
import { saveRecord } from '../lib/records'
import { subjectKpi, subjectManpower, type KpiSubject } from '../lib/subjects'
import { newWorkOrder } from '../lib/useData'
import type { WorkOrder } from '../types'

function Ring({ value, status }: { value: number | null; status: string }) {
  const r = 30
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value ?? 0))
  const color =
    status === 'good' ? 'var(--green)' : status === 'warn' ? 'var(--amber-border)' : status === 'bad' ? 'var(--red)' : 'var(--separator)'
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

const ALL = '__all'

export default function ContractorDetailPage() {
  const { uuid = '' } = useParams()
  const navigate = useNavigate()
  const d = useAllData()
  const [month, setMonth] = useState(monthOf())
  const [pick, setPick] = useState<string>(ALL)
  const [sheet, setSheet] = useState<'edit' | 'kpi' | 'manpower' | null>(null)
  const [woSheet, setWoSheet] = useState<WorkOrder | null>(null)
  const c = d.byUuid.get(uuid)

  const data = useMemo(() => {
    if (!c) return null
    const wos = d.workOrders.filter((w) => w.contractorUuid === c.uuid)
    // Scored subjects: active work orders, or the contractor itself without any.
    const subjects: KpiSubject[] =
      wos.length === 0
        ? [{ key: c.uuid, contractor: c, label: c.name }]
        : wos.filter((w) => w.active).map((w) => ({ key: w.uuid, contractor: c, workOrder: w, label: `${c.name} · WO ${w.number}` }))
    const results = new Map<string, KpiResult>(subjects.map((s) => [s.key, kpiForSubject(d, s, month)]))
    const tickets = d.tickets.filter((t) => t.contractorUuid === c.uuid)
    const audits = d.inspections
      .filter((i) => mentions(i.info?.contractorNames ?? '', [c.name, ...c.aliases]))
      .sort((a, b) => (a.info.reviewDate < b.info.reviewDate ? 1 : -1))
    return { wos, subjects, results, tickets, auditPct: auditPctFor(c, d.inspections, month), lastAudit: audits[0] }
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

  const single = data.subjects.length === 1 ? data.subjects[0] : undefined
  const chosen = pick === ALL ? single : data.subjects.find((s) => s.key === pick)
  const result: KpiResult = chosen
    ? data.results.get(chosen.key)!
    : rollup(data.subjects.map((s) => data.results.get(s.key)!))
  const kpi = chosen ? subjectKpi(chosen, d.kpis, month) : undefined
  const manpower = chosen ? subjectManpower(chosen, d.manpower, month) : undefined
  const open = data.tickets.filter(isOpen).sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  const mark = (v: boolean | undefined, label: string) => (
    <span className={v ? 'yes' : 'no'}>
      <Icon name={v ? 'check' : 'x'} size={16} strokeWidth={2.6} /> {label}
    </span>
  )
  const toggleWo = (w: WorkOrder) =>
    void saveRecord('workOrders', { ...w, active: !w.active }, `${c.name} · WO ${w.number}`).then(() =>
      showToast({ text: `WO ${w.number} ${w.active ? 'deactivated' : 'activated'}` }),
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
      {!c.active && (
        <div className="list-foot" style={{ marginTop: -4 }}>
          Inactive — not scored and not in missing documents. Edit to activate.
        </div>
      )}

      <div className="section-label">Work orders · {data.wos.length}</div>
      <div className="list">
        {data.wos.map((w) => {
          const r = data.results.get(w.uuid)
          return (
            <div key={w.uuid} className="row">
              <button
                className="row-main"
                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }}
                onClick={() => setWoSheet(w)}
              >
                <div className="row-title">
                  WO {w.number}
                  {w.label ? ` · ${w.label}` : ''}
                </div>
                <div className="row-sub">{w.active && c.active ? `KPI ${pct(r?.overall)} · ${STATUS_LABEL[r?.status ?? 'none']}` : 'Inactive'}</div>
              </button>
              <input
                type="checkbox"
                role="switch"
                aria-label={`WO ${w.number} active`}
                checked={w.active}
                style={{ flex: 'none', width: 22, height: 22 }}
                onChange={() => toggleWo(w)}
              />
            </div>
          )
        })}
        <button className="row tint" onClick={() => setWoSheet(newWorkOrder(c.uuid))}>
          <Icon name="plus" size={18} /> Add work order
        </button>
      </div>

      <div className="segmented" style={{ gridTemplateColumns: '44px 1fr 44px', display: 'grid', gridAutoFlow: 'unset', marginTop: 14 }}>
        <button aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <button className="on">{monthLabel(month)}</button>
        <button aria-label="Next month" disabled={month >= monthOf()} onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>

      {data.subjects.length > 1 && (
        <div className="pill-row" style={{ borderRadius: 12, marginBottom: 8 }}>
          <button className={`pill${pick === ALL ? ' on' : ''}`} onClick={() => setPick(ALL)}>
            All WOs
          </button>
          {data.subjects.map((s) => (
            <button key={s.key} className={`pill${pick === s.key ? ' on' : ''}`} onClick={() => setPick(s.key)}>
              WO {s.workOrder?.number}
            </button>
          ))}
        </div>
      )}

      {data.subjects.length === 0 ? (
        <div className="list-foot">No active work order — nothing to score.</div>
      ) : (
        <>
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
              {chosen ? (
                <div className="checks" style={{ marginTop: 6 }}>
                  {mark(kpi?.wps, 'WPS')}
                  {mark(kpi?.manpowerDecl, 'Manpower')}
                  {mark(kpi?.salaryDecl, 'Salary')}
                </div>
              ) : (
                <div className="row-sub">Average of {data.subjects.length} work orders</div>
              )}
            </div>
          </div>

          <div className="list">
            {KPI_PARTS.map((p) => (
              <button key={p.key} className="row" onClick={() => navigate(`/kpis/${p.key}`)}>
                <span className="row-main">
                  {p.label}
                  {p.auto && <span className="row-sub" style={{ display: 'inline', marginLeft: 6 }}>auto</span>}
                  {p.key === 'accommodation' && kpi?.accommodationPct == null && data.auditPct !== null && (
                    <span className="row-sub" style={{ display: 'inline', marginLeft: 6 }}>from audit</span>
                  )}
                  {p.key === 'quarterly' && <span className="row-sub" style={{ display: 'inline', marginLeft: 6 }}>not averaged</span>}
                </span>
                <span className="row-trail">{pct(result[p.key])}</span>
              </button>
            ))}
          </div>
          {chosen ? (
            <div className="list">
              <button className="row tint" onClick={() => setSheet('kpi')}>
                Score {monthLabel(month)}
                {chosen.workOrder ? ` · WO ${chosen.workOrder.number}` : ''}
              </button>
              <button className="row tint" onClick={() => setSheet('manpower')}>
                Manpower {monthLabel(month)}
                {chosen.workOrder ? ` · WO ${chosen.workOrder.number}` : ''}
              </button>
            </div>
          ) : (
            <div className="list-foot">Pick a work order above to score it or enter manpower.</div>
          )}
        </>
      )}

      {manpower && chosen && (
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
            <TicketRow key={t.uuid} t={t} />
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
      {sheet === 'kpi' && chosen && (
        <KpiSheet
          contractor={c}
          subjectLabel={chosen.label}
          kpi={kpi ?? emptyKpi(c.uuid, chosen.workOrder?.uuid ?? '', month)}
          auditPct={data.auditPct}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'manpower' && chosen && (
        <ManpowerSheet
          subjectLabel={chosen.label}
          record={manpower ?? emptyManpower(c.uuid, chosen.workOrder?.uuid ?? '', month)}
          onClose={() => setSheet(null)}
        />
      )}
      {woSheet && <WorkOrderSheet contractor={c} workOrder={woSheet} onClose={() => setWoSheet(null)} />}
    </Page>
  )
}
