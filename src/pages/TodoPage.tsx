import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { showToast } from '../components/Toast'
import { monthLabel, monthOf } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { buildTodo, type TodoCard } from '../lib/todo'

/** Short names under the tiles. */
const SHORT: Record<string, string> = {
  submission: 'Submission',
  grievance: 'Tickets',
  closure: 'Closure',
  camps: 'Camps',
  accommodation: 'Accomm.',
  onboarding: 'Onboarding',
  offboarding: 'Offboarding',
  formal: 'Formal',
  meeting: 'Meeting',
  quarterly: 'Quarterly',
}

/** One icon tile with its name; the number of things to do on the corner, colour = urgency. */
function Tile({ c }: { c: TodoCard }) {
  const navigate = useNavigate()
  const timer = useRef<number | undefined>(undefined)
  const held = useRef(false)
  const tone = c.alert?.level ?? (c.todo === 0 ? 'done' : 'todo')
  const name = `${c.title}: ${c.todo === 0 ? 'done' : c.detail}${c.alert ? ` (${c.alert.text})` : ''}`
  const showName = () => showToast({ text: name, duration: 3500 })

  return (
    <button
      className="tile-app"
      aria-label={name}
      title={name}
      onPointerDown={() => {
        held.current = false
        timer.current = window.setTimeout(() => {
          held.current = true
          showName()
        }, 450)
      }}
      onPointerUp={() => window.clearTimeout(timer.current)}
      onPointerLeave={() => window.clearTimeout(timer.current)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held.current) return
        navigate(c.to)
      }}
    >
      <span className={`tile ${tone}`}>
        <Icon name={c.todo === 0 ? 'check' : c.icon} size={30} strokeWidth={2} />
        {c.todo > 0 && <span className={`tile-badge ${tone}`}>{c.todo > 99 ? '99+' : c.todo}</span>}
      </span>
      <span className="tile-name">{SHORT[c.key] ?? c.title}</span>
    </button>
  )
}

/** Home: the monthly routine as named icon tiles, alerts first. */
export default function TodoPage() {
  const d = useAllData()
  const cards = useMemo(() => (d.loaded ? buildTodo(d) : []), [d])
  const alerts = cards.filter((c) => c.alert?.level === 'bad').length

  return (
    <Page title="Home">
      <div className="chart-sub" style={{ margin: '-6px 4px 14px', fontSize: 15 }}>
        {monthLabel(monthOf())} · {alerts ? `${alerts} need attention` : 'nothing urgent'}
      </div>
      <div className="tile-grid">
        {cards.map((c) => (
          <Tile key={c.key} c={c} />
        ))}
      </div>
      <div className="list-foot" style={{ textAlign: 'center' }}>
        Tap to open · hold for details
      </div>
    </Page>
  )
}
