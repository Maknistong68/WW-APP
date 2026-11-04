// ---------------------------------------------------------------------------
// The app open twice on one phone (the installed app and a browser tab opened
// from an email link) shares one database; a copy left in the background can
// hold it and stop the other from saving. Each copy says hello on a channel;
// the copy that just opened hears the others answer and says so, once.
// ---------------------------------------------------------------------------

/** What to tell the person, from where this copy and the other one run. */
export function otherCopyText(meInstalled: boolean, otherInstalled: boolean): string {
  if (meInstalled && !otherInstalled) return 'WW Co-pilot is also open in a browser tab. Close that tab: two copies can stop saving.'
  if (!meInstalled && otherInstalled) return 'WW Co-pilot is also open as the installed app. Use the app and close this tab: two copies can stop saving.'
  return `WW Co-pilot is also open in another ${meInstalled ? 'window' : 'tab'}. Close one: two copies can stop saving.`
}

type Msg = { type: 'hello' | 'here'; id: string; installed: boolean; to?: string }

/** Start listening (once, at app start); `installed`: this copy runs as the installed app. `notify` gets the sentence when another copy answers. */
export function watchOtherCopies(installed: boolean, notify: (text: string) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const id = Math.random().toString(36).slice(2)
  const ch = new BroadcastChannel('ww-app')
  let told = false
  ch.onmessage = (e: MessageEvent<Msg>) => {
    const m = e.data
    if (!m || m.id === id) return
    // someone just opened: answer, so they know this copy is here
    if (m.type === 'hello') ch.postMessage({ type: 'here', id, installed, to: m.id } satisfies Msg)
    else if (m.type === 'here' && m.to === id && !told) {
      told = true
      notify(otherCopyText(installed, m.installed))
    }
  }
  ch.postMessage({ type: 'hello', id, installed } satisfies Msg)
  return () => ch.close()
}
