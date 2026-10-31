import Icon, { type IconName } from './Icon'
import { coverGradient, initials, type Section } from '../lib/art'

/** Square gradient "cover art" with an icon or initials. */
export default function Cover({
  section,
  seed = '',
  icon,
  text,
  size = 48,
  round = false,
}: {
  section: Section
  seed?: string
  icon?: IconName
  /** Shown as initials when there is no icon. */
  text?: string
  size?: number
  round?: boolean
}) {
  return (
    <span
      className={`cover${round ? ' round' : ''}`}
      style={{ width: size, height: size, background: coverGradient(section, seed), borderRadius: round ? '50%' : Math.max(6, size / 8) }}
      aria-hidden="true"
    >
      {icon ? <Icon name={icon} size={Math.round(size * 0.46)} fill /> : <b style={{ fontSize: Math.round(size * 0.34) }}>{initials(text ?? seed)}</b>}
    </span>
  )
}
