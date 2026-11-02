import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import InstallSheet from './InstallSheet'
import { useAuthInfo } from '../lib/auth'
import { useInstallState, skipInstall } from '../lib/installPrompt'
import { hideGetStarted, onboardingSteps, useOnboardingFlags } from '../lib/onboarding'
import { lastSyncAt } from '../lib/sync'
import { useTeam } from '../lib/team'
import { haptic } from '../lib/haptics'

/**
 * Home's "Get started" card: the first steps for this person, checked against
 * what they have really done, with the next one's button. It goes away when
 * everything is done, or with Hide (Settings brings it back).
 */
export default function GetStarted() {
  const me = useAuthInfo()
  const install = useInstallState()
  const flags = useOnboardingFlags()
  const team = useTeam()
  const navigate = useNavigate()
  const [installing, setInstalling] = useState(false)
  const cloud = !!me.userId
  const r = onboardingSteps({
    role: me.role,
    cloud,
    mobile: install.platform.device !== 'desktop',
    installed: install.installed,
    hasName: !!me.fullName,
    // a first sync done is enough: a brand-new team may have no tickets yet
    synced: !!lastSyncAt(),
    seen: flags.seen,
    teamSize: team.length,
  })
  if (flags.hidden || r.allDone) return null
  const next = r.next!

  const go = () => {
    haptic('tick')
    if ('install' in next.action) setInstalling(true)
    else navigate(next.action.to)
  }

  return (
    <section className="getstarted" aria-label="Get started">
      <div className="gs-head">
        <b>Get started</b>
        <span className="gs-count">
          {r.doneCount} of {r.steps.length}
        </span>
        <button className="gs-hide" onClick={() => hideGetStarted(true)}>
          Hide
        </button>
      </div>
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={r.steps.length} aria-valuenow={r.doneCount}>
        <div style={{ transform: `scaleX(${r.doneCount / r.steps.length})` }} />
      </div>
      <ol className="gs-steps">
        {r.steps.map((s) => (
          <li key={s.id} className={s.done ? 'done' : s === next ? 'next' : ''}>
            <span className="gs-mark" aria-hidden>
              {s.done ? <Icon name="check" size={16} strokeWidth={3} /> : null}
            </span>
            <span className="gs-text">
              <span className="gs-title">{s.title}</span>
              {s === next && <span className="gs-sub">{s.sub}</span>}
            </span>
            <span className="sr-only">{s.done ? 'done' : 'to do'}</span>
          </li>
        ))}
      </ol>
      <button className="btn primary block" onClick={go}>
        {next.button}
      </button>
      {installing && (
        <InstallSheet
          onClose={() => {
            setInstalling(false)
            skipInstall()
          }}
        />
      )}
    </section>
  )
}
