import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page, { SettingsButton } from '../components/Page'
import Icon from '../components/Icon'
import TicketSheet from '../components/TicketSheet'
import { showToast } from '../components/Toast'
import { monthLabel, monthOf } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { buildTodo, type TodoCard } from '../lib/todo'
import { newTicket } from '../lib/useData'
import type { Ticket } from '../types'

/** One icon tile: the number of things to do on the corner, colour = urgency. */
function Tile({ c }: { c: TodoCard }) {
  const navigate = useNavigate()
  const timer = useRef<number | undefined>(undefined)
  const held = useRef(false)
  const tone = c.alert?.level ?? (c.todo === 0 ? 'done' : 'todo')
  const name = `${c.title}: ${c.todo === 0 ? 'done' : c.detail}${c.alert ? ` (${c.alert.text})` : ''}`
  const showName = () => showToast({ text: name, duration: 3500 })

  return (
    <button
      className={`tile ${tone}`}
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
      <Icon name={c.todo === 0 ? 'check' : c.icon} size={30} strokeWidth={2} />
      {c.todo > 0 && <span className={`tile-badge ${tone}`}>{c.todo > 99 ? '99+' : c.todo}</span>}
    </button>
  )
}

/** Home: the monthly routine as icon tiles, alerts first. */
export default function TodoPage() {
  const d = useAllData()
  const [adding, setAdding] = useState<Ticket | null>(null)
  const cards = useMemo(() => (d.loaded ? buildTodo(d) : []), [d])
  const alerts = cards.filter((c) => c.alert?.level === 'bad').length

  return (
    <Page
      title="To-do"
      actions={
        <>
          <button className="nav-btn" aria-label="New ticket" onClick={() => setAdding(newTicket())}>
            <Icon name="plus" size={26} />
          </button>
          <SettingsButton />
        </>
      }
    >
      <div className="chart-sub" style={{ margin: '-6px 4px 14px', fontSize: 15 }}>
        {monthLabel(monthOf())} · {alerts ? `${alerts} need attention` : 'nothing urgent'}
      </div>
      <div className="tile-grid">
        {cards.map((c) => (
          <Tile key={c.key} c={c} />
        ))}
      </div>
      <div className="list-foot" style={{ textAlign: 'center' }}>
        Tap a tile to fix it · hold it to see what it is
      </div>
      {adding && <TicketSheet ticket={adding} onClose={() => setAdding(null)} />}
    </Page>
  )
}
