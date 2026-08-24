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
  notify()
})

/** True when the browser has offered installability and we can prompt. */
export const canInstall = (): boolean => deferred !== null

/** Already running as an installed app (home screen / desktop window)? */
export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true

/** iOS Safari never fires beforeinstallprompt — install is manual there. */
export const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent)

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
