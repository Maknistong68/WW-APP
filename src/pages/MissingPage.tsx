import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Cover from '../components/Cover'
import { showActions } from '../components/ActionSheet'
import Page from '../components/Page'
import { MonthStepper, SubjectEditor, SubjectList } from '../components/SubjectPicker'
import { useAuthInfo } from '../lib/auth'
import { monthLabel, monthOf } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { SUBJECT_ITEMS, isSubjectItem, subjectRows } from '../lib/todo'
import type { KpiSubject } from '../lib/subjects'

/** A Home tile opened: which work orders still miss this item this month. */
export default function MissingPage() {
  const { item = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const month = params.get('m') || monthOf()
  const { canEdit } = useAuthInfo()
  const navigate = useNavigate()
  const d = useAllData()
  const [editing, setEditing] = useState<KpiSubject | null>(null)
  const key = isSubjectItem(item) ? item : null
  const rows = useMemo(() => (key && d.loaded ? subjectRows(d, key, month) : []), [d, key, month])

  if (!key) return <Navigate to="/" replace />
  const def = SUBJECT_ITEMS[key]
  const left = rows.filter((r) => !r.done).length

  return (
    <Page title={def.title} back="/" backLabel="Home">
      <MonthStepper month={month} onChange={(m) => setParams({ m }, { replace: true })} />
      <div className="chart-sub" style={{ margin: '4px 4px 10px', fontSize: 15 }}>
        {!d.loaded
          ? ''
          : left
            ? `${left} of ${rows.length} still missing for ${monthLabel(month)}`
            : `All ${rows.length} entered for ${monthLabel(month)}`}
        {key === 'quarterly' ? ' · any month of the quarter counts' : ''}
      </div>
      <SubjectList
        rows={rows}
        onPick={canEdit ? setEditing : (s) => navigate(`/contractors/${s.contractor.uuid}`)}
        onMore={(s) =>
          showActions({
            title: s.label,
            sub: `${def.title} · ${monthLabel(month)}`,
            cover: <Cover section="contractors" seed={s.contractor.name} text={s.contractor.name} size={56} />,
            actions: [
              { label: 'Fill in', icon: 'pencil', onSelect: () => setEditing(s), edit: true },
              { label: 'Open contractor', icon: 'arrow-right', onSelect: () => navigate(`/contractors/${s.contractor.uuid}`) },
            ],
          })
        }
      />
      {canEdit && <div className="list-foot">Tap a work order to fill it in · hold for more.</div>}
      {editing && <SubjectEditor d={d} subject={editing} month={month} sheet={def.sheet} onClose={() => setEditing(null)} />}
    </Page>
  )
}
