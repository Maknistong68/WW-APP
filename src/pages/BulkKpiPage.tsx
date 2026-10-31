import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { showToast } from '../components/Toast'
import {
  BULK_MODES,
  emptyKpi,
  emptyManpower,
  fillKpiFromPrevious,
  fillManpowerFromPrevious,
  kpiHasData,
  parseCount,
  parsePct,
  type BulkMode,
} from '../lib/bulkKpi'
import { addMonths, monthLabel, monthOf } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { saveRecord } from '../lib/records'
import { kpiSubjects, subjectKpi, subjectManpower, woOf, type KpiSubject } from '../lib/subjects'
import type { KpiMonth, Manpower } from '../types'

const PCT_FIELD: Partial<Record<BulkMode, 'accommodationPct' | 'onboardingPct' | 'meetingPct' | 'quarterlyAuditPct'>> = {
  accommodation: 'accommodationPct',
  onboarding: 'onboardingPct',
  meeting: 'meetingPct',
  quarterly: 'quarterlyAuditPct',
}

const DOCS: { key: 'wps' | 'manpowerDecl' | 'salaryDecl'; label: string }[] = [
  { key: 'wps', label: 'WPS' },
  { key: 'manpowerDecl', label: 'MP' },
  { key: 'salaryDecl', label: 'Salary' },
]

/** One screen to enter a month's KPIs for every active work order, column by column. */
export default function BulkKpiPage() {
  const [params] = useSearchParams()
  const d = useAllData()
  const [month, setMonth] = useState(params.get('m') || monthOf())
  const [mode, setMode] = useState<BulkMode>((params.get('mode') as BulkMode) || 'docs')
  const [kpiEdits, setKpiEdits] = useState<Record<string, KpiMonth>>({})
  const [mpEdits, setMpEdits] = useState<Record<string, Manpower>>({})
  const [saving, setSaving] = useState(false)

  const subjects = useMemo(() => kpiSubjects(d.contractors, d.workOrders), [d.contractors, d.workOrders])
  const changes = Object.keys(kpiEdits).length + Object.keys(mpEdits).length

  const kpiOf = (s: KpiSubject) => kpiEdits[s.key] ?? subjectKpi(s, d.kpis, month) ?? emptyKpi(s.contractor.uuid, woOf(s), month)
  const mpOf = (s: KpiSubject) =>
    mpEdits[s.key] ?? subjectManpower(s, d.manpower, month) ?? emptyManpower(s.contractor.uuid, woOf(s), month)
  const setKpi = (s: KpiSubject, patch: Partial<KpiMonth>) => setKpiEdits((e) => ({ ...e, [s.key]: { ...kpiOf(s), ...patch } }))
  const setMp = (s: KpiSubject, patch: Partial<Manpower>) => setMpEdits((e) => ({ ...e, [s.key]: { ...mpOf(s), ...patch } }))

  const changeMonth = (m: string) => {
    if (changes) return showToast({ text: `Save or discard ${changes} change${changes === 1 ? '' : 's'} first` })
    setMonth(m)
  }

  const copyLastMonth = () => {
    const prev = addMonths(month, -1)
    let n = 0
    if (mode === 'manpower') {
      const next = { ...mpEdits }
      for (const s of subjects) {
        const filled = fillManpowerFromPrevious(mpOf(s), subjectManpower(s, d.manpower, prev))
        if (filled) {
          next[s.key] = filled
          n++
        }
      }
      setMpEdits(next)
    } else {
      const next = { ...kpiEdits }
      for (const s of subjects) {
        const filled = fillKpiFromPrevious(kpiOf(s), subjectKpi(s, d.kpis, prev), mode)
        if (filled) {
          next[s.key] = filled
          n++
        }
      }
      setKpiEdits(next)
    }
    showToast({ text: n ? `Copied ${monthLabel(prev)} into ${n} empty row${n === 1 ? '' : 's'}` : `Nothing to copy from ${monthLabel(prev)}` })
  }

  const setAllDocs = (key: 'wps' | 'manpowerDecl' | 'salaryDecl') => {
    const allOn = subjects.every((s) => kpiOf(s)[key])
    const next = { ...kpiEdits }
    for (const s of subjects) next[s.key] = { ...kpiOf(s), [key]: !allOn }
    setKpiEdits(next)
  }

  const saveAll = async () => {
    setSaving(true)
    let n = 0
    try {
      for (const s of subjects) {
        const k = kpiEdits[s.key]
        if (k && (k.updatedAt || kpiHasData(k))) {
          if (k.offboarded !== null && k.offboardTotal !== null && k.offboarded > k.offboardTotal) {
            showToast({ text: `${s.label}: offboarded is more than the total — fix it and save again` })
            return
          }
          await saveRecord('kpiMonths', k, `${s.label} · ${monthLabel(month)} KPIs`)
          n++
        }
        const m = mpEdits[s.key]
        if (m && (m.updatedAt || m.totalWorkers > 0)) {
          if (m.illegalOrFreelance > m.totalWorkers) {
            showToast({ text: `${s.label}: illegal / freelance is more than total workers` })
            return
          }
          await saveRecord('manpower', m, `${s.label} · ${monthLabel(month)} manpower`)
          n++
        }
      }
      setKpiEdits({})
      setMpEdits({})
      showToast({ text: `Saved ${n} work order${n === 1 ? '' : 's'} for ${monthLabel(month)}` })
    } finally {
      setSaving(false)
    }
  }

  const pctField = PCT_FIELD[mode]

  return (
    <Page title="Enter KPIs" back=".." backLabel="Back">
      <div className="segmented" style={{ gridTemplateColumns: '44px 1fr 44px', display: 'grid', gridAutoFlow: 'unset' }}>
        <button aria-label="Previous month" onClick={() => changeMonth(addMonths(month, -1))}>
          ‹
        </button>
        <button className="on">{monthLabel(month)}</button>
        <button aria-label="Next month" disabled={month >= monthOf()} onClick={() => changeMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>

      <div className="pill-row" style={{ borderRadius: 12, marginBottom: 10 }}>
        {BULK_MODES.map((m) => (
          <button key={m.key} className={`pill${mode === m.key ? ' on' : ''}`} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="bulk-tools">
        <button className="tog" onClick={copyLastMonth}>
          Copy {monthLabel(addMonths(month, -1))}
        </button>
        {mode === 'docs' &&
          DOCS.map((doc) => (
            <button key={doc.key} className="tog" onClick={() => setAllDocs(doc.key)}>
              All {doc.label} ✓
            </button>
          ))}
      </div>

      {mode === 'docs' && (
        <div className="list-foot" style={{ marginTop: -4 }}>
          Tap to tick what was submitted · WPS certificate · MP = manpower declaration · Salary declaration
        </div>
      )}
      {subjects.length === 0 ? (
        <div className="empty-state">
          <Icon name="users" size={44} />
          <b>No active work orders</b>
          Activate contractors / work orders first.
        </div>
      ) : (
        <div className="list">
          {subjects.map((s) => {
            const k = kpiOf(s)
            const m = mpOf(s)
            const changed = !!kpiEdits[s.key] || !!mpEdits[s.key]
            return (
              <div key={s.key} className="row" style={{ gap: 6 }}>
                <span className="row-main">
                  <div className="row-title" style={{ fontSize: 15 }}>
                    {s.contractor.name}
                  </div>
                  <div className="row-sub">
                    {s.workOrder ? `WO ${s.workOrder.number}` : 'No work order'}
                    {changed ? ' · edited' : ''}
                  </div>
                </span>
                {mode === 'docs' &&
                  DOCS.map((doc) => (
                    <button
                      key={doc.key}
                      className={`tog${k[doc.key] ? ' on' : ''}`}
                      aria-pressed={k[doc.key]}
                      onClick={() => setKpi(s, { [doc.key]: !k[doc.key] })}
                    >
                      {doc.label}
                    </button>
                  ))}
                {pctField && (
                  <>
                    <input
                      className={`mini-input${kpiEdits[s.key] ? ' changed' : ''}`}
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`${s.label} ${mode} %`}
                      value={k[pctField] ?? ''}
                      onChange={(e) => setKpi(s, { [pctField]: parsePct(e.target.value) })}
                    />
                    <span className="row-trail">%</span>
                  </>
                )}
                {mode === 'offboarding' && (
                  <>
                    <input
                      className="mini-input"
                      inputMode="numeric"
                      placeholder="on time"
                      aria-label={`${s.label} offboarded on time`}
                      value={k.offboarded ?? ''}
                      onChange={(e) => setKpi(s, { offboarded: parseCount(e.target.value) })}
                    />
                    <span className="row-trail">/</span>
                    <input
                      className="mini-input"
                      inputMode="numeric"
                      placeholder="total"
                      aria-label={`${s.label} total offboarded`}
                      value={k.offboardTotal ?? ''}
                      onChange={(e) => setKpi(s, { offboardTotal: parseCount(e.target.value) })}
                    />
                  </>
                )}
                {mode === 'manpower' && (
                  <>
                    <input
                      className="mini-input"
                      inputMode="numeric"
                      placeholder="total"
                      aria-label={`${s.label} total workers`}
                      value={m.totalWorkers || ''}
                      onChange={(e) => setMp(s, { totalWorkers: parseCount(e.target.value) ?? 0 })}
                    />
                    <input
                      className="mini-input"
                      inputMode="numeric"
                      placeholder="illegal"
                      aria-label={`${s.label} illegal or freelance`}
                      value={m.illegalOrFreelance || ''}
                      onChange={(e) => setMp(s, { illegalOrFreelance: parseCount(e.target.value) ?? 0 })}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="list-foot">
        {mode === 'manpower'
          ? 'Total workers · illegal / freelance. Visas and recruitment fees: open the contractor.'
          : 'Grievance, ticket closure and formal vs illegal are calculated automatically.'}
      </div>
      <div style={{ height: 70 }} />

      {changes > 0 && (
        <div className="save-bar btn-row" style={{ marginTop: 0 }}>
          <button
            className="btn"
            disabled={saving}
            onClick={() => {
              setKpiEdits({})
              setMpEdits({})
            }}
          >
            Discard
          </button>
          <button className="btn primary" disabled={saving} onClick={() => void saveAll()}>
            {saving ? 'Saving…' : `Save ${changes} change${changes === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </Page>
  )
}
