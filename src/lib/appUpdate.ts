import { editingCount, onEditingIdle } from './editing'

// ---------------------------------------------------------------------------
// New versions of the app. The service worker downloads them in the
// background. Switching to the new version reloads the page, so it happens
// only when nothing can be lost or interrupted: no form open (not even with
// the app in the background: taking a photo or switching to WhatsApp hides a
// page whose form is still open), and either the app was just opened or it is
// in the background. Otherwise an "Update ready · Reload" toast offers it.
// Registered here with workbox-window (not vite-plugin-pwa's helper, which
// reloads every window as soon as any one switches).
// ---------------------------------------------------------------------------

/** The first seconds after opening count as "just opened": nothing is being read yet. */
export const FRESH_MS = 8000

/** Switch to a waiting new version now? */
export function shouldApplyUpdate(s: { editing: number; hidden: boolean; fresh?: boolean }): boolean {
  return s.editing === 0 && (s.hidden || !!s.fresh)
}

const HOUR = 60 * 60 * 1000

/** Register the service worker and handle updates (call once at start). */
export async function startAppUpdates(onReady: (apply: () => void) => void): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const started = Date.now()
  const { Workbox } = await import('workbox-window')
  const wb = new Workbox('./sw.js', { scope: './' })
  let waiting = false
  let reloadWhenFree = false
  let offered = false
  const apply = () => void wb.messageSkipWaiting()
  const now = () => ({ editing: editingCount(), hidden: document.visibilityState === 'hidden', fresh: Date.now() - started < FRESH_MS })
  const offer = () => {
    if (offered) return
    offered = true
    onReady(() => (waiting ? apply() : window.location.reload()))
  }

  // A new version is downloaded and waiting.
  wb.addEventListener('waiting', () => {
    waiting = true
    if (shouldApplyUpdate(now())) apply()
    else offer()
  })
  // The new version took over (from this window or another): reload when safe.
  wb.addEventListener('controlling', (e) => {
    if (!e.isUpdate) return
    waiting = false
    if (shouldApplyUpdate(now())) window.location.reload()
    else {
      reloadWhenFree = true
      offer()
    }
  })
  const trySwitch = () => {
    if (!shouldApplyUpdate(now())) return
    if (reloadWhenFree) window.location.reload()
    else if (waiting) apply()
  }
  // The last form closed: switch only if the app is in the background (else the toast stays on offer).
  onEditingIdle(() => window.setTimeout(trySwitch, 1500))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') trySwitch()
  })

  const reg = await wb.register({ immediate: true }).catch(() => undefined)
  if (!reg) return
  const check = () => {
    if (navigator.onLine) void reg.update().catch(() => {})
  }
  window.setInterval(check, HOUR)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}
