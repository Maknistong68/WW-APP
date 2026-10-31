import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import { TONE_ICON, type Tone } from '../lib/tone'

/** Status as icon + word (never colour alone). */
export default function StatusChip({ tone, icon, children }: { tone: Tone; icon?: IconName | false; children: ReactNode }) {
  const name = icon === false ? null : (icon ?? TONE_ICON[tone])
  return (
    <span className={`schip ${tone}`}>
      {name && <Icon name={name} size={14} fill />}
      {children}
    </span>
  )
}
