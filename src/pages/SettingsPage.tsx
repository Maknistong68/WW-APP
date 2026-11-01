import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { saveAs } from 'file-saver'
import { createBackup, db, restoreBackup } from '../db'
import {
  getClient,
  getSyncConfig,
  lastSyncAt,
  setSyncConfig,
  syncNow,
  usingBuiltInConfig,
} from '../lib/sync'
import Icon from '../components/Icon'
import { MENU_HUE } from '../lib/hues'
import Page from '../components/Page'
import { useThemeMode } from '../lib/theme'
import PasswordInput from '../components/PasswordInput'
import { RECOVERY_KEY, authErrorText, sendPasswordReset, signInWithPassword, signUpWithPassword } from '../lib/auth'
import { showToast } from '../components/Toast'
import { canInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/installPrompt'


const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [themeMode, setThemeMode] = useThemeMode()
  const [config, setConfig] = useState(getSyncConfig())
  const [url, setUrl] = useState(config?.url ?? '')
  const [anonKey, setAnonKey] = useState(config?.anonKey ?? '')
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [recovering, setRecovering] = useState(() => localStorage.getItem(RECOVERY_KEY) === '1')
  const [busy, setBusy] = useState(false)
  const [lastSync, setLastSync] = useState(lastSyncAt())
  const [installable, setInstallable] = useState(canInstall())

  const restoreRef = useRef<HTMLInputElement>(null)
  const activityCount = useLiveQuery(() => db.activity.count())

  const doBackup = async () => {
    setBusy(true)
    try {
      const { blob, fileName } = await createBackup()
      saveAs(blob, fileName)
      showToast({ text: `Backup saved: ${fileName}. Keep it in Drive or email.`, duration: 6000 })
    } catch (err) {
      showToast({ text: `Backup failed: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setBusy(false)
    }
  }

  const doRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const r = await restoreBackup(file)
      showToast({ text: `Restored ${r.inspections} audits, ${r.photos} photos, ${r.records} records` })
    } catch (err) {
      showToast({ text: `Restore failed: ${err instanceof Error ? err.message : String(err)}`, duration: 7000 })
    } finally {
      setBusy(false)
    }
  }

  const logs = useLiveQuery(() => db.logs.orderBy('time').reverse().limit(100).toArray())

  useEffect(() => onInstallChange(() => setInstallable(canInstall())), [])

  useEffect(() => {
    const msg = sessionStorage.getItem('ww.authLinkError')
    if (msg) {
      sessionStorage.removeItem('ww.authLinkError')
      // after the toast host has mounted
      setTimeout(() => showToast({ text: msg, duration: 9000 }), 300)
    }
  }, [])

  const doInstall = () => {
    void promptInstall().then((accepted) => {
      if (accepted) showToast({ text: 'App installed — find it on your home screen' })
    })
  }

  useEffect(() => {
    let unsub: (() => void) | undefined
    void getClient().then((c) => {
      if (!c) return
      void c.auth.getSession().then(({ data }) => setSession(data.session))
      const { data: sub } = c.auth.onAuthStateChange((e, s) => {
        setSession(s)
        if (e === 'PASSWORD_RECOVERY') setRecovering(true)
      })
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
    setConfig(getSyncConfig())
    setSession(null)
    showToast({ text: 'Cloud sync disconnected. Your local data is untouched.' })
  }

  const authError = authErrorText

  const forgotPassword = async () => {
    const c = await getClient()
    if (!c) return
    if (!email.trim()) return showToast({ text: 'Type your email first, then tap Forgot password' })
    setBusy(true)
    try {
      await sendPasswordReset(c, email)
      showToast({ text: 'Reset link sent — open it on this phone to set a new password.', duration: 9000 })
    } catch (err) {
      showToast({ text: authError(err), duration: 8000 })
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async () => {
    const c = await getClient()
    if (!c) return
    const pw = newPassword.trim()
    if (pw.length < 8) return showToast({ text: 'Use at least 8 characters' })
    if (pw !== newPassword2.trim()) return showToast({ text: 'The two passwords are different' })
    setBusy(true)
    try {
      const { error } = await c.auth.updateUser({ password: pw })
      if (error) throw error
      localStorage.removeItem(RECOVERY_KEY)
      setRecovering(false)
      setNewPassword('')
      setNewPassword2('')
      showToast({ text: 'Password changed. Use the new one next time you sign in.', duration: 6000 })
    } catch (err) {
      showToast({ text: authError(err), duration: 8000 })
    } finally {
      setBusy(false)
    }
  }

  const signIn = async (create: boolean) => {
    const c = await getClient()
    if (!c) return
    setBusy(true)
    try {
      if (create) {
        await signUpWithPassword(c, email, password)
        showToast({
          text: 'Account created. If Supabase asks for email confirmation, tap the link in your inbox, then sign in.',
          duration: 9000,
        })
      } else {
        await signInWithPassword(c, email, password)
        showToast({ text: 'Signed in' })
      }
    } catch (err) {
      showToast({ text: authError(err), duration: 8000 })
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
            up + down + r.deleted + r.records === 0
              ? 'Already up to date'
              : `Synced: ${up} sent, ${down} received${r.records ? `, ${r.records} records` : ''}${
                  r.deleted ? `, ${r.deleted} removed` : ''
                }`,
        })
      }
    } catch (err) {
      showToast({ text: `Sync failed: ${err instanceof Error ? err.message : String(err)}`, duration: 8000 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Settings" back="/library" backLabel="Library">
        <div className="section-label">Appearance</div>
        <div className="segmented" role="radiogroup" aria-label="Appearance">
          {(
            [
              ['auto', 'Auto'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="radio" aria-checked={themeMode === key} className={themeMode === key ? 'on' : ''} onClick={() => setThemeMode(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="list-foot" style={{ marginTop: -8 }}>Auto follows your phone. Light is easiest to read in the sun.</div>
        <div className="section-label">Your data</div>
        <div className="list">
          <button className="row" onClick={() => navigate('/settings/log')}>
            <span className={`row-icon h-${MENU_HUE.activity}`}>
              <Icon name="activity" size={20} fill />
            </span>
            <span className="row-main">Activity log</span>
            <span className="row-trail">{activityCount ?? ''}</span>
            <span className="row-chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </button>
          <button className="row" disabled={busy} onClick={() => void doBackup()}>
            <span className={`row-icon h-${MENU_HUE.backup}`}>
              <Icon name="download" size={20} fill />
            </span>
            <span className="row-main">Save backup file</span>
          </button>
          <button className="row" disabled={busy} onClick={() => restoreRef.current?.click()}>
            <span className={`row-icon h-${MENU_HUE.restore}`}>
              <Icon name="upload" size={20} fill />
            </span>
            <span className="row-main">Restore backup file</span>
          </button>
        </div>
        <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={doRestore} />
        <div className="list-foot">Backup = everything: audits, photos, tickets, contractors, KPIs, log.</div>

        <div className="section-label">App</div>
        <div className="card">
          {isStandalone() ? (
            <p className="note" style={{ margin: 0 }}>
              ✓ Installed — you're using the app from your home screen.
            </p>
          ) : installable ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Install the app on this device: it opens full-screen from your home screen and works
                fully offline.
              </p>
              <button className="btn primary block" onClick={doInstall}>
                Install app
              </button>
            </>
          ) : (
            <p className="note" style={{ margin: 0 }}>
              {isIos()
                ? 'To install on iPhone/iPad: open this page in Safari, tap Share, then "Add to Home Screen".'
                : 'To install: open your browser menu and choose "Install app" (or "Add to home screen").'}
            </p>
          )}
        </div>

        <div className="section-label">Cloud sync (Supabase)</div>
        <div className="card">
          {!config ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Optional: back up and sync everything (audits, tickets, contractors, KPIs, activity log) to your own free Supabase database, so
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
                {usingBuiltInConfig()
                  ? 'Your cloud is ready. Sign in — or create your account the first time — to start syncing.'
                  : <>Project connected: <b>{config.url.replace('https://', '')}</b>. Sign in (or create your account) to start syncing.</>}
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
                <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
              </div>
              <div className="btn-row">
                <button className="btn primary" disabled={busy || !email || !password} onClick={() => void signIn(false)}>
                  Sign in
                </button>
                <button className="btn" disabled={busy || !email || !password} onClick={() => void signIn(true)}>
                  Create account
                </button>
              </div>
              <button className="details-toggle" disabled={busy} onClick={() => void forgotPassword()}>
                Forgot password? Email me a reset link
              </button>
              {!usingBuiltInConfig() && (
                <button className="details-toggle" onClick={() => void disconnect()}>
                  Disconnect this project
                </button>
              )}
            </>
          ) : (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Signed in as <b>{session.user.email}</b>
                {lastSync ? ` · last sync ${fmtTime(lastSync)}` : ' · never synced yet'}. The app also syncs
                automatically when you open it with internet.
              </p>
              <button className="btn primary block" disabled={busy} onClick={() => void doSync()}>
                <Icon name="refresh" size={19} /> {busy ? 'Syncing…' : 'Sync now'}
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
                {!usingBuiltInConfig() && (
                  <button className="btn" disabled={busy} onClick={() => void disconnect()}>
                    Disconnect
                  </button>
                )}
              </div>
              <div className="section-label" style={{ marginLeft: 0 }}>
                {recovering ? 'Set a new password' : 'Change password'}
              </div>
              <div className="field">
                <label>New password</label>
                <PasswordInput value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
              </div>
              <div className="field">
                <label>Repeat new password</label>
                <PasswordInput value={newPassword2} onChange={setNewPassword2} autoComplete="new-password" />
              </div>
              <button
                className={`btn block${recovering ? ' primary' : ''}`}
                disabled={busy || !newPassword}
                onClick={() => void changePassword()}
              >
                Save new password
              </button>
            </>
          )}
        </div>

        <div className="section-label">Sync &amp; system log</div>
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

            </>
          )}
        </div>
    </Page>
  )
}
