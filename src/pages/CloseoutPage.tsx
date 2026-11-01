import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import { closeoutTone } from '../lib/tone'
import ItemRow from '../components/ItemRow'
import CardList from '../components/CardList'
import { showActions } from '../components/ActionSheet'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { SubjectEditor } from '../components/SubjectPicker'
import { useAuthInfo } from '../lib/auth'
import { closeoutText, closeoutTotals, closeouts, type Closeout } from '../lib/closeout'
import { localDate, monthLabel, shortDate } from '../lib/dates'
import { pct } from '../lib/kpi'
import { useAllData } from '../lib/kpiData'
import { kpiSubjects } from '../lib/subjects'



function Row({ c, onOpen }: { c: Closeout; onOpen?: () => void }) {
  const navigate = useNavigate()
  const sub = `${closeoutText(c, shortDate)} · audit ${c.kpi.auditDate ? shortDate(c.kpi.auditDate) : monthLabel(c.kpi.month)}`
  return (
    <ItemRow
      tile={<IconTile icon="seal" tone={closeoutTone(c.status)} size={52} />}
      title={c.subject.label}
      sub={sub}
      trail={<StatusChip tone={closeoutTone(c.status)}>{pct(c.pct)}</StatusChip>}
      onOpen={onOpen ?? (() => navigate(`/contractors/${c.subject.contractor.uuid}`))}
      onMore={() =>
        showActions({
          title: c.subject.label,
          sub,
          cover: <IconTile icon="seal" tone={closeoutTone(c.status)} size={52} />,
          note: c.kpi.quarterlyAuditPct != null ? `Audit score ${pct(c.kpi.quarterlyAuditPct)}.` : undefined,
          actions: [
            ...(onOpen ? [{ label: 'Update closed findings', icon: 'pencil' as const, onSelect: onOpen, edit: true }] : []),
            { label: 'Open contractor', icon: 'arrow-right', onSelect: () => navigate(`/contractors/${c.subject.contractor.uuid}`) },
          ],
        })
      }
    />
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
    <Page title="Audit close-out" back=".." backLabel="Back">
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
          {open.length === 0 ? (
            <div className="list-foot">Every finding is closed out.</div>
          ) : (
            <CardList title="To close out" count={open.length}>
              {open.map((c) => (
                <Row key={c.kpi.uuid} c={c} onOpen={canEdit ? () => setEditing(c) : undefined} />
              ))}
            </CardList>
          )}
          {done.length > 0 && (
            <>
              <CardList title="Closed" count={done.length}>
                {done.map((c) => (
                  <Row key={c.kpi.uuid} c={c} onOpen={canEdit ? () => setEditing(c) : undefined} />
                ))}
              </CardList>
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
