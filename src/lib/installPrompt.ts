import { useSyncExternalStore } from 'react'
import { detectPlatform, shouldOfferInstall, type Platform } from './platform'

// Captures the browser's install prompt so the app can offer an explicit
// "Install app" button. Must be imported at startup (main.tsx): the
// beforeinstallprompt event often fires before any page mounts.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((f) => f())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  deferred = null
  justInstalled = true
  notify()
})

/** True when the browser has offered installability and we can prompt. */
export const canInstall = (): boolean => deferred !== null

/** Already running as an installed app (home screen / app window)? */
export const isStandalone = (): boolean =>
  ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches) ||
  (navigator as { standalone?: boolean }).standalone === true

/** This phone and browser (src/lib/platform.ts). */
export const currentPlatform = (): Platform => detectPlatform({ ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 })

/** iPhone or iPad (iPadOS says "Mac"): no install button there, only Share → Add to Home Screen. */
export const isIos = (): boolean => currentPlatform().os === 'ios'

let justInstalled = false
const SKIP_KEY = 'ww.installSkip'
const skipped = (): boolean => {
  try {
    return localStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}
/** "Continue in browser": the install screen stops coming first (Home still offers it). */
export function skipInstall(on = true): void {
  try {
    if (on) localStorage.setItem(SKIP_KEY, '1')
    else localStorage.removeItem(SKIP_KEY)
  } catch {
    // private mode: asks again next time
  }
  notify()
}

export interface InstallState {
  platform: Platform
  installed: boolean
  /** Installed from this tab just now (open it from the home screen). */
  justInstalled: boolean
  canPrompt: boolean
  skipped: boolean
  /** Install first: a phone or tablet in a browser tab that hasn't installed or skipped. */
  offerFirst: boolean
}

let snapshot: InstallState | null = null
function readState(): InstallState {
  const platform = currentPlatform()
  const installed = isStandalone()
  const st = { platform, installed, justInstalled, canPrompt: canInstall(), skipped: skipped() }
  const next = { ...st, offerFirst: shouldOfferInstall(platform, st) && !justInstalled }
  if (snapshot && JSON.stringify(snapshot) === JSON.stringify(next)) return snapshot
  snapshot = next
  return next
}
const subscribe = (f: () => void) => onInstallChange(f)
/** Everything the install screens need, kept up to date. */
export const useInstallState = (): InstallState => useSyncExternalStore(subscribe, readState)

/** Show the browser install dialog. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const evt = deferred
  await evt.prompt()
  const { outcome } = await evt.userChoice
  if (outcome === 'accepted') deferred = null
  notify()
  return outcome === 'accepted'
}

/** Re-render hook for UI: fires when installability changes. */
export function onInstallChange(f: () => void): () => void {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}
