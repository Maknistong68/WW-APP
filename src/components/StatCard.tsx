import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import CountUp from './CountUp'
import type { Tone } from '../lib/tone'

/** A number that matters: tile, big figure, short label. Tappable when it leads somewhere. */
export default function StatCard({
  icon,
  tone = 'none',
  value,
  label,
  onClick,
  active,
  bump,
}: {
  icon: IconName
  tone?: Tone
  value: ReactNode
  label: string
  onClick?: () => void
  /** Selected as a filter. */
  active?: boolean
  /** Give a little spring (the number just went up). */
  bump?: boolean
}) {
  const body = (
    <>
      <span className={`itile ${tone} s40`} aria-hidden="true">
        <Icon name={icon} size={20} fill />
      </span>
      <span className={`stat-num ${tone}`}>
        <CountUp value={value} />
      </span>
      <span className="stat-label">{label}</span>
    </>
  )
  return onClick ? (
    <button className={`stat${active ? ' active' : ''}${bump ? ' bump' : ''}`} aria-pressed={active} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="stat">{body}</div>
  )
}
