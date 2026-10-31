import { useState, type FormEvent } from 'react'
import PasswordInput from '../components/PasswordInput'
import { showToast } from '../components/Toast'
import { authErrorText, sendPasswordReset, signInWithPassword, signUpWithPassword } from '../lib/auth'
import { getClient } from '../lib/sync'

/** First screen: sign in, create an account (needs approval), or reset the password. */
export default function LoginPage({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      showToast({ text: authErrorText(err), duration: 8000 })
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const c = await getClient()
      if (!c) return
      if (mode === 'in') {
        await signInWithPassword(c, email, password)
      } else {
        if (password.trim().length < 8) throw new Error('Use at least 8 characters for the password')
        await signUpWithPassword(c, email, password)
        showToast({ text: 'Account created. Confirm your email, then sign in — the admin approves new accounts.', duration: 10000 })
        setMode('in')
      }
      onDone()
    })
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <h1 className="login-title">WW Co-pilot</h1>
        <p className="login-sub">Worker Welfare · tickets, KPIs, camps</p>

        <div className="segmented" style={{ margin: '18px 0 14px' }}>
          <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>
            Sign in
          </button>
          <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>
            Create account
          </button>
        </div>

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            autoComplete="email"
            autoCapitalize="none"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          />
        </div>
        <button className="btn primary block" disabled={busy || !email || !password}>
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        {mode === 'in' && (
          <button
            type="button"
            className="details-toggle"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const c = await getClient()
                if (!c) return
                await sendPasswordReset(c, email)
                showToast({ text: 'Reset link sent — open it on this phone.', duration: 8000 })
              })
            }
          >
            Forgot password?
          </button>
        )}
        {mode === 'up' && <p className="login-note">New accounts can use the app once the admin approves them.</p>}
      </form>
    </main>
  )
}

/** Signed in, but not approved (yet). */
export function WaitingPage({
  email,
  rejected,
  onRefresh,
  onSignOut,
}: {
  email: string
  rejected: boolean
  onRefresh: () => void
  onSignOut: () => void
}) {
  return (
    <main className="login">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h1 className="login-title">{rejected ? 'No access' : 'Waiting for approval'}</h1>
        <p className="login-sub">
          {rejected
            ? `${email} does not have access. Ask the admin.`
            : `${email} is signed in. The admin has to approve this account before you can see the data.`}
        </p>
        <div className="btn-row">
          <button className="btn" onClick={onSignOut}>
            Sign out
          </button>
          {!rejected && (
            <button className="btn primary" onClick={onRefresh}>
              Check again
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
