import { editingCount, onEditingIdle } from './editing'

// ---------------------------------------------------------------------------
// New versions of the app. The service worker downloads them in the
// background; switching to the new version (which reloads the page) happens
// only when no form is open — not even when the app is in the background,
// because taking a photo or switching to WhatsApp hides a page whose form is
// still open. Registered here with workbox-window (not vite-plugin-pwa's
// helper, which reloads every window as soon as any one switches).
// ---------------------------------------------------------------------------

/** Switch to a waiting new version now? Only with no form open. */
export function shouldApplyUpdate(s: { editing: number; hidden: boolean }): boolean {
  return s.editing === 0
}

const HOUR = 60 * 60 * 1000

/** Register the service worker and handle updates (call once at start). */
export async function startAppUpdates(onReady: (apply: () => void) => void): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const { Workbox } = await import('workbox-window')
  const wb = new Workbox('./sw.js', { scope: './' })
  let waiting = false
  let reloadWhenFree = false
  const apply = () => void wb.messageSkipWaiting()
  const free = () => shouldApplyUpdate({ editing: editingCount(), hidden: document.visibilityState === 'hidden' })

  // A new version is downloaded and waiting.
  wb.addEventListener('waiting', () => {
    waiting = true
    if (free()) apply()
    else onReady(apply)
  })
  // The new version took over (from this window or another): reload — later if a form is open.
  wb.addEventListener('controlling', (e) => {
    if (!e.isUpdate) return
    waiting = false
    if (free()) window.location.reload()
    else reloadWhenFree = true
  })
  // The last form closed: now is the moment.
  onEditingIdle(() => {
    if (reloadWhenFree) window.location.reload()
    else if (waiting) apply()
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
