import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Cover from '../components/Cover'
import { showActions } from '../components/ActionSheet'
import { coverGradient, type Section } from '../lib/art'
import { useAllData } from '../lib/kpiData'
import { buildTodo, type TodoCard } from '../lib/todo'
import { useLongPress } from '../lib/useLongPress'

/** Short names on the cards. */
const SHORT: Record<string, string> = {
  submission: 'Submissions',
  grievance: 'Open tickets',
  closure: 'Ticket closure',
  camps: 'Camp inspections',
  accommodation: 'Accommodation',
  onboarding: 'Onboarding',
  offboarding: 'Offboarding',
  formal: 'Formal workers',
  meeting: 'Meetings',
  quarterly: 'Quarterly audit',
  closeout: 'Audit close-out',
}

/** What each card means (shown on long-press). */
const HELP: Record<string, string> = {
  submission: 'WPS, manpower and salary declarations from every work order. Due by the 15th of the month.',
  grievance: 'Tickets still open. Turns red when any is older than 30 days.',
  closure: 'Share of this month’s tickets that are closed. Flagged below 70%.',
  camps: 'Every camp is inspected once per cycle (90 days). Red when a camp is overdue.',
  accommodation: 'Accommodation score per work order this month. Uses the month’s audit when nothing is typed.',
  onboarding: 'Onboarding score per work order this month.',
  offboarding: 'Workers offboarded on time out of all offboarded, per work order.',
  formal: 'Worker counts per work order: total and illegal / freelance. Counts only, no names.',
  meeting: 'Meeting attendance per work order this month.',
  quarterly: 'One audit score per work order each quarter.',
  closeout: 'Findings from the quarterly audits, to be closed out within 30 days.',
}

/** Card colour per item. */
const ART: Record<string, Section> = {
  submission: 'kpi',
  grievance: 'tickets',
  closure: 'dashboard',
  camps: 'camps',
  accommodation: 'money',
  onboarding: 'contractors',
  offboarding: 'users',
  formal: 'library',
  meeting: 'home',
  quarterly: 'kpi',
  closeout: 'closeout',
}

type Filter = 'all' | 'alerts' | 'todo' | 'done'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const toneOf = (c: TodoCard) => c.alert?.level ?? (c.todo === 0 ? 'done' : 'todo')

function openSheet(c: TodoCard, go: () => void) {
  showActions({
    title: SHORT[c.key] ?? c.title,
    sub: c.alert ? `${c.alert.text} · ${c.detail}` : c.detail,
    cover: <Cover section={ART[c.key] ?? 'home'} seed={c.key} icon={c.icon} size={56} />,
    note: HELP[c.key],
    actions: [{ label: c.todo ? 'Open and fix' : 'Open', icon: 'arrow-right', onSelect: go }],
  })
}

/** The one big card: the most urgent thing right now. */
function UpNext({ c }: { c: TodoCard | undefined }) {
  const navigate = useNavigate()
  const press = useLongPress(c ? () => openSheet(c, () => navigate(c.to)) : undefined)
  if (!c) {
    return (
      <div className="upnext calm" style={{ background: coverGradient('home', 'calm') }}>
        <Icon name="check-circle" size={40} fill />
        <div className="upnext-title">All clear</div>
        <div className="upnext-sub">Nothing needs you right now.</div>
      </div>
    )
  }
  const tone = toneOf(c)
  return (
    <div
      className="upnext"
      role="button"
      tabIndex={0}
      style={{ background: coverGradient(ART[c.key] ?? 'home', c.key) }}
      onClick={() => navigate(c.to)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(c.to)}
      {...press}
    >
      <div className="upnext-kicker">Up next</div>
      <div className="upnext-row">
        <div className="upnext-text">
          <div className="upnext-title">{SHORT[c.key] ?? c.title}</div>
          <div className="upnext-sub">{c.detail}</div>
          {c.alert && <span className={`status-chip ${tone} solid`}>{c.alert.text}</span>}
        </div>
        <button
          className="play-btn"
          aria-label={`Open ${SHORT[c.key] ?? c.title}`}
          onClick={(e) => {
            e.stopPropagation()
            navigate(c.to)
          }}
        >
          <Icon name="arrow-right" size={26} strokeWidth={2.4} />
        </button>
      </div>
      <span className="upnext-icon" aria-hidden="true">
        <Icon name={c.icon} size={120} fill />
      </span>
    </div>
  )
}

/** A card in the grid: cover art with the count, the name under it. */
function Card({ c, index }: { c: TodoCard; index: number }) {
  const navigate = useNavigate()
  const press = useLongPress(() => openSheet(c, () => navigate(c.to)))
  const tone = toneOf(c)
  const name = SHORT[c.key] ?? c.title
  return (
    <button
      className="hcard"
      style={{ animationDelay: `${Math.min(index, 11) * 30}ms` }}
      aria-label={`${name}: ${c.todo === 0 ? 'done' : c.detail}${c.alert ? ` (${c.alert.text})` : ''}`}
      onClick={() => navigate(c.to)}
      {...press}
    >
      <span className="hcard-art" style={{ background: coverGradient(ART[c.key] ?? 'home', c.key) }}>
        <Icon name={c.icon} size={34} fill />
        {c.todo > 0 ? (
          <span className={`hcard-badge ${tone}`}>{c.todo > 99 ? '99+' : c.todo}</span>
        ) : (
          <span className="hcard-badge done">
            <Icon name="check" size={14} strokeWidth={2.4} />
          </span>
        )}
      </span>
      <span className="hcard-name">{name}</span>
      <span className={`hcard-sub ${tone}`}>{c.alert ? c.alert.text : c.todo === 0 ? 'Done' : `${c.todo} to do`}</span>
    </button>
  )
}

/** Home: what needs doing this month, the most urgent first. */
export default function TodoPage() {
  const d = useAllData()
  const [filter, setFilter] = useState<Filter>('all')
  const cards = useMemo(() => (d.loaded ? buildTodo(d) : []), [d])
  const counts = {
    alerts: cards.filter((c) => c.alert).length,
    todo: cards.filter((c) => c.todo > 0).length,
    done: cards.filter((c) => c.todo === 0).length,
  }
  const shown = cards.filter((c) =>
    filter === 'alerts' ? !!c.alert : filter === 'todo' ? c.todo > 0 : filter === 'done' ? c.todo === 0 : true,
  )
  const next = cards.find((c) => c.alert) ?? cards.find((c) => c.todo > 0)
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Page title={greeting()} section="home">
      <div className="home-date">
        {date}
        {d.loaded ? ` · ${counts.alerts ? `${counts.alerts} need attention` : 'nothing urgent'}` : ''}
      </div>
      {d.loaded ? <UpNext c={next} /> : <div className="upnext skeleton" />}

      <div className="segmented" role="tablist" aria-label="Show">
        {(
          [
            ['all', 'All', cards.length],
            ['alerts', 'Alerts', counts.alerts],
            ['todo', 'To do', counts.todo],
            ['done', 'Done', counts.done],
          ] as const
        ).map(([key, label, n]) => (
          <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>
            {label} {d.loaded && <b>{n}</b>}
          </button>
        ))}
      </div>

      <div className="hgrid">
        {d.loaded
          ? shown.map((c, i) => <Card key={c.key} c={c} index={i} />)
          : Array.from({ length: 6 }, (_, i) => <div key={i} className="hcard skeleton" />)}
      </div>
      {d.loaded && shown.length === 0 && <div className="list-foot">Nothing here.</div>}
      <div className="list-foot hint">Hold a card to see what it means.</div>
    </Page>
  )
}
