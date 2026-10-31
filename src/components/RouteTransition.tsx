import { useRef, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const TABS = ['/', '/tickets', '/dashboard', '/library']

/**
 * Screen change motion: forward slides in a little from the right, back from
 * the left, switching tabs just fades. 200ms ease-out, transform/opacity only;
 * reduced-motion turns it off in CSS.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const nav = useNavigationType()
  const prev = useRef(pathname)
  const kind = useRef<'fwd' | 'back' | 'fade'>('fade')
  if (prev.current !== pathname) {
    kind.current = TABS.includes(pathname) && TABS.includes(prev.current) ? 'fade' : nav === 'POP' ? 'back' : 'fwd'
    prev.current = pathname
  }
  return (
    <div key={pathname} className={`route ${kind.current}`}>
      {children}
    </div>
  )
}
