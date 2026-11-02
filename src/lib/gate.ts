import type { AuthPhase } from './auth'

export type GateScreen = 'loading' | 'setPassword' | 'install' | 'login' | 'waiting' | 'app'

/**
 * The first screen: a password to set (after an invite or reset link) comes
 * before anything else; then, on a phone in a browser tab, Install the app
 * (until installed or skipped); then sign in, waiting for approval, or the app.
 */
export function gateScreen(s: { phase: AuthPhase; setPassword: boolean; install: boolean }): GateScreen {
  if (s.phase === 'loading') return 'loading'
  if (s.setPassword && s.phase !== 'signedOut') return 'setPassword'
  if (s.install) return 'install'
  if (s.phase === 'signedOut') return 'login'
  if (s.phase === 'pending' || s.phase === 'rejected') return 'waiting'
  return 'app'
}
