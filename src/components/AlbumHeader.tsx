import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

export interface AlbumButton {
  icon: IconName
  label: string
  onClick: () => void
}

/**
 * Detail-screen header (like an album page): big cover, title, one-line
 * subtitle and meta, then a row of small icon buttons and one round green
 * primary action.
 */
export default function AlbumHeader({
  cover,
  title,
  sub,
  meta,
  buttons = [],
  primary,
}: {
  cover: ReactNode
  title: ReactNode
  sub?: ReactNode
  meta?: ReactNode
  buttons?: AlbumButton[]
  primary?: AlbumButton
}) {
  return (
    <div className="album">
      <div className="album-cover">{cover}</div>
      <h1 className="album-title">{title}</h1>
      {sub && <div className="album-sub">{sub}</div>}
      {meta && <div className="album-meta">{meta}</div>}
      {(buttons.length > 0 || primary) && (
        <div className="album-actions">
          <div className="album-buttons">
            {buttons.map((b) => (
              <button key={b.label} className="album-btn" aria-label={b.label} title={b.label} onClick={b.onClick}>
                <Icon name={b.icon} size={26} />
              </button>
            ))}
          </div>
          {primary && (
            <button className="play-btn big" aria-label={primary.label} title={primary.label} onClick={primary.onClick}>
              <Icon name={primary.icon} size={28} strokeWidth={2.4} fill={primary.icon === 'play'} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
