import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { openSidebar } from './Sidebar'

/**
 * iOS-style page: large title that collapses into a frosted nav bar on
 * scroll. `back` is the route to return to (with an optional label).
 */
export default function Page({
  title,
  back,
  backLabel = 'Back',
  actions,
  large = true,
  tabs = true,
  children,
}: {
  title: string
  /** Route to go back to, or '..' for browser history back. */
  back?: string
  backLabel?: string
  actions?: ReactNode
  large?: boolean
  /** Reserve space for the bottom tab bar. */
  tabs?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const sentinel = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(!large)

  useEffect(() => {
    if (!large) return
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), {
      rootMargin: '-60px 0px 0px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [large])

  return (
    <>
      <header className={`nav-bar${compact ? ' compact' : ''}`}>
        <div className="nav-side">
          {!back && (
            <button className="nav-btn" aria-label="Menu" onClick={openSidebar}>
              <Icon name="menu" size={26} />
            </button>
          )}
          {back && (
            <button className="nav-btn" onClick={() => (back === '..' ? navigate(-1) : navigate(back))} aria-label={`Back to ${backLabel}`}>
              <Icon name="chevron-left" size={24} strokeWidth={2.4} />
              {backLabel}
            </button>
          )}
        </div>
        <div className="nav-title">{title}</div>
        <div className="nav-side right">{actions}</div>
      </header>
      <main className={`page${tabs ? ' with-tabs' : ''}`}>
        {large && <h1 className="large-title">{title}</h1>}
        <div ref={sentinel} aria-hidden="true" />
        {children}
      </main>
    </>
  )
}

/** Gear button that opens Settings (top-right of each tab). */
export function SettingsButton() {
  const navigate = useNavigate()
  return (
    <button className="nav-btn" onClick={() => navigate('/settings')} aria-label="Settings">
      <Icon name="settings" size={24} />
    </button>
  )
}
