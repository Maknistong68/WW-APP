import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import IconTile from '../components/IconTile'
import { showActions } from '../components/ActionSheet'
import Page from '../components/Page'
import { MonthStepper, SubjectEditor, SubjectList } from '../components/SubjectPicker'
import Chips from '../components/dash/Chips'
import { showToast } from '../components/Toast'
import { useAuthInfo } from '../lib/auth'
import { copyText } from '../lib/clipboard'
import { monthLabel, monthOf } from '../lib/dates'
import { declarationsDue } from '../lib/due'
import { useAllData } from '../lib/kpiData'
import { SUBMISSION_ITEMS, chaseText } from '../lib/submissions'
import { SUBJECT_ITEMS, docMissing, docRows, isSubjectItem, subjectRows } from '../lib/todo'
import type { KpiSubject } from '../lib/subjects'
import type { SubmissionKey } from '../types'

const isDoc = (k: string | null): k is SubmissionKey => !!k && SUBMISSION_ITEMS.some((i) => i.key === k)

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
  // The documents list can show one document: who hasn't sent it.
  const docsList = key === 'submission'
  const doc = docsList && isDoc(params.get('doc')) ? (params.get('doc') as SubmissionKey) : null
  const docs = useMemo(() => (docsList && d.loaded ? docRows(d, month, doc ?? undefined) : null), [d, docsList, month, doc])
  const owed = useMemo(() => (docsList && d.loaded ? docMissing(d, month) : null), [d, docsList, month])
  const rows = useMemo(() => (docs ? docs : key && d.loaded ? subjectRows(d, key, month) : []), [docs, d, key, month])

  if (!key) return <Navigate to="/" replace />
  const def = SUBJECT_ITEMS[key]
  const left = rows.filter((r) => !r.done).length
  const docItem = doc ? SUBMISSION_ITEMS.find((i) => i.key === doc) : undefined
  const due = declarationsDue(month)
  const reminder = (s: KpiSubject) => {
    const waiting = docs?.find((r) => r.s.key === s.key)?.waiting ?? []
    const text = chaseText(s.label, month, waiting, due)
    void copyText(text).then((ok) => showToast({ text: ok ? 'Reminder copied. Paste it in WhatsApp or email.' : text }))
  }
  const allReminders = () => {
    // One document chosen: remind about that one; else each work order's full list.
    const text = (docs ?? [])
      .filter((r) => !r.done)
      .map((r) => chaseText(r.s.label, month, docItem ? [docItem] : r.waiting, due))
      .join('\n\n')
    void copyText(text).then((ok) => showToast({ text: ok ? 'Reminders copied. Paste them in WhatsApp or email.' : 'Could not copy.' }))
  }
  const setDoc = (k: string) => setParams(k === 'all' ? { m: month } : { m: month, doc: k }, { replace: true })

  return (
    <Page title={def.title} back="/" backLabel="Home">
      <MonthStepper month={month} onChange={(m) => setParams(doc ? { m, doc } : { m }, { replace: true })} />
      {docsList && owed && (
        <Chips
          label="Document"
          value={doc ?? 'all'}
          onChange={setDoc}
          chips={[{ key: 'all', label: 'All' }, ...SUBMISSION_ITEMS.map((i) => ({ key: i.key, label: owed[i.key] ? `${i.short} · ${owed[i.key]}` : i.short }))]}
        />
      )}
      <div className="chart-sub" style={{ margin: '4px 4px 10px', fontSize: 15 }}>
        {!d.loaded
          ? ''
          : docItem
            ? left
              ? `${left} of ${rows.length} haven’t sent the ${docItem.label.toLowerCase()} for ${monthLabel(month)}`
              : `Every work order sent the ${docItem.label.toLowerCase()} for ${monthLabel(month)}`
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
            cover: <IconTile text={s.contractor.name} tone="info" size={52} />,
            actions: [
              { label: docsList ? 'Documents' : 'Fill in', icon: docsList ? 'file-text' : 'pencil', onSelect: () => setEditing(s), edit: true },
              ...(docsList ? [{ label: 'Copy reminder', icon: 'copy' as const, onSelect: () => reminder(s) }] : []),
              { label: 'Open contractor', icon: 'arrow-right', onSelect: () => navigate(`/contractors/${s.contractor.uuid}`) },
            ],
          })
        }
      />
      {docsList && left > 0 && (
        <button className="btn block" onClick={allReminders}>
          {left === 1 ? 'Copy reminder' : `Copy all ${left} reminders`}
        </button>
      )}
      {canEdit && <div className="list-foot">Tap a work order to fill it in · hold for more.</div>}
      {editing && <SubjectEditor d={d} subject={editing} month={month} sheet={def.sheet} audit={key === 'quarterly'} onClose={() => setEditing(null)} />}
    </Page>
  )
}
