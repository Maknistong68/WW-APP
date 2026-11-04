import { Fragment, useRef, useState } from 'react'
import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import History from './History'
import Icon from './Icon'
import Modal, { type ModalHandle } from './Modal'
import SaveButton from './SaveButton'
import StatusChip from './StatusChip'
import SubconCheck from './SubconCheck'
import { showToast } from './Toast'
import { useSave } from '../lib/useSave'
import { saveRecord } from '../lib/records'
import { haptic } from '../lib/haptics'
import { copyText } from '../lib/clipboard'
import { dayMonth, daysDiff, localDate, monthLabel } from '../lib/dates'
import { declarationsDue, dueTone } from '../lib/due'
import {
  DOC_GROUPS,
  SUBMISSION_ITEMS,
  applyDocChanges,
  awaitedItems,
  carryBefore,
  changedDocs,
  chaseText,
  docState,
  editDoc,
  itemsFor,
  markAllIn,
  submissionCounts,
  SUBCON_DOCS,
  subconFlag,
  type DocState,
  type SubmissionItem,
} from '../lib/submissions'
import type { Tone } from '../lib/tone'
import type { IconName } from './Icon'
import type { KpiMonth, SubmissionKey } from '../types'

// One work order's monthly documents: what came in (and when), what they can't
// give, what doesn't apply, and what is still waiting. Saves only the documents
// changed here onto a fresh copy of the month, so a KPI panel or a teammate
// saving the same month meanwhile loses nothing.

/** One work order's month and what carries into it ("not applicable" until changed). */
export async function loadDocs(contractorUuid: string, workOrderUuid: string, month: string): Promise<{ kpi?: KpiMonth; prev?: KpiMonth }> {
  const rows = await db.kpiMonths
    .where('[contractorUuid+workOrderUuid+month]')
    .between([contractorUuid, workOrderUuid, Dexie.minKey], [contractorUuid, workOrderUuid, Dexie.maxKey])
    .toArray()
  return { kpi: rows.find((r) => r.month === month), prev: carryBefore(rows, month) }
}

const STATES: { key: DocState; label: string }[] = [
  { key: 'in', label: 'In' },
  { key: 'awaited', label: 'Waiting' },
  { key: 'notProvided', label: 'Not provided' },
  { key: 'na', label: 'N/A' },
]

/** The chip on a document's row: status as icon + word. */
export function docChip(state: DocState, on: string | undefined, due: string, today: string): { tone: Tone; icon: IconName; text: string } {
  if (state === 'in') return { tone: 'good', icon: 'check-circle', text: on ? `In ${dayMonth(on)}` : 'In' }
  if (state === 'notProvided') return { tone: 'none', icon: 'x-circle', text: 'Not provided' }
  if (state === 'na') return { tone: 'none', icon: 'minus-circle', text: 'N/A' }
  const t = dueTone(due, today)
  return { tone: t ?? 'info', icon: t === 'bad' ? 'alert' : 'clock', text: t === 'bad' ? 'Late' : 'Waiting' }
}

export default function SubmissionSheet({
  subjectLabel,
  kpi,
  prev,
  onClose,
}: {
  /** "Al Fahad · WO 882" */
  subjectLabel: string
  /** The month as opened (a blank one when nothing is saved yet). */
  kpi: KpiMonth
  /** What carries in from earlier months (carryBefore). */
  prev?: KpiMonth
  onClose: () => void
}) {
  // The copy as opened: what was changed here is measured against it, even if a sync updates `kpi` meanwhile.
  const [opened] = useState(kpi)
  const [k, setK] = useState(kpi)
  const [open, setOpen] = useState<SubmissionKey | null>(null)
  const today = localDate()
  // the work order's subcontractors, for WPS and Salary's "all included?"
  const wo = useLiveQuery(() => (kpi.workOrderUuid ? db.workOrders.get(kpi.workOrderUuid) : undefined), [kpi.workOrderUuid])
  const due = declarationsDue(k.month)
  const counts = submissionCounts(k, prev)
  const awaited = awaitedItems(k, prev)
  // documents switched off for this month (Settings › Monthly documents) are not shown or counted
  const items = itemsFor(k.month)
  const off = SUBMISSION_ITEMS.filter((i) => !items.includes(i))
  const notNeeded = items.length - counts.required
  const tone = dueTone(due, today)

  const edit = (key: SubmissionKey, change: Parameters<typeof editDoc>[2]) => setK((p) => editDoc(p, key, change, prev, today))

  const sheet = useRef<ModalHandle>(null)
  const { saving, alert, run } = useSave(`${subjectLabel} documents`)
  const close = () => (sheet.current ? sheet.current.close() : onClose())
  const save = () =>
    run(async () => {
      if (!changedDocs(opened, k).length) return close()
      const fresh = await db.kpiMonths.where('[contractorUuid+workOrderUuid+month]').equals([k.contractorUuid, k.workOrderUuid, k.month]).first()
      await saveRecord('kpiMonths', applyDocChanges(fresh ?? opened, opened, k), `${subjectLabel} · ${monthLabel(k.month)} documents`)
      haptic('success')
      showToast({ text: 'Documents saved' })
      close()
    })

  const copyReminder = () => {
    const text = chaseText(subjectLabel, k.month, awaited, due, k)
    void copyText(text).then((ok) => showToast({ text: ok ? 'Reminder copied. Paste it in WhatsApp or email.' : text }))
  }

  const dueLine = !awaited.length
    ? 'Nothing waiting'
    : tone === 'bad'
      ? `Due ${dayMonth(due)} · ${daysDiff(due, today)}d late`
      : `Due ${dayMonth(due)}`

  return (
    <Modal
      ref={sheet}
      title={`${monthLabel(k.month).slice(0, 3)} documents`}
      onClose={onClose}
      alert={alert}
      header={
        <SaveButton saving={saving} onClick={() => void save()}>
          Save
        </SaveButton>
      }
    >
      <div className="sheet-body">
        <div className="docs-head">
          <div className="docs-subject">{subjectLabel}</div>
          <div className="docs-count">
            <b>{counts.in}</b> of {counts.required} in
            {notNeeded > 0 && <span className="docs-skip"> · {notNeeded} not needed</span>}
          </div>
          <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={counts.required} aria-valuenow={counts.in} aria-label="Documents in">
            <div style={{ width: `${counts.required ? (counts.in / counts.required) * 100 : 100}%` }} />
          </div>
          <div className={`docs-due${tone && awaited.length ? ` ${tone}` : ''}`}>{dueLine}</div>
          {(awaited.length > 0 || SUBCON_DOCS.some((key) => !!subconFlag(k.docs?.[key]))) && (
            <div className="btn-row">
              {awaited.length > 0 && (
                <button
                  className="btn primary"
                  onClick={() => {
                    haptic('tick')
                    setK((p) => markAllIn(p, today, prev))
                    setOpen(null)
                  }}
                >
                  <Icon name="check-circle" size={20} />
                  Mark all in
                </button>
              )}
              <button className="btn" onClick={copyReminder}>
                <Icon name="copy" size={20} />
                Reminder
              </button>
            </div>
          )}
        </div>
        {DOC_GROUPS.filter((g) => items.some((i) => i.group === g)).map((g) => (
          <Fragment key={g}>
            <div className="section-label">{g}</div>
            <div className="list">
              {items.filter((i) => i.group === g).map((i) => (
                <DocRow
                  key={i.key}
                  item={i}
                  k={k}
                  prev={prev}
                  due={due}
                  today={today}
                  subcons={wo?.subcons ?? []}
                  open={open === i.key}
                  onToggle={() => setOpen(open === i.key ? null : i.key)}
                  onEdit={(change) => edit(i.key, change)}
                />
              ))}
            </div>
          </Fragment>
        ))}
        <div className="list-foot">
          Not provided = they can’t give it. N/A = it doesn’t apply, and stays so next month until you change it. Neither is chased. The KPI score still
          counts WPS, Manpower register and Salary only.
        </div>
        {off.length > 0 && <div className="list-foot">Switched off for {monthLabel(k.month)} (Settings): {off.map((i) => i.label).join(', ')}.</div>}
        {opened.updatedAt && <History uuid={opened.uuid} />}
      </div>
    </Modal>
  )
}

function DocRow({
  item,
  k,
  prev,
  due,
  today,
  subcons,
  open,
  onToggle,
  onEdit,
}: {
  item: SubmissionItem
  k: KpiMonth
  prev?: KpiMonth
  due: string
  today: string
  subcons: string[]
  open: boolean
  onToggle: () => void
  onEdit: (change: Parameters<typeof editDoc>[2]) => void
}) {
  const state = docState(k, item.key, prev)
  const e = k.docs?.[item.key]
  const chip = docChip(state, e?.on, due, today)
  const carried = state === 'na' && docState(k, item.key) !== 'na'
  const variant = e?.variant === 'iap' ? 'IAP' : e?.variant === 'issueLog' ? 'Issue log' : ''
  const sub = [variant, e?.note ? `“${e.note}”` : '', carried ? 'N/A since last month' : ''].filter(Boolean).join(' · ') || item.detail
  const flag = SUBCON_DOCS.includes(item.key) ? subconFlag(e) : null
  const id = `doc-${item.key}`
  return (
    <div className={`doc${open ? ' open' : ''}`}>
      <button className="row" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="row-main">
          <div className="row-title">{item.label}</div>
          {(sub || flag) && (
            <div className="row-sub">
              {flag && <span className="warn-text">{flag}</span>}
              {flag && sub ? ' · ' : ''}
              {sub}
            </div>
          )}
        </span>
        <StatusChip tone={chip.tone} icon={chip.icon}>
          {chip.text}
        </StatusChip>
      </button>
      {open && (
        <div className="doc-edit" id={id}>
          <div className="segmented fit doc-states" role="radiogroup" aria-label={`${item.label}: status`}>
            {STATES.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={state === s.key}
                className={state === s.key ? 'on' : ''}
                onClick={() => {
                  haptic('tick')
                  onEdit({ state: s.key })
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          {state === 'in' && (
            <label className="row">
              <span className="row-label">Came in</span>
              <input type="date" max={today} value={e?.on ?? ''} onChange={(ev) => onEdit({ on: ev.target.value })} />
            </label>
          )}
          {SUBCON_DOCS.includes(item.key) && state === 'in' && <SubconCheck entry={e} subcons={subcons} onEdit={onEdit} />}
          {item.key === 'issueLog' && state === 'in' && (
            <div className="segmented fit doc-variant" role="radiogroup" aria-label="Which was sent">
              {(['issueLog', 'iap'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={e?.variant === v}
                  className={e?.variant === v ? 'on' : ''}
                  onClick={() => onEdit({ variant: e?.variant === v ? null : v })}
                >
                  {v === 'iap' ? 'IAP' : 'Issue log'}
                </button>
              ))}
            </div>
          )}
          <label className="row">
            <span className="row-label">Note</span>
            <input placeholder="Optional" maxLength={140} value={e?.note ?? ''} onChange={(ev) => onEdit({ note: ev.target.value })} />
          </label>
        </div>
      )}
    </div>
  )
}
