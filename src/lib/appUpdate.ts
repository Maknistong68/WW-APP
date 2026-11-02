import { editingCount } from './editing'

// ---------------------------------------------------------------------------
// New versions of the app. The service worker downloads them in the
// background; the switch (a page reload) waits until no form is open, or
// until the app goes to the background, so an update never wipes a form.
// ---------------------------------------------------------------------------

/** Apply a waiting update now? */
export function shouldApplyUpdate(s: { editing: number; hidden: boolean }): boolean {
  return s.hidden || s.editing === 0
}

const HOUR = 60 * 60 * 1000

/** Register the service worker and watch for updates (call once at start). */
export async function startAppUpdates(onReady: (apply: () => void) => void): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const { registerSW } = await import('virtual:pwa-register')
  let waiting = false
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true
      const apply = () => void updateSW(true)
      if (shouldApplyUpdate({ editing: editingCount(), hidden: document.visibilityState === 'hidden' })) apply()
      else onReady(apply)
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => {
        if (navigator.onLine) void reg.update().catch(() => {})
      }
      window.setInterval(check, HOUR)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
  // Leaving the app is a safe moment to switch to the new version.
  document.addEventListener('visibilitychange', () => {
    if (waiting && document.visibilityState === 'hidden') void updateSW(true)
  })
}
