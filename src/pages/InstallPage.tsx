import { useState } from 'react'
import { Frame } from './LoginPage'
import Icon from '../components/Icon'
import { showToast } from '../components/Toast'
import { promptInstall, skipInstall, useInstallState } from '../lib/installPrompt'
import { installPlan } from '../lib/platform'
import { copyText } from '../lib/clipboard'

/**
 * Install the app (first screen on a phone or tablet in a browser tab). The
 * browser's own Install button where there is one, otherwise short steps for
 * this exact browser; in an app's built-in browser, how to open a real one.
 * "Continue in browser" stays for phones that can't install.
 */
export default function InstallPage({ signInAs, linkError = '' }: { signInAs?: string; linkError?: string }) {
  const st = useInstallState()
  const again = signInAs ? ` Sign in there as ${signInAs}.` : ''

  if (st.justInstalled) {
    return (
      <Frame title="Installed" sub={`Open WW Co-pilot from your home screen.${again}`}>
        <div className="install-done">
          <Icon name="check-circle" size={48} />
        </div>
        <button type="button" className="login-link" onClick={() => skipInstall()}>
          Keep using the browser
        </button>
      </Frame>
    )
  }

  return (
    <Frame title="Install the app" sub="It opens full screen, works without signal and keeps your data on this phone.">
      {linkError && (
        <div className="login-alert" role="alert">
          {linkError}
        </div>
      )}
      <InstallSteps signInAs={signInAs} />
      <button type="button" className="login-link" onClick={() => skipInstall()}>
        Continue in browser
      </button>
    </Frame>
  )
}

/** The Install button or this browser's steps (the install screen and the Get started panel). */
export function InstallSteps({ signInAs }: { signInAs?: string }) {
  const st = useInstallState()
  const plan = installPlan(st.platform, { canPrompt: st.canPrompt, installed: st.installed })
  const [busy, setBusy] = useState(false)
  const ios = st.platform.os === 'ios'
  const copyLink = () =>
    void copyText(window.location.origin + window.location.pathname).then((ok) =>
      showToast({ text: ok ? 'Link copied. Paste it in Chrome or Safari.' : 'Could not copy the link.' }),
    )

  if (st.justInstalled) return <p className="login-note">Installed. Open WW Co-pilot from your home screen.</p>
  if (plan.kind === 'none' || plan.kind === 'installed')
    return <p className="login-note">{plan.kind === 'installed' ? 'Already installed.' : 'Open the browser menu and choose “Install”, or keep using this window.'}</p>
  return (
    <>
      {plan.kind === 'prompt' && (
        <button
          className="btn primary block"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void promptInstall().finally(() => setBusy(false))
          }}
        >
          <Icon name="download" size={20} /> Install
        </button>
      )}
      {plan.kind === 'openInBrowser' && <p className="login-note" style={{ margin: '0 0 10px' }}>{plan.steps[0]}</p>}
      {(plan.kind === 'steps' || plan.kind === 'openInBrowser') && (
        <ol className="install-steps">
          {(plan.kind === 'openInBrowser' ? plan.steps.slice(1) : plan.steps).map((s, i) => (
            <li key={i}>
              <span className="install-num">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
      {plan.kind === 'openInBrowser' && (
        <button className="btn block" onClick={copyLink}>
          <Icon name="copy" size={18} /> Copy link
        </button>
      )}
      {ios && plan.kind !== 'openInBrowser' && (
        <p className="login-note">Then open WW Co-pilot from your home screen. It asks you to sign in once more.{signInAs ? ` Use ${signInAs}.` : ''}</p>
      )}
      {!ios && plan.kind !== 'openInBrowser' && signInAs && <p className="login-note">Then open it from your home screen and sign in as {signInAs}.</p>}
    </>
  )
}
