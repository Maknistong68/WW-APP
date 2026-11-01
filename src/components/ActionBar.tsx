import Icon, { type IconName } from './Icon'
import { useBodyFlag } from '../lib/useBodyFlag'

export interface BarAction {
  label: string
  icon?: IconName
  onClick: () => void
  disabled?: boolean
}

/**
 * Sticky bottom bar for detail and form screens: one full-width green button
 * at thumb height, plus up to two icon buttons. Hides the tab bar while shown.
 */
export default function ActionBar({ primary, secondary = [] }: { primary?: BarAction; secondary?: BarAction[] }) {
  useBodyFlag('has-actionbar', !!primary || secondary.length > 0)
  if (!primary && secondary.length === 0) return null
  return (
    <div className="actionbar">
      {secondary.slice(0, 2).map((a) => (
        <button key={a.label} className="actionbar-icon" aria-label={a.label} title={a.label} disabled={a.disabled} onClick={a.onClick}>
          <Icon name={a.icon ?? 'dots'} size={24} />
        </button>
      ))}
      {primary && (
        <button className="actionbar-main" disabled={primary.disabled} onClick={primary.onClick}>
          {primary.icon && <Icon name={primary.icon} size={22} strokeWidth={2.4} />}
          {primary.label}
        </button>
      )}
    </div>
  )
}
