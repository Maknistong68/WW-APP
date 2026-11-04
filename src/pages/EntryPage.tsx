import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import Page from '../components/Page'
import Icon from '../components/Icon'
import IconTile from '../components/IconTile'
import CardList from '../components/CardList'
import StatusChip from '../components/StatusChip'
import ActionBar from '../components/ActionBar'
import Chips from '../components/dash/Chips'
import { ConfirmSheet } from '../components/Modal'
import { showActions, type SheetAction } from '../components/ActionSheet'
import { openSheet } from '../components/SheetHost'
import { showToast } from '../components/Toast'
import { MonthStepper, SubjectList } from '../components/SubjectPicker'
import SubconCheck from '../components/SubconCheck'
import { YesNo, count, pctOf, str } from '../components/Inputs'
import { useAuthInfo } from '../lib/auth'
import { copyText } from '../lib/clipboard'
import { setAuditDate } from '../lib/closeout'
import { addMonths, localDate, monthLabel, shortDate } from '../lib/dates'
import { declarationsDue } from '../lib/due'
import { entryDone, entryItem, entryItemsFor, entryProblem, entryValue, itemLeft, mergeRow, otherQuarterAudit, parseEntry, rowChanged, woProgress, type EntryBy, type EntryItem } from '../lib/entryItems'
import { editKey, readDraft, writeDraft, type EntryEdit } from '../lib/entryDraft'
import { beginEdit } from '../lib/editing'
import { haptic } from '../lib/haptics'
import { attendedPct, kpiStatus, meetingAttended, offboardingScore, setOffboarding } from '../lib/kpi'
import { kpiTone } from '../lib/tone'
import { itemHistory, woHistory, woScore } from '../lib/woScore'
import MonthMarks from '../components/charts/MonthMarks'
import TrendLine from '../components/charts/TrendLine'
import { useAllData, type AllData } from '../lib/kpiData'
import { markSeen } from '../lib/onboarding'
import { saveRecord } from '../lib/records'
import { emptyKpi, emptyManpower, kpiSubjects, subjectKpi, subjectManpower, subjectPrior, woOf, type KpiSubject } from '../lib/subjects'
import { SUBCON_DOCS, awaitedItems, chaseText, docState, editDoc, type DocState } from '../lib/submissions'
import { useBackClose } from '../lib/useBackClose'
import { useLongPress } from '../lib/useLongPress'
import { useGoBack } from '../lib/nav'
import { useSave } from '../lib/useSave'
import type { KpiMonth, Manpower, SubmissionKey } from '../types'

// Monthly entry: the month's documents and KPIs, two ways in.
// By work order: each work order with "Docs 4/11 · KPIs 3/5"; tap opens its panels.
// By item: pick one item and type it for every work order in place; one Save.

const STATES: { key: DocState; label: string }[] = [
  { key: 'in', label: 'In' },
  { key: 'awaited', label: 'Waiting' },
  { key: 'notProvided', label: 'Not provided' },
  { key: 'na', label: 'N/A' },
]

const byLabel = (a: KpiSubject, b: KpiSubject) => a.label.localeCompare(b.label, undefined, { numeric: true })

/** The row's record as stored (or a blank one): what editing starts from. */
function storedOf(d: AllData, s: KpiSubject, month: string, item: EntryItem): KpiMonth | Manpower | undefined {
  return item.table === 'manpower' ? subjectManpower(s, d.manpower, month) : subjectKpi(s, d.kpis, month)
}
const blankOf = (s: KpiSubject, month: string, item: EntryItem): KpiMonth | Manpower =>
  item.table === 'manpower' ? emptyManpower(s.contractor.uuid, woOf(s), month) : emptyKpi(s.contractor.uuid, woOf(s), month)

export default function EntryPage() {
  const [params, setParams] = useSearchParams()
  const today = localDate()
  const { by, item: itemKey, month } = parseEntry(params, today)
  const d = useAllData()
  // a document switched off for this month is not offered (Settings › Monthly documents)
  const items = useMemo(() => entryItemsFor(month), [month, d.docRules])
  const item = items.find((i) => i.key === itemKey) ?? items[0]
  const { canEdit } = useAuthInfo()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const subjects = useMemo(() => kpiSubjects(d.contractors, d.workOrders).sort(byLabel), [d.contractors, d.workOrders])

  // Unsaved rows (kept for this browser tab, so leaving and coming back keeps them).
  const [edits, setEdits] = useState<Map<string, EntryEdit>>(() => (canEdit ? readDraft() : new Map()))
  useEffect(() => writeDraft(edits), [edits])
  const dirty = edits.size > 0
  const [open, setOpen] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<null | (() => void)>(null)

  // While something is unsaved: app updates wait, closing the tab asks, the phone's Back asks.
  useEffect(() => (dirty ? beginEdit() : undefined), [dirty])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const askLeave = (then: () => void) => (dirty ? setLeaving(() => then) : then())
  useBackClose(dirty, () => {
    askLeave(() => goBack('/'))
    return true
  })

  const setLink = (next: { by?: EntryBy; item?: string; m?: string }) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue
      if (k === 'by' && v === 'wo') p.delete('by')
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  const keyOf = (s: KpiSubject, it = item) => editKey(month, it.key, s.contractor.uuid, woOf(s))
  /** The row as shown: the unsaved edit, else what is stored. */
  const recOf = (s: KpiSubject, it = item) => edits.get(keyOf(s, it))?.edited ?? storedOf(d, s, month, it)
  const change = (s: KpiSubject, fn: (rec: KpiMonth & Manpower) => KpiMonth | Manpower) =>
    setEdits((prev) => {
      const k = keyOf(s)
      const cur = prev.get(k)
      const opened = cur?.opened ?? storedOf(d, s, month, item) ?? blankOf(s, month, item)
      const edited = fn((cur?.edited ?? opened) as KpiMonth & Manpower)
      const next = new Map(prev)
      if (rowChanged(item, opened, edited)) next.set(k, { key: k, month, item: item.key, contractorUuid: s.contractor.uuid, workOrderUuid: woOf(s), label: s.label, opened, edited })
      else next.delete(k)
      return next
    })

  const { saving, alert, run } = useSave('Monthly entry')
  const save = () =>
    run(async () => {
      const list = [...edits.values()]
      for (const e of list) {
        const problem = entryProblem(entryItem(e.item)!, e.edited)
        if (problem) return `${e.label}: ${problem}`
      }
      let saved = 0
      for (const e of list) {
        const it = entryItem(e.item)!
        const table = it.table === 'manpower' ? db.manpower : db.kpiMonths
        const fresh = await (table as typeof db.kpiMonths).where('[contractorUuid+workOrderUuid+month]').equals([e.contractorUuid, e.workOrderUuid, e.month]).first()
        await saveRecord(it.table, mergeRow(it, fresh ?? e.opened, e.opened, e.edited) as KpiMonth, `${e.label} · ${monthLabel(e.month)} ${it.label}`)
        // saved rows leave the list, so a retry only saves the rest
        setEdits((prev) => {
          const next = new Map(prev)
          next.delete(e.key)
          return next
        })
        saved++
      }
      haptic('success')
      markSeen('kpi')
      showToast({ text: `${saved} saved` })
    })
  const discard = () => {
    setEdits(new Map())
    setOpen(null)
  }

  // ---- By work order ----
  const woRows = useMemo(
    () =>
      d.loaded
        ? subjects
            .map((s) => {
              const p = woProgress(d, s, month)
              return { s, done: p.done, value: p.text, pct: p.pct, score: woScore(d, s, month) }
            })
            .sort((a, b) => Number(a.done) - Number(b.done))
        : [],
    [d, subjects, month],
  )
  const due = declarationsDue(month)
  const reminderOf = (s: KpiSubject, only?: EntryItem) => {
    const k = subjectKpi(s, d.kpis, month)
    const missing = awaitedItems(k, subjectPrior(s, d.kpis, month), month)
    return chaseText(s.label, month, only ? missing.filter((m) => m.key === only.key) : missing, due, k)
  }
  const copy = (text: string, many: boolean) =>
    void copyText(text).then((ok) => showToast({ text: ok ? `${many ? 'Reminders' : 'Reminder'} copied. Paste in WhatsApp or email.` : 'Could not copy.' }))
  const subjectArgs = (s: KpiSubject) => ({ contractorUuid: s.contractor.uuid, workOrderUuid: woOf(s), month })
  // the same actions wherever a work order is held; `only`: the reminder names just this item
  const woActions = (s: KpiSubject, only?: EntryItem): SheetAction[] => [
    { label: 'Documents', icon: 'file-text', edit: true, onSelect: () => openSheet({ kind: 'submission', ...subjectArgs(s) }) },
    { label: 'KPIs', icon: 'gauge', edit: true, onSelect: () => openSheet({ kind: 'kpi', ...subjectArgs(s) }) },
    { label: 'Workers', icon: 'users', edit: true, onSelect: () => openSheet({ kind: 'manpower', ...subjectArgs(s) }) },
    { label: 'Copy reminder', icon: 'copy', onSelect: () => copy(reminderOf(s, only), false) },
    { label: 'Open contractor', icon: 'buildings', onSelect: () => navigate(`/contractors/${s.contractor.uuid}?m=${month}`) },
  ]
  const pctFact = (label: string, v: number | null) => ({ label, value: v === null ? '—' : `${v}%`, tone: v === null ? undefined : kpiTone(kpiStatus(v)) })
  const short = (m: string) => monthLabel(m).slice(0, 3)
  const woMenu = (s: KpiSubject) => {
    // held: the work order's KPI score over the last 12 months
    const h = woHistory(d, s, month)
    const now = h.values[h.values.length - 1]
    const last = h.values[h.values.length - 2]
    const fact = pctFact
    showActions({
      title: s.label,
      sub: `${monthLabel(month)} · ${woProgress(d, s, month).text}`,
      cover: <IconTile text={s.contractor.name} tone="info" size={52} />,
      facts: [fact(monthLabel(month).slice(0, 3), now), fact(monthLabel(addMonths(month, -1)).slice(0, 3), last), fact('12-month avg', h.avg)],
      figure:
        h.avg === null ? undefined : (
          <div className="wo-history">
            <div className="chart-sub">KPI score, last 12 months</div>
            <TrendLine
              data={h.months.map((m, i) => ({ date: `${m}-01`, value: h.values[i] }))}
              unit="%"
              mode="month"
              max={100}
              guides={[
                { value: 90, tone: 'good' },
                { value: 70, tone: 'bad' },
              ]}
              toneOf={(v) => kpiTone(kpiStatus(v))}
            />
          </div>
        ),
      note: h.avg === null ? 'No KPI scores yet for this work order.' : undefined,
      actions: woActions(s),
    })
  }
  // By item, held: this item's last 12 months for the work order, its overall score in the header
  const itemMenu = (s: KpiSubject) => {
    const h = itemHistory(d, s, month, item)
    const sc = woScore(d, s, month)
    const overall =
      sc.pct === null ? '' : ` · KPI ${sc.pct}%${sc.change === null ? '' : ` ${sc.change > 0 ? '▲' : sc.change < 0 ? '▼' : '='} ${Math.abs(sc.change)}`}`
    const now = h.values[h.values.length - 1] ?? null
    const last = h.values[h.values.length - 2] ?? null
    const countFact = (label: string, v: number | null) => ({ label, value: v === null ? '—' : v })
    const empty = h.kind === 'doc' ? !h.states?.some((st) => st !== 'none' && st !== 'off') : h.avg === null
    const facts =
      h.kind === 'doc'
        ? [
            { label: `in of ${h.months.length} months`, value: h.counts!.in, tone: 'good' as const },
            { label: 'not provided', value: h.counts!.notProvided },
            { label: 'missing', value: h.counts!.awaited, tone: h.counts!.awaited ? ('bad' as const) : undefined },
          ]
        : h.kind === 'count'
          ? [countFact(short(month), now), countFact(short(addMonths(month, -1)), last), countFact('12-month avg', h.avg)]
          : [pctFact(short(month), now), pctFact(short(addMonths(month, -1)), last), pctFact('12-month avg', h.avg)]
    showActions({
      title: s.label,
      // the item is named in the chart title; the header keeps the work order's overall score
      sub: `${monthLabel(month)}${overall}`,
      cover: <IconTile text={s.contractor.name} tone="info" size={52} />,
      facts: empty ? undefined : facts,
      figure: empty ? undefined : (
        <div className="wo-history">
          <div className="chart-sub">{item.label}, last 12 months</div>
          {h.kind === 'doc' ? (
            <MonthMarks months={h.months} states={h.states!} />
          ) : h.kind === 'count' ? (
            <TrendLine data={h.months.map((m, i) => ({ date: `${m}-01`, value: h.values[i] }))} unit="workers" mode="month" />
          ) : (
            <TrendLine
              data={h.months.map((m, i) => ({ date: `${m}-01`, value: h.values[i] }))}
              unit="%"
              mode="month"
              max={100}
              guides={[
                { value: 90, tone: 'good' },
                { value: 70, tone: 'bad' },
              ]}
              toneOf={(v) => kpiTone(kpiStatus(v))}
            />
          )}
        </div>
      ),
      note: empty ? `No ${item.short.toLowerCase()} history yet for this work order.` : undefined,
      actions: woActions(s, item),
    })
  }

  // ---- By item ----
  const chips = useMemo(
    () =>
      items.map((i, n) => {
        const left = d.loaded ? itemLeft(d, month, i) : 0
        return { key: i.key, label: left ? `${i.short} · ${left}` : i.short, sep: n > 0 && i.group !== items[n - 1].group }
      }),
    [d, month, items],
  )
  const itemRows = useMemo(
    () => (d.loaded ? subjects.map((s) => ({ s, done: entryDone(d, s, month, item), value: entryValue(d, s, month, item) })).sort((a, b) => Number(a.done) - Number(b.done)) : []),
    [d, subjects, month, item],
  )
  const left = (by === 'wo' ? woRows : itemRows).filter((r) => !r.done).length
  const total = subjects.length
  const remindAll = () => {
    const rows = by === 'wo' ? woRows : itemRows
    const text = rows
      .filter((r) => !r.done)
      .map((r) => reminderOf(r.s, by === 'item' ? item : undefined))
      .join('\n\n')
    copy(text, true)
  }
  const docItem = item.kind === 'doc'

  return (
    <Page title="Monthly entry" back="/" backLabel="Home" onBack={() => askLeave(() => goBack('/'))}>
      <div className="segmented fit" role="tablist" aria-label="Enter">
        {(['wo', 'item'] as const).map((b) => (
          <button key={b} role="tab" aria-selected={by === b} className={by === b ? 'on' : ''} onClick={() => setLink({ by: b })}>
            {b === 'wo' ? 'By work order' : 'By item'}
          </button>
        ))}
      </div>
      <MonthStepper month={month} onChange={(m) => setLink({ m })} />
      {by === 'item' && <Chips chips={chips} value={item.key} onChange={(k) => setLink({ item: k })} label="Item" className="page-chips" />}
      {alert && (
        <div className="sheet-alert" role="alert">
          <Icon name="alert" size={18} />
          <span>{alert}</span>
        </div>
      )}
      <div className="chart-sub" style={{ margin: '4px 4px 10px', fontSize: 15 }}>
        {!d.loaded
          ? ''
          : by === 'item'
            ? left
              ? `${item.label}: ${left} of ${total} still missing for ${monthLabel(month)}`
              : `${item.label}: all ${total} in for ${monthLabel(month)}`
            : left
              ? `${left} of ${total} work orders not complete for ${monthLabel(month)}`
              : `All ${total} work orders complete for ${monthLabel(month)}`}
      </div>

      {by === 'wo' ? (
        <SubjectList
          rows={woRows}
          chip={false}
          onPick={canEdit ? (s) => openSheet({ kind: 'kpi', ...subjectArgs(s) }) : (s) => navigate(`/contractors/${s.contractor.uuid}?m=${month}`)}
          onMore={woMenu}
        />
      ) : (
        <CardList>
          {itemRows.map(({ s, done, value }) => (
            <EntryRow
              key={s.key}
              s={s}
              item={item}
              month={month}
              d={d}
              rec={recOf(s)}
              done={done}
              value={value}
              edited={edits.has(keyOf(s))}
              canEdit={canEdit}
              open={open === s.key}
              onToggle={() => setOpen(open === s.key ? null : s.key)}
              onChange={(fn) => change(s, fn)}
              onMonth={(m) => setLink({ m })}
              onMore={() => openSheet({ kind: 'submission', ...subjectArgs(s) })}
              onHold={() => itemMenu(s)}
            />
          ))}
        </CardList>
      )}

      {d.loaded && left > 0 && (by === 'wo' || docItem) && (
        <button className="btn block" onClick={remindAll}>
          <Icon name="copy" size={20} />
          {left === 1 ? 'Copy reminder' : `Copy all ${left} reminders`}
        </button>
      )}
      <div className="list-foot">
        {by === 'wo'
          ? canEdit
            ? 'Tap a work order to fill it in · hold for past scores, documents, workers and more.'
            : 'Tap a work order to open it.'
          : canEdit
            ? 'Type straight into the list, then Save. Each work order saves only this item · hold a work order for its history.'
            : 'What each work order has entered.'}
      </div>

      {dirty && (
        <ActionBar
          secondary={[{ label: 'Discard changes', icon: 'trash', onClick: () => setLeaving(() => () => undefined) }]}
          primary={{ label: saving ? 'Saving…' : `Save ${edits.size} change${edits.size === 1 ? '' : 's'}`, icon: 'check', onClick: () => void save(), disabled: saving }}
        />
      )}
      {leaving && (
        <ConfirmSheet
          title={`Discard ${edits.size} change${edits.size === 1 ? '' : 's'}?`}
          message="What you typed here and haven’t saved goes."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          destructive
          onCancel={() => setLeaving(null)}
          onConfirm={() => {
            const then = leaving
            setLeaving(null)
            discard()
            then()
          }}
        />
      )}
    </Page>
  )
}

/** One work order's row for the chosen item: what is entered, and (for editors) the item typed in place. */
function EntryRow({
  s,
  item,
  month,
  d,
  rec,
  done,
  value,
  edited,
  canEdit,
  open,
  onToggle,
  onChange,
  onMonth,
  onMore,
  onHold,
}: {
  s: KpiSubject
  item: EntryItem
  month: string
  d: AllData
  rec: KpiMonth | Manpower | undefined
  done: boolean
  value: string
  edited: boolean
  canEdit: boolean
  open: boolean
  onToggle: () => void
  onChange: (fn: (rec: KpiMonth & Manpower) => KpiMonth | Manpower) => void
  onMonth: (m: string) => void
  onMore: () => void
  /** Held (on the name, not the input): this item's history for the work order. */
  onHold: () => void
}) {
  const press = useLongPress(onHold)
  const k = rec as (KpiMonth & Manpower) | undefined
  const today = localDate()
  const prior = item.kind === 'doc' ? subjectPrior(s, d.kpis, month) : undefined
  const other = item.kind === 'quarterly' ? otherQuarterAudit(d, s, month) : null
  const tone = edited ? 'info' : done ? 'good' : 'bad'
  const extra = item.kind === 'workers' || (item.kind === 'quarterly' && !other)

  // the main control, at the end of the row
  let control: ReactNode = null
  if (canEdit && item.kind === 'pct') {
    const field = item.key === 'accommodation' ? 'accommodationPct' : item.key === 'onboarding' ? 'onboardingPct' : 'offboardingPct'
    const off = item.key === 'offboarding' && k ? (k.offboardingPct ?? (offboardingScore(k) === null ? null : Math.round(offboardingScore(k)!))) : null
    const shown = item.key === 'offboarding' ? off : ((k?.[field as 'accommodationPct'] as number | null | undefined) ?? null)
    control = (
      <label className="entry-input">
        <input
          inputMode="decimal"
          placeholder="—"
          aria-label={`${s.label} ${item.label}`}
          value={str(shown)}
          onChange={(e) => {
            const v = pctOf(e.target.value)
            onChange((r) => (item.key === 'offboarding' ? setOffboarding(r, v) : { ...r, [field]: v }))
          }}
        />
        <span>%</span>
      </label>
    )
  } else if (canEdit && item.kind === 'yesno') {
    control = <YesNo label={`${s.label} meeting attended`} value={meetingAttended(k?.meetingPct)} onChange={(v) => onChange((r) => ({ ...r, meetingPct: attendedPct(v) }))} />
  } else if (canEdit && item.kind === 'workers') {
    control = (
      <label className="entry-input">
        <input
          inputMode="numeric"
          placeholder="—"
          aria-label={`${s.label} total workers`}
          value={k && k.totalWorkers ? String(k.totalWorkers) : ''}
          onChange={(e) => onChange((r) => ({ ...r, totalWorkers: count(e.target.value) ?? 0 }))}
        />
      </label>
    )
  } else if (canEdit && item.kind === 'quarterly' && !other) {
    control = (
      <label className="entry-input">
        <input
          inputMode="decimal"
          placeholder="—"
          aria-label={`${s.label} audit score`}
          value={str(k?.quarterlyAuditPct)}
          onChange={(e) => onChange((r) => ({ ...r, quarterlyAuditPct: pctOf(e.target.value) }))}
        />
        <span>%</span>
      </label>
    )
  }

  const state = item.kind === 'doc' ? docState(k as KpiMonth | undefined, item.key as SubmissionKey, prior) : null
  const docOn = item.kind === 'doc' ? (k as KpiMonth | undefined)?.docs?.[item.key as SubmissionKey]?.on : undefined

  return (
    <div className={`entry-row${edited ? ' edited' : ''}`}>
      <div className="entry-top">
        <div className="entry-head" {...press}>
          <IconTile text={s.contractor.name} tone={tone} size={44} />
          <div className="entry-main">
            <div className="entry-title">{s.label}</div>
            <div className="entry-sub">
              {edited && <span className="entry-dot" aria-label="Not saved" />}
              {other ? `${other.pct}% in ${monthLabel(other.month).slice(0, 3)} (this quarter)` : value || (canEdit ? 'Not entered' : '—')}
            </div>
          </div>
        </div>
        {control}
        {!canEdit && <StatusChip tone={done ? 'good' : 'bad'}>{done ? 'Done' : 'Missing'}</StatusChip>}
        {canEdit && other && (
          <button type="button" className="entry-more" onClick={() => onMonth(other.month)}>
            Open {monthLabel(other.month).slice(0, 3)}
          </button>
        )}
        {canEdit && extra && (
          <button type="button" className="icon-btn entry-caret" aria-expanded={open} aria-label={open ? 'Fewer fields' : 'More fields'} onClick={onToggle}>
            <Icon name="chevron-down" size={20} className={open ? 'open' : ''} />
          </button>
        )}
      </div>

      {canEdit && item.kind === 'doc' && (
        <div className="entry-doc">
          <div className="segmented fit doc-states" role="radiogroup" aria-label={`${s.label}: ${item.label}`}>
            {STATES.map((st) => (
              <button
                key={st.key}
                type="button"
                role="radio"
                aria-checked={state === st.key}
                className={state === st.key ? 'on' : ''}
                onClick={() => {
                  haptic('tick')
                  onChange((r) => editDoc(r, item.key as SubmissionKey, { state: st.key }, prior, today))
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
          <div className="entry-doc-foot">
            {state === 'in' ? (
              <label className="entry-date">
                Came in
                <input type="date" max={today} value={docOn ?? ''} onChange={(e) => onChange((r) => editDoc(r, item.key as SubmissionKey, { on: e.target.value }, prior, today))} />
              </label>
            ) : (
              <span />
            )}
            <button type="button" className="entry-more" aria-label={`${s.label}: note and every document`} onClick={onMore}>
              More ›
            </button>
          </div>
          {SUBCON_DOCS.includes(item.key as SubmissionKey) && state === 'in' && (
            <SubconCheck
              entry={(k as KpiMonth | undefined)?.docs?.[item.key as SubmissionKey]}
              subcons={s.workOrder?.subcons ?? []}
              onEdit={(change) => onChange((r) => editDoc(r, item.key as SubmissionKey, change, prior, today))}
            />
          )}
        </div>
      )}

      {canEdit && open && item.kind === 'workers' && (
        <div className="list entry-extra">
          {(
            [
              ['Illegal / freelance', 'illegalOrFreelance'],
              ['Visas expiring ≤30 days', 'visaExpiring30d'],
              ['Paid recruitment fees', 'paidRecruitmentFees'],
            ] as const
          ).map(([label, f]) => (
            <label key={f} className="row">
              <span className="row-label">{label}</span>
              <input inputMode="numeric" value={String(k?.[f] ?? 0)} onChange={(e) => onChange((r) => ({ ...r, [f]: count(e.target.value) ?? 0 }))} />
            </label>
          ))}
        </div>
      )}
      {canEdit && open && item.kind === 'quarterly' && !other && (
        <div className="list entry-extra">
          <label className="row">
            <span className="row-label">Audit date</span>
            <input type="date" value={k?.auditDate ?? ''} onChange={(e) => onChange((r) => setAuditDate(r, e.target.value))} />
          </label>
          <label className="row">
            <span className="row-label">Findings</span>
            <input inputMode="numeric" placeholder="—" value={str(k?.auditFindings)} onChange={(e) => onChange((r) => ({ ...r, auditFindings: count(e.target.value) }))} />
          </label>
          <label className="row">
            <span className="row-label">Closed out</span>
            <input inputMode="numeric" placeholder="—" value={str(k?.auditClosed)} onChange={(e) => onChange((r) => ({ ...r, auditClosed: count(e.target.value) }))} />
          </label>
          <label className="row">
            <span className="row-label">Due by</span>
            <input type="date" value={k?.auditDueDate ?? ''} onChange={(e) => onChange((r) => ({ ...r, auditDueDate: e.target.value }))} />
          </label>
          {k?.auditDueDate && <div className="list-foot">Close-out due {shortDate(k.auditDueDate)}.</div>}
        </div>
      )}
    </div>
  )
}

