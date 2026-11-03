import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type IconName } from './Icon'
import Modal from './Modal'
import IconTile from './IconTile'
import CardList from './CardList'
import ItemRow from './ItemRow'
import { campTone } from '../lib/tone'
import { MENU_HUE, type Hue } from '../lib/hues'
import TicketSheet from './TicketSheet'
import CampSheet from './CampSheet'
import RoutineSheet from './RoutineSheet'
import { newCamp } from '../pages/CampsPage'
import { useAuthInfo } from '../lib/auth'
import { CAMP_STATUS_LABEL, campState } from '../lib/camps'
import { useAllData } from '../lib/kpiData'
import { newCase, newRoutine, newTicket } from '../lib/useData'
import { db } from '../db'
import type { Camp, Routine, Ticket } from '../types'

const CREATE_EVENT = 'ww:create'
/** Open the Create sheet from anywhere (the tab bar's + Create). */
export const openCreate = () => window.dispatchEvent(new Event(CREATE_EVENT))

type Step = 'menu' | 'inspection'

const CHOICES: { key: 'ticket' | 'case' | 'kpi' | 'inspection' | 'camp' | 'task'; label: string; sub: string; icon: IconName; hue: Hue }[] = [
  { key: 'ticket', label: 'Ticket', sub: 'Log a D&C ticket', icon: 'ticket', hue: MENU_HUE.ticket },
  { key: 'case', label: 'Case', sub: 'Raise with a contractor', icon: 'megaphone', hue: MENU_HUE.case },
  { key: 'kpi', label: 'Monthly entry', sub: 'Documents and KPIs', icon: 'gauge', hue: MENU_HUE.kpis },
  { key: 'inspection', label: 'Inspection', sub: 'Start a camp inspection', icon: 'clipboard', hue: MENU_HUE.inspections },
  { key: 'camp', label: 'Camp', sub: 'Add a camp to track', icon: 'tent', hue: MENU_HUE.camps },
  { key: 'task', label: 'Task', sub: 'A to-do for the team, once or repeating', icon: 'checklist', hue: MENU_HUE.task },
]

const RANK = { never: 0, expired: 1, due: 2, ok: 3 } as const

/** Create sheet (tab bar +): ticket, case, Monthly entry, inspection, camp or task. */
export default function AddButton() {
  const navigate = useNavigate()
  const { canEdit } = useAuthInfo()
  const [step, setStep] = useState<Step | null>(null)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [camp, setCamp] = useState<Camp | null>(null)
  const [routine, setRoutine] = useState<Routine | null>(null)

  useEffect(() => {
    const on = () => setStep('menu')
    window.addEventListener(CREATE_EVENT, on)
    return () => window.removeEventListener(CREATE_EVENT, on)
  }, [])

  if (!canEdit) return null
  const close = () => setStep(null)

  const choose = (key: (typeof CHOICES)[number]['key']) => {
    if (key === 'ticket') {
      close()
      setTicket(newTicket())
    } else if (key === 'case') {
      close()
      // numbered after the cases already in use (the sheet takes a fresh one again on save)
      void db.tickets
        .orderBy('ticketNo')
        .keys()
        .then((nos) => setTicket(newCase(nos as string[])))
    } else if (key === 'camp') {
      close()
      setCamp(newCamp())
    } else if (key === 'task') {
      close()
      setRoutine(newRoutine())
    } else if (key === 'kpi') {
      // documents and KPIs, by work order or by item
      close()
      navigate('/entry')
    } else {
      setStep(key)
    }
  }
  const startInspection = (uuid?: string) => {
    close()
    navigate(uuid ? `/new/accommodation?camp=${uuid}` : '/new/accommodation')
  }

  return (
    <>
      {step === 'menu' && (
        <Modal title="Create" onClose={close}>
          <div className="sheet-body">
            <div className="create-grid">
              {CHOICES.map((c) => (
                <button key={c.key} className="create-card" onClick={() => choose(c.key)}>
                  <IconTile icon={c.icon} hue={c.hue} size={52} />
                  <span className="create-label">{c.label}</span>
                  <span className="create-sub">{c.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {step === 'inspection' && <InspectionStep onClose={close} onPick={startInspection} />}

      {ticket && <TicketSheet ticket={ticket} onClose={() => setTicket(null)} />}
      {camp && <CampSheet camp={camp} onClose={() => setCamp(null)} />}
      {routine && <RoutineSheet routine={routine} onClose={() => setRoutine(null)} />}
    </>
  )
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
        <CardList>
          {camps.map(({ c, st }) => (
            <ItemRow
              key={c.uuid}
              tile={<IconTile icon="tent" tone={campTone(st.status)} size={52} />}
              title={c.name}
              sub={`${CAMP_STATUS_LABEL[st.status]}${st.daysSince !== null ? ` · last ${st.daysSince}d ago` : ''}`}
              onOpen={() => onPick(c.uuid)}
            />
          ))}
          <ItemRow tile={<IconTile icon="map-pin" tone="none" size={52} />} title="No camp" sub="Other site" onOpen={() => onPick()} />
        </CardList>
      </div>
    </Modal>
  )
}
