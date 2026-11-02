import { useId, useState, type FormEvent, type ReactNode } from 'react'
import PasswordInput from '../components/PasswordInput'
import { sendPasswordReset, setNewPassword, signInWithLogin, signUpWithPassword } from '../lib/auth'
import { authProblemText, emailProblem, nameProblem, normUsername, parseLogin, passwordProblem, signUpProblem, usernameProblem } from '../lib/authForm'
import { getClient } from '../lib/sync'
import { APP_NAME } from '../lib/appInfo'

// ---------------------------------------------------------------------------
// The way in: Sign in · Create account · Forgot password · Check your email,
// then Set password (after an invite or reset link) and Waiting (for the
// admin). One task per screen, the button low for the thumb, errors under
// the field they belong to.
// ---------------------------------------------------------------------------

type Screen = 'signIn' | 'signUp' | 'forgot' | 'sent'

/** The shared frame: app icon, name and one line, then the card. */
function Frame({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <main className="login">
      <div className="login-brand">
        <img src="./favicon.svg" alt="" width={56} height={56} />
        <span>{APP_NAME}</span>
      </div>
      <div className="login-card">
        <h1 className="login-title">{title}</h1>
        {sub && <p className="login-sub">{sub}</p>}
        {children}
      </div>
    </main>
  )
}

/** A labelled field with its own error line (shown after leaving the field). */
function Field({ label, error, hint, children, id }: { label: string; error?: string | null; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <div className="field-error" id={`${id}-err`}>
          {error}
        </div>
      ) : hint ? (
        <div className="field-hint">{hint}</div>
      ) : null}
    </div>
  )
}

function Alert({ text }: { text: string }) {
  return text ? (
    <div className="login-alert" role="alert">
      {text}
    </div>
  ) : null
}

/** First screen when signed out. `linkError`: why an email link didn't work. */
export default function LoginPage({ onDone, linkError = '' }: { onDone: () => void; linkError?: string }) {
  const [screen, setScreen] = useState<Screen>('signIn')
  const [sentTo, setSentTo] = useState({ email: '', why: '' as 'signup' | 'reset' | '' })
  if (screen === 'sent')
    return (
      <Frame title="Check your email" sub={`We sent a link to ${sentTo.email}.`}>
        <p className="login-note" style={{ marginTop: 4 }}>
          {sentTo.why === 'signup'
            ? 'Open it to confirm your email, then sign in. The admin approves new accounts.'
            : 'Open it on this phone to set a new password.'}
        </p>
        <button type="button" className="btn primary block" onClick={() => setScreen('signIn')}>
          Back to sign in
        </button>
      </Frame>
    )
  if (screen === 'signUp') return <SignUp onDone={onDone} onSent={(email) => (setSentTo({ email, why: 'signup' }), setScreen('sent'))} onBack={() => setScreen('signIn')} />
  if (screen === 'forgot') return <Forgot onSent={(email) => (setSentTo({ email, why: 'reset' }), setScreen('sent'))} onBack={() => setScreen('signIn')} />
  return <SignIn onDone={onDone} linkError={linkError} onForgot={() => setScreen('forgot')} onSignUp={() => setScreen('signUp')} />
}

function SignIn({ onDone, linkError, onForgot, onSignUp }: { onDone: () => void; linkError: string; onForgot: () => void; onSignUp: () => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState<{ login?: boolean; password?: boolean }>({})
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(linkError)
  const loginId = useId()
  const pwId = useId()
  const loginErr = touched.login && !login.trim() ? 'Type your username or email' : null
  const pwErr = touched.password && !password ? 'Type your password' : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched({ login: true, password: true })
    if (!login.trim() || !password) return
    setBusy(true)
    setProblem('')
    try {
      const c = await getClient()
      if (!c) throw new Error('Cloud sync is not set up')
      await signInWithLogin(c, login, password)
      onDone()
    } catch (err) {
      setProblem(authProblemText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame title="Sign in" sub="Worker Welfare · tickets, KPIs, camps">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Alert text={problem} />
        <Field label="Username or email" id={loginId} error={loginErr}>
          <input
            id={loginId}
            value={login}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={!!loginErr}
            onBlur={() => setTouched((t) => ({ ...t, login: true }))}
            onChange={(e) => setLogin(e.target.value)}
          />
        </Field>
        <Field label="Password" id={pwId} error={pwErr}>
          <PasswordInput
            id={pwId}
            value={password}
            onChange={setPassword}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            autoComplete="current-password"
            enterKeyHint="go"
          />
        </Field>
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <button type="button" className="login-link" onClick={onForgot}>
        Forgot password?
      </button>
      <div className="login-switch">
        New here?{' '}
        <button type="button" className="login-link inline" onClick={onSignUp}>
          Create an account
        </button>
      </div>
    </Frame>
  )
}

function SignUp({ onDone, onSent, onBack }: { onDone: () => void; onSent: (email: string) => void; onBack: () => void }) {
  const [f, setF] = useState({ name: '', username: '', email: '', password: '' })
  const [touched, setTouched] = useState<Partial<Record<keyof typeof f, boolean>>>({})
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const ids = { name: useId(), username: useId(), email: useId(), password: useId() }
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const blur = (k: keyof typeof f) => () => setTouched((t) => ({ ...t, [k]: true }))
  const err = {
    name: touched.name ? nameProblem(f.name) : null,
    username: touched.username ? usernameProblem(f.username) : null,
    email: touched.email ? emailProblem(f.email) : null,
    password: touched.password ? passwordProblem(f.password) : null,
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, username: true, email: true, password: true })
    if (signUpProblem(f)) return
    setBusy(true)
    setProblem('')
    try {
      const c = await getClient()
      if (!c) throw new Error('Cloud sync is not set up')
      const signedIn = await signUpWithPassword(c, f.email, f.password, { username: normUsername(f.username), fullName: f.name })
      if (signedIn) onDone()
      else onSent(f.email.trim())
    } catch (er) {
      setProblem(authProblemText(er))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame title="Create account" sub="The admin approves new accounts.">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Alert text={problem} />
        <Field label="Your name" id={ids.name} error={err.name}>
          <input id={ids.name} value={f.name} autoComplete="name" enterKeyHint="next" onBlur={blur('name')} onChange={(e) => set('name')(e.target.value)} />
        </Field>
        <Field label="Username" id={ids.username} error={err.username} hint="You can sign in with it. Letters and numbers.">
          <input
            id={ids.username}
            value={f.username}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            onBlur={blur('username')}
            onChange={(e) => set('username')(e.target.value)}
          />
        </Field>
        <Field label="Email" id={ids.email} error={err.email}>
          <input
            id={ids.email}
            type="email"
            inputMode="email"
            value={f.email}
            autoComplete="email"
            autoCapitalize="none"
            enterKeyHint="next"
            onBlur={blur('email')}
            onChange={(e) => set('email')(e.target.value)}
          />
        </Field>
        <Field label="Password" id={ids.password} error={err.password} hint="8 or more characters.">
          <PasswordInput id={ids.password} value={f.password} onChange={set('password')} onBlur={blur('password')} autoComplete="new-password" enterKeyHint="go" />
        </Field>
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <div className="login-switch">
        Have an account?{' '}
        <button type="button" className="login-link inline" onClick={onBack}>
          Sign in
        </button>
      </div>
    </Frame>
  )
}

function Forgot({ onSent, onBack }: { onSent: (email: string) => void; onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const id = useId()
  const err = touched ? emailProblem(email) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (emailProblem(email) || parseLogin(email).kind !== 'email') return
    setBusy(true)
    setProblem('')
    try {
      const c = await getClient()
      if (!c) throw new Error('Cloud sync is not set up')
      await sendPasswordReset(c, email)
      onSent(email.trim())
    } catch (er) {
      setProblem(authProblemText(er))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame title="Forgot password" sub="We’ll email you a link to set a new one.">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Alert text={problem} />
        <Field label="Email" id={id} error={err}>
          <input
            id={id}
            type="email"
            inputMode="email"
            value={email}
            autoComplete="email"
            autoCapitalize="none"
            enterKeyHint="send"
            onBlur={() => setTouched(true)}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Sending…' : 'Send link'}
        </button>
      </form>
      <button type="button" className="login-link" onClick={onBack}>
        Back to sign in
      </button>
    </Frame>
  )
}

/** After an invite or a reset link: choose the password, then the app opens. */
export function SetPasswordPage({ name, invited, onDone, onSignOut }: { name: string; invited: boolean; onDone: () => void; onSignOut: () => void }) {
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const id = useId()
  const err = touched ? passwordProblem(password) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (passwordProblem(password)) return
    setBusy(true)
    setProblem('')
    try {
      const c = await getClient()
      if (!c) throw new Error('Cloud sync is not set up')
      await setNewPassword(c, password)
      onDone()
    } catch (er) {
      setProblem(authProblemText(er))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame title={name ? `Welcome, ${name}` : 'Welcome'} sub={invited ? 'Choose a password to finish your account.' : 'Choose a new password.'}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Alert text={problem} />
        <Field label="New password" id={id} error={err} hint="8 or more characters.">
          <PasswordInput id={id} value={password} onChange={setPassword} onBlur={() => setTouched(true)} autoComplete="new-password" enterKeyHint="done" />
        </Field>
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
      <button type="button" className="login-link" onClick={onSignOut}>
        Not you? Sign out
      </button>
    </Frame>
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
    <Frame
      title={rejected ? 'No access' : 'Waiting for approval'}
      sub={rejected ? `${email} does not have access. Ask the admin.` : `${email} is signed in. The admin approves new accounts; then the team’s data opens here.`}
    >
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
    </Frame>
  )
}
