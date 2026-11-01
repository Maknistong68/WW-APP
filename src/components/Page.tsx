import { useLayoutEffect, useRef, type ReactNode } from 'react'
import Icon from './Icon'
import { openSidebar } from './Sidebar'
import { useAuthInfo } from '../lib/auth'
import { reducedMotion } from '../lib/motion'
import { useGoBack } from '../lib/nav'
import { onScrollSettled, snapSuppressed, subscribeScrollY } from '../lib/scroll'

/**
 * Screen frame in One UI style: a slim top row (Back or your avatar, the
 * screen's buttons) with the big title under it. Scrolling tucks the title
 * into the top row, which turns blurred; stopping halfway snaps it open or
 * shut. Title, avatar and Back line up with the cards' edges.
 */
export default function Page({
  title,
  subtitle,
  back,
  backLabel = 'Back',
  actions,
  large = true,
  album = false,
  children,
}: {
  title: string
  /** Small line under the big title (date, count). */
  subtitle?: ReactNode
  /** Route to go back to, or '..' for browser history back. */
  back?: string
  backLabel?: string
  actions?: ReactNode
  large?: boolean
  /** Kept for old call sites (no effect). */
  section?: string
  /** Detail screen with its own big header in the body: no title area; the toolbar title fades in on scroll. */
  album?: boolean
  /** Kept for old call sites. */
  tabs?: boolean
  children: ReactNode
}) {
  const goBack = useGoBack()
  const me = useAuthInfo()
  const heroRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const expandable = large && !album

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const hero = heroRef.current
    let travel = 0
    let last = ''
    // The title area sits under the top row, so it is gone after scrolling its own height.
    const measure = () => {
      travel = hero ? hero.offsetHeight : 0
    }
    const update = (y: number) => {
      // 0 = big title showing … 1 = title tucked into the top row
      const p = expandable ? (travel ? Math.min(1, Math.max(0, y / travel)) : 1) : album ? Math.min(1, Math.max(0, (y - 40) / 40)) : 1
      // the bar turns solid as soon as anything slides under it
      const collapsed = y > 2
      const key = `${p.toFixed(3)}|${collapsed}`
      if (key === last) return
      last = key
      hero?.style.setProperty('--p', p.toFixed(3))
      bar.style.setProperty('--p', p.toFixed(3))
      bar.classList.toggle('collapsed', collapsed)
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' && hero ? new ResizeObserver(() => (measure(), update(window.scrollY))) : null
    if (ro && hero) ro.observe(hero)
    const offScroll = subscribeScrollY(update)
    // One UI snap: stopping halfway opens or collapses the title area.
    const offSettle = expandable
      ? onScrollSettled(() => {
          const y = window.scrollY
          if (!travel || y <= 0 || y >= travel || snapSuppressed()) return
          if (document.documentElement.scrollHeight - window.innerHeight < travel) return
          window.scrollTo({ top: y < travel / 2 ? 0 : travel, behavior: reducedMotion() ? 'auto' : 'smooth' })
        })
      : () => {}
    update(window.scrollY)
    return () => {
      offScroll()
      offSettle()
      ro?.disconnect()
    }
  }, [expandable, album])

  const avatar = (
    <button className="avatar-btn" aria-label="Open profile and menu" onClick={openSidebar}>
      {(me.email || 'W').slice(0, 1).toUpperCase()}
    </button>
  )

  return (
    <div className={`screen${expandable ? ' has-hero' : ''}${back ? ' detail' : ''}`}>
      <header className="nav-bar" ref={barRef}>
        {back && (
          <button className="round-btn lead" onClick={() => goBack(back)} aria-label={`Back to ${backLabel}`}>
            <Icon name="chevron-left" size={24} strokeWidth={2.4} />
          </button>
        )}
        <div className="nav-title" aria-hidden={expandable || undefined}>
          {title}
        </div>
        <div className="nav-side right">{actions}</div>
        {!back && avatar}
      </header>
      {expandable && (
        <div className="appbar-hero" ref={heroRef}>
          <h1 className="large-title">{title}</h1>
          {subtitle && <p className="large-sub">{subtitle}</p>}
        </div>
      )}
      <main className="page">{children}</main>
    </div>
  )
}
