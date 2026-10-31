import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { showToast } from '../components/Toast'
import { monthOf } from '../lib/dates'
import { gridsFromExcel, readGrids, type FileKind, type ReadResult } from '../import/readers'
import { NEW, applyPlan, buildPlan, type ImportPlan, type ImportSummary } from '../import/plan'

const KIND_LABEL: Record<FileKind, string> = {
  violationLog: 'Violation Log',
  ticketTracker: 'Internal Ticket Tracker',
  kpiSystem: 'KPI System',
  workforce: 'Workforce Declaration',
  unknown: 'Unknown file',
}

interface ReadFile {
  name: string
  result: ReadResult
}

type Step = 'pick' | 'match' | 'preview' | 'done'

export default function ImportPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<ReadFile[]>([])
  const [reading, setReading] = useState(false)
  const [step, setStep] = useState<Step>('pick')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<ImportSummary | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!list.length) return
    setReading(true)
    try {
      const read: ReadFile[] = []
      for (const f of list) {
        try {
          const grids = await gridsFromExcel(await f.arrayBuffer())
          read.push({ name: f.name, result: readGrids(grids, monthOf()) })
        } catch (err) {
          showToast({ text: `${f.name}: ${err instanceof Error ? err.message : 'could not be read'}`, duration: 7000 })
        }
      }
      setFiles((prev) => [...prev.filter((p) => !read.some((r) => r.name === p.name)), ...read])
    } finally {
      setReading(false)
    }
  }

  const toMatch = async () => {
    const p = buildPlan(
      files.map((f) => f.result),
      await db.contractors.toArray(),
      await db.workOrders.toArray(),
    )
    setPlan(p)
    setStep(p.groups.length ? 'match' : 'preview')
  }

  const setGroup = (id: string, patch: Partial<ImportPlan['groups'][number]>) =>
    setPlan((p) => (p ? { ...p, groups: p.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) } : p))

  const doImport = async () => {
    if (!plan) return
    setSaving(true)
    try {
      setDone(await applyPlan(plan))
      setStep('done')
    } catch (err) {
      showToast({ text: `Import failed — nothing was saved. ${err instanceof Error ? err.message : ''}`, duration: 8000 })
    } finally {
      setSaving(false)
    }
  }

  const usable = files.filter((f) => f.result.tickets.length || f.result.kpis.length || f.result.weekly.length || f.result.contractors.length)

  return (
    <Page title="Import history" back="/settings" backLabel="Settings">
      {step === 'pick' && (
        <>
          <div className="list-foot" style={{ marginTop: 0 }}>
            One time only. Pick the Violation Log, Internal Ticket Tracker and KPI System files. They are read on this
            phone; nothing is uploaded.
          </div>
          {files.length > 0 && (
            <div className="list">
              {files.map((f) => {
                const r = f.result
                const parts = [
                  r.tickets.length && `${r.tickets.length} tickets`,
                  r.weekly.length && `${r.weekly.length} weeks`,
                  r.kpis.length && `${r.kpis.length} KPI months`,
                  r.contractors.length && `${r.contractors.length} contractors`,
                ].filter(Boolean)
                return (
                  <div key={f.name} className="row">
                    <span className="row-icon" style={{ background: parts.length ? 'var(--brand)' : 'var(--separator)' }}>
                      <Icon name={parts.length ? 'check' : 'x'} size={18} />
                    </span>
                    <span className="row-main">
                      <div className="row-title">{KIND_LABEL[r.kind]}</div>
                      <div className="row-sub">{parts.length ? parts.join(' · ') : r.note ?? 'Nothing to import'}</div>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="list">
            <button className="row tint" disabled={reading} onClick={() => inputRef.current?.click()}>
              <Icon name="plus" size={20} /> {reading ? 'Reading…' : files.length ? 'Add more files' : 'Choose files'}
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onPick}
          />
          <button className="btn primary block" disabled={!usable.length || reading} onClick={() => void toMatch()}>
            Next
          </button>
        </>
      )}

      {step === 'match' && plan && (
        <>
          <div className="list-foot" style={{ marginTop: 0 }}>
            Check which contractor each spelling belongs to. Same company, different spellings = one contractor.
          </div>
          {plan.groups.map((g) => (
            <div key={g.id} className="list">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="row-main">
                  <div className="row-title" style={{ whiteSpace: 'normal' }}>
                    {g.variants.join(' · ')}
                  </div>
                  <div className="row-sub">{g.tickets} tickets</div>
                </span>
              </div>
              <label className="row">
                <span className="row-label">Goes to</span>
                <select value={g.target} onChange={(e) => setGroup(g.id, { target: e.target.value })}>
                  <option value={NEW}>New contractor</option>
                  {plan.masters.map((m) => (
                    <option key={m.uuid} value={m.uuid}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              {g.target === NEW && (
                <label className="row">
                  <span className="row-label">Name</span>
                  <input value={g.newName} onChange={(e) => setGroup(g.id, { newName: e.target.value })} />
                </label>
              )}
            </div>
          ))}
          <button className="btn primary block" onClick={() => setStep('preview')}>
            Next
          </button>
        </>
      )}

      {step === 'preview' && plan && (
        <>
          <div className="list">
            {[
              ['Tickets', `${plan.tickets.length} · ${plan.tickets.filter((t) => t.status !== 'Closed').length} open`],
              [
                'Contractors',
                String(plan.masters.filter((m) => !m.existing).length + plan.groups.filter((g) => g.target === NEW).length),
              ],
              ['Work orders', String(plan.masters.reduce((n, m) => n + m.workOrders.filter((w) => !w.existing).length, 0))],
              ['KPI months', String(plan.kpis.length)],
              ['Weekly counts', String(plan.weekly.length)],
              ['Skipped rows', String(plan.skipped.length)],
            ].map(([l, v]) => (
              <div key={l} className="row">
                <span className="row-main">{l}</span>
                <span className="row-trail">{v}</span>
              </div>
            ))}
          </div>
          {plan.notes.map((n) => (
            <div key={n} className="list-foot">
              {n}
            </div>
          ))}
          <div className="list-foot">Worker descriptions and names in the files are not imported.</div>
          {plan.skipped.length > 0 && (
            <>
              <button className="details-toggle" onClick={() => setShowSkipped(!showSkipped)}>
                {showSkipped ? 'Hide' : 'Show'} skipped rows
              </button>
              {showSkipped && (
                <div className="list">
                  {plan.skipped.map((s, i) => (
                    <div key={i} className="row">
                      <span className="row-main">
                        <div className="row-title" style={{ fontSize: 14 }}>
                          {s.reason}
                        </div>
                        <div className="row-sub">
                          {s.sheet}
                          {s.row ? ` · row ${s.row}` : ''}
                        </div>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="btn-row">
            <button className="btn" onClick={() => setStep(plan.groups.length ? 'match' : 'pick')}>
              Back
            </button>
            <button className="btn primary" disabled={saving} onClick={() => void doImport()}>
              {saving ? 'Importing…' : 'Import'}
            </button>
          </div>
        </>
      )}

      {step === 'done' && done && (
        <>
          <div className="empty-state">
            <Icon name="check" size={48} />
            <b>Imported</b>
            {done.tickets} tickets · {done.contractors} contractors · {done.workOrders} work orders · {done.kpis} KPI months ·{' '}
            {done.weeks} weeks
            {done.duplicates ? ` · ${done.duplicates} already here, skipped` : ''}
          </div>
          <button className="btn primary block" onClick={() => navigate('/dashboard')}>
            Open dashboard
          </button>
        </>
      )}
    </Page>
  )
}
