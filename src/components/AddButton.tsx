import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon, { type IconName } from './Icon'
import Modal from './Modal'
import TicketSheet from './TicketSheet'
import CampSheet from './CampSheet'
import { MonthStepper, SubjectEditor, SubjectList } from './SubjectPicker'
import { newCamp } from '../pages/CampsPage'
import { useAuthInfo } from '../lib/auth'
import { CAMP_STATUS_LABEL, campState } from '../lib/camps'
import { monthOf } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { kpiSubjects, subjectKpi, type KpiSubject } from '../lib/subjects'
import { newTicket } from '../lib/useData'
import type { Camp, Ticket } from '../types'

/** Pages that show the + button. */
const TOP_LEVEL = ['/', '/tickets', '/contractors', '/camps', '/dashboard']

type Step = 'menu' | 'kpi' | 'inspection'

const CHOICES: { key: 'ticket' | 'kpi' | 'inspection' | 'camp'; label: string; sub: string; icon: IconName }[] = [
  { key: 'ticket', label: 'Ticket', sub: 'Log a complaint', icon: 'ticket' },
  { key: 'kpi', label: 'KPI', sub: 'Monthly KPIs for a work order', icon: 'chart' },
  { key: 'inspection', label: 'Inspection', sub: 'Start a camp inspection', icon: 'clipboard' },
  { key: 'camp', label: 'Camp', sub: 'Add a camp to track', icon: 'tent' },
]

const RANK = { never: 0, expired: 1, due: 2, ok: 3 } as const

/** The one + for adding anything: ticket, KPI month, inspection or camp. */
export default function AddButton() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  const [step, setStep] = useState<Step | null>(null)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [camp, setCamp] = useState<Camp | null>(null)
  const [subject, setSubject] = useState<KpiSubject | null>(null)
  const [month, setMonth] = useState(monthOf())

  if (!canEdit) return null
  const visible = TOP_LEVEL.includes(pathname)
  const close = () => setStep(null)

  const choose = (key: (typeof CHOICES)[number]['key']) => {
    if (key === 'ticket') {
      close()
      setTicket(newTicket())
    } else if (key === 'camp') {
      close()
      setCamp(newCamp())
    } else {
      setMonth(monthOf())
      setStep(key)
    }
  }
  const startInspection = (uuid?: string) => {
    close()
    navigate(uuid ? `/new/accommodation?camp=${uuid}` : '/new/accommodation')
  }

  return (
    <>
      {visible && (
        <button className="fab add-fab" aria-label="Add" onClick={() => setStep('menu')}>
          <Icon name="plus" size={32} strokeWidth={2.4} />
        </button>
      )}

      {step === 'menu' && (
        <Modal title="Add" onClose={close}>
          <div className="sheet-body">
            <div className="list">
              {CHOICES.map((c) => (
                <button key={c.key} className="row add-choice" onClick={() => choose(c.key)}>
                  <span className="row-icon">
                    <Icon name={c.icon} size={20} />
                  </span>
                  <span className="row-main">
                    <div className="row-title">{c.label}</div>
                    <div className="row-sub">{c.sub}</div>
                  </span>
                  <span className="row-chev">
                    <Icon name="chevron-right" size={18} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {step === 'kpi' && (
        <KpiStep
          month={month}
          setMonth={setMonth}
          onClose={close}
          onPick={(s) => {
            close()
            setSubject(s)
          }}
        />
      )}

      {step === 'inspection' && <InspectionStep onClose={close} onPick={startInspection} />}

      {ticket && <TicketSheet ticket={ticket} onClose={() => setTicket(null)} />}
      {camp && <CampSheet camp={camp} onClose={() => setCamp(null)} />}
      {subject && <KpiEditor subject={subject} month={month} onClose={() => setSubject(null)} />}
    </>
  )
}

/** Step 2 of "KPI": month + which work order. */
function KpiStep({
  month,
  setMonth,
  onPick,
  onClose,
}: {
  month: string
  setMonth: (m: string) => void
  onPick: (s: KpiSubject) => void
  onClose: () => void
}) {
  const d = useAllData()
  const rows = useMemo(
    () =>
      kpiSubjects(d.contractors, d.workOrders)
        .map((s) => ({ s, done: !!subjectKpi(s, d.kpis, month) }))
        .sort((a, b) => Number(a.done) - Number(b.done) || a.s.label.localeCompare(b.s.label)),
    [d.contractors, d.workOrders, d.kpis, month],
  )
  return (
    <Modal title="KPI · pick a work order" onClose={onClose}>
      <div className="sheet-body">
        <MonthStepper month={month} onChange={setMonth} />
        <SubjectList rows={rows} onPick={onPick} />
        <div className="list-foot">✓ already has KPIs this month · tap to add or change</div>
      </div>
    </Modal>
  )
}

function KpiEditor({ subject, month, onClose }: { subject: KpiSubject; month: string; onClose: () => void }) {
  const d = useAllData()
  if (!d.loaded) return null
  return <SubjectEditor d={d} subject={subject} month={month} sheet="kpi" onClose={onClose} />
}

/** Step 2 of "Inspection": which camp; expired ones first. */
function InspectionStep({ onPick, onClose }: { onPick: (campUuid?: string) => void; onClose: () => void }) {
  const d = useAllData()
  const camps = useMemo(
    () =>
      d.camps
        .filter((c) => c.active)
        .map((c) => ({ c, st: campState(c, d.inspections) }))
        .sort((a, b) => RANK[a.st.status] - RANK[b.st.status] || a.c.name.localeCompare(b.c.name)),
    [d.camps, d.inspections],
  )
  return (
    <Modal title="Inspection · pick a camp" onClose={onClose}>
      <div className="sheet-body">
        <div className="list">
          {camps.map(({ c, st }) => (
            <button key={c.uuid} className="row" onClick={() => onPick(c.uuid)}>
              <span className={`status-dot ${st.status === 'ok' ? 'good' : st.status === 'due' ? 'warn' : 'bad'}`} />
              <span className="row-main">
                <div className="row-title">{c.name}</div>
                <div className="row-sub">
                  {CAMP_STATUS_LABEL[st.status]}
                  {st.daysSince !== null ? ` · last ${st.daysSince}d ago` : ''}
                </div>
              </span>
              <span className="row-chev">
                <Icon name="chevron-right" size={18} />
              </span>
            </button>
          ))}
          <button className="row tint" onClick={() => onPick()}>
            No camp · other site
          </button>
        </div>
      </div>
    </Modal>
  )
}
