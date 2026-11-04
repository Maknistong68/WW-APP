import type { MonthDoc } from '../../lib/woScore'

const WORD: Record<MonthDoc, string> = {
  in: 'in',
  awaited: 'missing',
  notProvided: 'not provided',
  na: 'not applicable',
  off: 'switched off',
  none: 'not tracked yet',
}
const MARK: Record<MonthDoc, string> = { in: '✓', awaited: '✗', notProvided: '–', na: '–', off: '–', none: '·' }
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A document month by month: ✓ in (green), ✗ missing (red), – not needed (grey), · not tracked yet. */
export default function MonthMarks({ months, states }: { months: string[]; states: MonthDoc[] }) {
  return (
    <div className="month-marks">
      <div className="mm-cells" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
        {months.map((m, i) => {
          const name = MONTH[Number(m.slice(5, 7)) - 1] ?? m
          const st = states[i]
          return (
            <div key={m} className={`mm-cell ${st}`} aria-label={`${name} ${m.slice(0, 4)}: ${WORD[st]}`} role="img">
              <span className="mm-mark" aria-hidden="true">
                {MARK[st]}
              </span>
              <span className="mm-month" aria-hidden="true">
                {name.slice(0, 1)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mm-legend" aria-hidden="true">
        <span className="in">✓ in</span>
        <span className="awaited">✗ missing</span>
        <span>– not needed</span>
      </div>
    </div>
  )
}
