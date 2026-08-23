import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { db } from '../db'
import {
  getClient,
  getSyncConfig,
  lastSyncAt,
  setSyncConfig,
  syncNow,
} from '../lib/sync'
import { showToast } from '../components/Toast'

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [config, setConfig] = useState(getSyncConfig())
  const [url, setUrl] = useState(config?.url ?? '')
  const [anonKey, setAnonKey] = useState(config?.anonKey ?? '')
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastSync, setLastSync] = useState(lastSyncAt())

  const logs = useLiveQuery(() => db.logs.orderBy('time').reverse().limit(100).toArray())

  useEffect(() => {
    let unsub: (() => void) | undefined
    void getClient().then((c) => {
      if (!c) return
      void c.auth.getSession().then(({ data }) => setSession(data.session))
      const { data: sub } = c.auth.onAuthStateChange((_e, s) => setSession(s))
      unsub = () => sub.subscription.unsubscribe()
    })
    return () => unsub?.()
  }, [config])

  const saveConfig = () => {
    const cleanUrl = url.trim().replace(/\/+$/, '')
    if (!/^https:\/\/.+\.supabase\.co$/.test(cleanUrl)) {
      showToast({ text: 'The project URL should look like https://xxxx.supabase.co' })
      return
    }
    if (anonKey.trim().length < 20) {
      showToast({ text: 'Paste the full anon public key from Supabase → Settings → API' })
      return
    }
    setSyncConfig({ url: cleanUrl, anonKey: anonKey.trim() })
    setConfig(getSyncConfig())
    showToast({ text: 'Cloud project saved — now sign in below' })
  }

  const disconnect = async () => {
    await getClient()
      .then((c) => c?.auth.signOut())
      .catch(() => {})
    setSyncConfig(null)
    setConfig(null)
    setSession(null)
    showToast({ text: 'Cloud sync disconnected. Your local data is untouched.' })
  }

  const signIn = async (create: boolean) => {
    const c = await getClient()
    if (!c) return
    setBusy(true)
    try {
      if (create) {
        const { error } = await c.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        showToast({
          text: 'Account created. If Supabase asks for email confirmation, tap the link in your inbox, then sign in.',
          duration: 9000,
        })
      } else {
        const { error } = await c.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        showToast({ text: 'Signed in' })
      }
    } catch (err) {
      showToast({ text: err instanceof Error ? err.message : String(err), duration: 7000 })
    } finally {
      setBusy(false)
    }
  }

  const doSync = async () => {
    setBusy(true)
    try {
      const r = await syncNow()
      setLastSync(lastSyncAt())
      const up = r.pushed + r.photosUp
      const down = r.pulled + r.photosDown
      if (r.failed > 0) {
        showToast({
          text: `Synced with ${r.failed} error${r.failed === 1 ? '' : 's'} — see activity log`,
          duration: 8000,
        })
      } else {
        showToast({
          text:
            up + down + r.deleted === 0
              ? 'Already up to date'
              : `Synced: ${up} sent, ${down} received${r.deleted ? `, ${r.deleted} removed` : ''}`,
        })
      }
    } catch (err) {
      showToast({ text: `Sync failed: ${err instanceof Error ? err.message : String(err)}`, duration: 8000 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="app-header">
        <button className="back" onClick={() => navigate('/')} aria-label="Back">
          ‹
        </button>
        <h1>Settings</h1>
      </header>
      <main className="page">
        <div className="section-label">Cloud sync (Supabase)</div>
        <div className="card">
          {!config ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Optional: back up and sync your inspections to your own free Supabase database, so
                nothing is lost with the phone and you can work from any device. One-time setup: create a
                project at supabase.com, run <code>supabase/schema.sql</code> (in this app's repository) in
                its SQL Editor, then paste the project's URL and anon key here (Supabase → Settings → API).
              </p>
              <div className="field">
                <label>Project URL</label>
                <input
                  value={url}
                  placeholder="https://xxxx.supabase.co"
                  onChange={(e) => setUrl(e.target.value)}
                  autoCapitalize="none"
                />
              </div>
              <div className="field">
                <label>Anon public key</label>
                <input
                  value={anonKey}
                  placeholder="eyJ…"
                  onChange={(e) => setAnonKey(e.target.value)}
                  autoCapitalize="none"
                />
              </div>
              <button className="btn primary block" onClick={saveConfig}>
                Connect project
              </button>
            </>
          ) : !session ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Project connected: <b>{config.url.replace('https://', '')}</b>. Sign in (or create your
                account) to start syncing.
              </p>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="btn-row">
                <button className="btn primary" disabled={busy || !email || !password} onClick={() => void signIn(false)}>
                  Sign in
                </button>
                <button className="btn" disabled={busy || !email || !password} onClick={() => void signIn(true)}>
                  Create account
                </button>
              </div>
              <button className="details-toggle" onClick={() => void disconnect()}>
                Disconnect this project
              </button>
            </>
          ) : (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Signed in as <b>{session.user.email}</b>
                {lastSync ? ` · last sync ${fmtTime(lastSync)}` : ' · never synced yet'}. The app also syncs
                automatically when you open it with internet.
              </p>
              <button className="btn primary block" disabled={busy} onClick={() => void doSync()}>
                {busy ? 'Syncing…' : '⇅ Sync now'}
              </button>
              <div className="btn-row">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    void getClient()
                      .then((c) => c?.auth.signOut())
                      .then(() => showToast({ text: 'Signed out' }))
                  }
                >
                  Sign out
                </button>
                <button className="btn" disabled={busy} onClick={() => void disconnect()}>
                  Disconnect
                </button>
              </div>
            </>
          )}
        </div>

        <div className="section-label">Activity log</div>
        <div className="card" style={{ padding: 0 }}>
          {!logs || logs.length === 0 ? (
            <div className="empty">Nothing logged yet. Actions like edits, exports, backups and syncs appear here.</div>
          ) : (
            <>
              {logs.map((l) => (
                <div key={l.id} className="log-row">
                  <div className="log-time">{fmtTime(l.time)}</div>
                  <div>
                    <b>{l.event}</b>
                    {l.detail && <span className="log-detail"> — {l.detail}</span>}
                  </div>
                </div>
              ))}
              <button
                className="details-toggle"
                style={{ padding: '10px 16px' }}
                onClick={() => {
                  void db.logs.clear()
                  showToast({ text: 'Activity log cleared' })
                }}
              >
                Clear log
              </button>
            </>
          )}
        </div>
      </main>
    </>
  )
}
