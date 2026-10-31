import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page, { SettingsButton } from '../components/Page'
import Icon from '../components/Icon'
import TicketSheet from '../components/TicketSheet'
import { monthLabel, monthOf } from '../lib/dates'
import { useAllData } from '../lib/kpiData'
import { buildTodo } from '../lib/todo'
import { newTicket } from '../lib/useData'
import type { Ticket } from '../types'

/** Home: one card per item of the monthly routine, alerts first. */
export default function TodoPage() {
  const navigate = useNavigate()
  const d = useAllData()
  const [adding, setAdding] = useState<Ticket | null>(null)
  const cards = useMemo(() => (d.loaded ? buildTodo(d) : []), [d])
  const left = cards.filter((c) => c.todo > 0).length
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

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
        {today} · {monthLabel(monthOf())} · {left ? `${left} item${left === 1 ? '' : 's'} to do` : 'all done'}
      </div>

      {cards.map((c) => {
        const tone = c.alert?.level ?? (c.todo === 0 ? 'done' : '')
        return (
          <button key={c.key} className={`todo-card ${tone}`} onClick={() => navigate(c.to)}>
            <span className="todo-icon">
              <Icon name={c.todo === 0 ? 'check' : c.icon} size={22} />
            </span>
            <span className="todo-main">
              <div className="todo-title">{c.title}</div>
              <div className="todo-detail">{c.detail}</div>
              {c.alert && <span className={`alert-pill ${c.alert.level}`}>{c.alert.text}</span>}
            </span>
            <span className="todo-count">
              {c.todo === 0 ? (
                <div className="todo-num done">Done</div>
              ) : (
                <>
                  <div className="todo-num">{c.todo}</div>
                  <div className="todo-of">{c.total !== null ? `of ${c.total}` : 'to do'}</div>
                </>
              )}
            </span>
          </button>
        )
      })}

      {adding && <TicketSheet ticket={adding} onClose={() => setAdding(null)} />}
    </Page>
  )
}
