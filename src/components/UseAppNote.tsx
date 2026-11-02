import { useState } from 'react'
import Icon from './Icon'
import InstallSheet from './InstallSheet'
import { useInstallState } from '../lib/installPrompt'
import { useOnboardingFlags } from '../lib/onboarding'

const KEY = 'ww.useAppNote'
const WEEK = 7 * 24 * 60 * 60 * 1000
const hiddenUntil = (): number => {
  try {
    return Number(localStorage.getItem(KEY) ?? 0)
  } catch {
    return 0
  }
}

/** A phone using the browser after "Continue in browser": a slim note to install, hidden for a week when closed. */
export default function UseAppNote() {
  const st = useInstallState()
  const flags = useOnboardingFlags()
  const [closed, setClosed] = useState(() => hiddenUntil() > Date.now())
  const [open, setOpen] = useState(false)
  // While Get started is on Home its first step already offers the install: one offer at a time.
  if (closed || !flags.hidden || st.installed || st.platform.device === 'desktop' || !st.skipped) return null
  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + WEEK))
    } catch {
      // private mode: closes until the app reloads
    }
    setClosed(true)
  }
  return (
    <div className="use-app-note" role="note">
      <Icon name="download" size={20} />
      <button className="use-app-text" onClick={() => setOpen(true)}>
        <b>Use the installed app</b>
        <span>Full screen, works without signal</span>
      </button>
      <button className="icon-btn" aria-label="Close" onClick={close}>
        <Icon name="x" size={18} />
      </button>
      {open && <InstallSheet onClose={() => setOpen(false)} />}
    </div>
  )
}
