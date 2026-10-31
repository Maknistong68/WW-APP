import Icon, { type IconName } from './Icon'
import { initials } from '../lib/art'
import type { Tone } from '../lib/tone'

/** Big rounded tile in a soft tint of its status colour, with a filled icon or initials. */
export default function IconTile({
  icon,
  text,
  tone = 'info',
  size = 52,
}: {
  icon?: IconName
  /** Initials are taken from this when there is no icon. */
  text?: string
  tone?: Tone
  size?: 40 | 44 | 52 | 64
}) {
  return (
    <span className={`itile ${tone} s${size}`} aria-hidden="true">
      {icon ? <Icon name={icon} size={Math.round(size * 0.5)} fill /> : <b>{initials(text ?? '')}</b>}
    </span>
  )
}
