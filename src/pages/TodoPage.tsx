import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import BigCard from '../components/BigCard'
import IconTile from '../components/IconTile'
import StatCard from '../components/StatCard'
import StatusChip from '../components/StatusChip'
import { showActions } from '../components/ActionSheet'
import type { IconName } from '../components/Icon'
import { useAllData } from '../lib/kpiData'
import { buildTodo, type TodoCard } from '../lib/todo'
import { todoTone, type Tone } from '../lib/tone'

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

/** One clear icon per item. */
const ICON: Record<string, IconName> = {
  submission: 'file-text',
  grievance: 'ticket',
  closure: 'activity',
  camps: 'tent',
  accommodation: 'bed',
  onboarding: 'user-plus',
  offboarding: 'sign-out',
  formal: 'users',
  meeting: 'calendar',
  quarterly: 'seal',
  closeout: 'checklist',
}

/** What each card means (shown on long-press). */
const HELP: Record<string, string> = {
  submission: 'WPS, manpower and salary declarations from every work order. Due by the 15th of the month.',
  grievance: 'Tickets still open. Red when any is older than 30 days.',
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

type Group = 'bad' | 'warn' | 'todo' | 'done'
const GROUPS: { key: Group; title: string; tone: Tone }[] = [
  { key: 'bad', title: 'Overdue', tone: 'bad' },
  { key: 'warn', title: 'Due soon', tone: 'warn' },
  { key: 'todo', title: 'To do', tone: 'info' },
  { key: 'done', title: 'Done', tone: 'good' },
]

const groupOf = (c: TodoCard): Group => (c.alert?.level === 'bad' ? 'bad' : c.alert?.level === 'warn' ? 'warn' : c.todo > 0 ? 'todo' : 'done')

function Item({ c }: { c: TodoCard }) {
  const navigate = useNavigate()
  const tone = todoTone(c)
  const name = SHORT[c.key] ?? c.title
  const icon = ICON[c.key] ?? c.icon
  const go = () => navigate(c.to)
  return (
    <BigCard
      tile={<IconTile icon={c.todo === 0 ? 'check-circle' : icon} tone={tone} size={64} />}
      title={name}
      sub={c.detail}
      count={c.todo > 0 ? (c.todo > 99 ? '99+' : c.todo) : undefined}
      countTone={tone}
      label={`${name}: ${c.todo === 0 ? 'done' : c.detail}${c.alert ? ` (${c.alert.text})` : ''}`}
      onOpen={go}
      onMore={() =>
        showActions({
          title: name,
          sub: c.alert ? `${c.alert.text} · ${c.detail}` : c.detail,
          cover: <IconTile icon={icon} tone={tone} size={52} />,
          note: HELP[c.key],
          actions: [{ label: c.todo ? 'Open and fix' : 'Open', icon: 'arrow-right', onSelect: go }],
        })
      }
    />
  )
}

/** Home: what needs doing this month, the most urgent first. */
export default function TodoPage() {
  const d = useAllData()
  const [only, setOnly] = useState<Group | null>(null)
  const [showDone, setShowDone] = useState(false)
  const cards = useMemo(() => (d.loaded ? buildTodo(d) : []), [d])
  const count = (g: Group) => cards.filter((c) => groupOf(c) === g).length
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const toggle = (g: Group) => setOnly((o) => (o === g ? null : g))

  return (
    <Page title="Today" subtitle={date}>

      <div className="stats">
        <StatCard icon="alert" tone="bad" value={d.loaded ? count('bad') : '–'} label="Overdue" active={only === 'bad'} onClick={() => toggle('bad')} />
        <StatCard icon="clock" tone="warn" value={d.loaded ? count('warn') : '–'} label="Due soon" active={only === 'warn'} onClick={() => toggle('warn')} />
        <StatCard icon="check-circle" tone="good" value={d.loaded ? count('done') : '–'} label="Done" active={only === 'done'} onClick={() => toggle('done')} />
      </div>

      {!d.loaded ? (
        <div className="today-list" style={{ marginTop: 22 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
      ) : (
        GROUPS.filter((g) => !only || only === g.key).map((g) => {
          const items = cards.filter((c) => groupOf(c) === g.key)
          if (!items.length) return null
          const collapsed = g.key === 'done' && !only && !showDone
          return (
            <section key={g.key} className="today-group">
              <h2>
                {g.title} <StatusChip tone={g.tone}>{items.length}</StatusChip>
              </h2>
              {collapsed ? (
                <button className="show-more" onClick={() => setShowDone(true)}>
                  Show {items.length} done
                </button>
              ) : (
                <div className="today-list stagger">
                  {items.map((c) => (
                    <Item key={c.key} c={c} />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}
      {d.loaded && !count('bad') && !count('warn') && !only && <div className="list-foot">Nothing overdue. Good work.</div>}
      <div className="list-foot" style={{ textAlign: 'center', marginTop: 20 }}>
        Hold a card to see what it means.
      </div>
    </Page>
  )
}
