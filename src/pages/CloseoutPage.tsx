import { useMemo, useState } from 'react'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { SubjectEditor } from '../components/SubjectPicker'
import { useAuthInfo } from '../lib/auth'
import { closeoutText, closeoutTotals, closeouts, type Closeout } from '../lib/closeout'
import { localDate, monthLabel, shortDate } from '../lib/dates'
import { pct } from '../lib/kpi'
import { useAllData } from '../lib/kpiData'
import { kpiSubjects } from '../lib/subjects'

const DOT = { overdue: 'bad', due: 'warn', open: '', closed: 'good' } as const

function Row({ c, onOpen }: { c: Closeout; onOpen?: () => void }) {
  return (
    <button className="row" disabled={!onOpen} onClick={onOpen}>
      <span className={`status-dot ${DOT[c.status]}`} aria-label={c.status} />
      <span className="row-main">
        <div className="row-title">{c.subject.label}</div>
        <div className="row-sub" style={{ whiteSpace: 'normal' }}>
          {closeoutText(c, shortDate)} · audit {c.kpi.auditDate ? shortDate(c.kpi.auditDate) : monthLabel(c.kpi.month)}
          {c.kpi.quarterlyAuditPct != null ? ` · score ${pct(c.kpi.quarterlyAuditPct)}` : ''}
        </div>
      </span>
      <span className="row-trail">{pct(c.pct)}</span>
      {onOpen && (
        <span className="row-chev">
          <Icon name="chevron-right" size={18} />
        </span>
      )}
    </button>
  )
}

/** Quarterly audit findings still to be closed out, overdue first. */
export default function CloseoutPage() {
  const d = useAllData()
  const { canEdit } = useAuthInfo()
  const [editing, setEditing] = useState<Closeout | null>(null)
  const list = useMemo(
    () => closeouts(kpiSubjects(d.contractors, d.workOrders), d.kpis, localDate()),
    [d.contractors, d.workOrders, d.kpis],
  )
  const t = closeoutTotals(list)
  const open = list.filter((c) => c.status !== 'closed')
  const done = list.filter((c) => c.status === 'closed').slice(0, 10)

  return (
    <Page title="Audit close-out" back="/" backLabel="Home">
      <div className="hero-row">
        <div className="hero">
          <div className={`hero-num${t.open ? ' warn' : ''}`}>{t.open}</div>
          <div className="hero-label">Findings open</div>
        </div>
        <div className="hero">
          <div className={`hero-num${t.overdue ? ' bad' : ''}`}>{t.overdue}</div>
          <div className="hero-label">Audits overdue</div>
        </div>
        <div className="hero">
          <div className={`hero-num${t.pct === null ? '' : t.pct >= 90 ? ' good' : t.pct >= 70 ? ' warn' : ' bad'}`}>{pct(t.pct)}</div>
          <div className="hero-label">Closed out</div>
        </div>
      </div>

      {d.loaded && list.length === 0 ? (
        <div className="empty-state">
          <Icon name="clock" size={44} />
          <b>No audit findings yet</b>
          {canEdit ? 'Add them in a work order’s KPIs, under “Quarterly audit close-out”.' : 'Nothing to close out.'}
        </div>
      ) : (
        <>
          <div className="section-label">To close out · {open.length}</div>
          {open.length === 0 ? (
            <div className="list-foot">Every finding is closed out.</div>
          ) : (
            <div className="list">
              {open.map((c) => (
                <Row key={c.kpi.uuid} c={c} onOpen={canEdit ? () => setEditing(c) : undefined} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <>
              <div className="section-label">Closed</div>
              <div className="list">
                {done.map((c) => (
                  <Row key={c.kpi.uuid} c={c} onOpen={canEdit ? () => setEditing(c) : undefined} />
                ))}
              </div>
            </>
          )}
          {canEdit && <div className="list-foot">Tap one to update how many findings are closed.</div>}
        </>
      )}

      {editing && (
        <SubjectEditor d={d} subject={editing.subject} month={editing.kpi.month} sheet="kpi" onClose={() => setEditing(null)} />
      )}
    </Page>
  )
}
