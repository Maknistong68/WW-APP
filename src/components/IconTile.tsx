import Icon, { type IconName } from './Icon'
import { initials } from '../lib/art'
import type { Hue } from '../lib/hues'
import type { Tone } from '../lib/tone'

/**
 * One UI app-icon tile: a squircle with a bright gradient and a white filled
 * icon (or initials). `tone` colours it by status; menu items pass a fixed
 * `hue` from src/lib/hues.ts instead.
 */
export default function IconTile({
  icon,
  text,
  tone = 'info',
  hue,
  size = 52,
}: {
  icon?: IconName
  /** Initials are taken from this when there is no icon. */
  text?: string
  tone?: Tone
  /** Menu colour; wins over tone. */
  hue?: Hue
  size?: 36 | 40 | 44 | 52 | 64
}) {
  return (
    <span className={`itile ${hue ? `h-${hue}` : tone} s${size}`} aria-hidden="true">
      {icon ? <Icon name={icon} size={Math.round(size * 0.52)} fill /> : <b>{initials(text ?? '')}</b>}
    </span>
  )
}
