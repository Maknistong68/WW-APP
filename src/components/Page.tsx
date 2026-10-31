import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { openSidebar } from './Sidebar'
import { useAuthInfo } from '../lib/auth'

/**
 * Screen frame: big title; the bar gets a hairline and a small title once you
 * scroll. Main screens show your avatar (opens the profile drawer), others a
 * round back button.
 */
export default function Page({
  title,
  back,
  backLabel = 'Back',
  actions,
  large = true,
  album = false,
  children,
}: {
  title: string
  /** Route to go back to, or '..' for browser history back. */
  back?: string
  backLabel?: string
  actions?: ReactNode
  large?: boolean
  /** Kept for old call sites (no effect). */
  section?: string
  /** Detail screen with its own big header in the body: no large title, bar still turns solid on scroll. */
  album?: boolean
  /** Kept for old call sites. */
  tabs?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const me = useAuthInfo()
  const sentinel = useRef<HTMLDivElement>(null)
  const watch = large || album
  const [compact, setCompact] = useState(!watch)

  useEffect(() => {
    if (!watch) return
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [watch])

  return (
    <div className="screen">
      <header className={`nav-bar${compact ? ' compact' : ''}`}>
        <div className="nav-side">
          {back ? (
            <button
              className="round-btn"
              onClick={() => (back === '..' ? navigate(-1) : navigate(back))}
              aria-label={`Back to ${backLabel}`}
            >
              <Icon name="chevron-left" size={22} strokeWidth={2.4} />
            </button>
          ) : (
            <button className="avatar-btn" aria-label="Open profile and menu" onClick={openSidebar}>
              {(me.email || 'W').slice(0, 1).toUpperCase()}
            </button>
          )}
        </div>
        <div className="nav-title">{title}</div>
        <div className="nav-side right">{actions}</div>
      </header>
      <main className="page">
        {large && !album && <h1 className="large-title">{title}</h1>}
        <div ref={sentinel} aria-hidden="true" />
        {children}
      </main>
    </div>
  )
}
