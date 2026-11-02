import { useEffect, useId, useState } from 'react'
import { getClient } from '../lib/sync'
import { refreshTeam } from '../lib/team'
import { nameProblem, normUsername, usernameProblem } from '../lib/authForm'
import { useAuthInfo } from '../lib/auth'
import { useSave } from '../lib/useSave'
import { beginEdit } from '../lib/editing'
import { showToast } from './Toast'

/** Settings › Your name: the name and @username shown on every change you make. */
export default function ProfileCard() {
  const me = useAuthInfo()
  const [name, setName] = useState(me.fullName)
  const [username, setUsername] = useState(me.username)
  useEffect(() => {
    setName(me.fullName)
    setUsername(me.username)
  }, [me.fullName, me.username])
  const { saving, alert, run } = useSave('Your name')
  const nameId = useId()
  const userId = useId()
  const changed = name.trim() !== me.fullName || normUsername(username) !== me.username
  // a half-typed name holds back an app update
  useEffect(() => (changed ? beginEdit() : undefined), [changed])

  const save = () =>
    run(async () => {
      const problem = nameProblem(name) ?? usernameProblem(username)
      if (problem) return problem
      if (!navigator.onLine) return 'Connect to the internet to save your name'
      const c = await getClient()
      if (!c) return 'Cloud sync is not set up'
      const { error } = await c.rpc('set_my_profile', { p_username: normUsername(username), p_full_name: name.trim() })
      // the server's own words ("That username is taken") are already short and plain
      if (error) return error.message
      me.refresh()
      void refreshTeam(true)
      showToast({ text: 'Name saved' })
    })

  return (
    <>
      <div className="section-label">Your name</div>
      <div className="list">
        <label className="row" htmlFor={nameId}>
          <span className="row-label">Name</span>
          <input id={nameId} value={name} autoComplete="name" placeholder="e.g. Ali Hassan" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="row" htmlFor={userId}>
          <span className="row-label">Username</span>
          <input
            id={userId}
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. ali"
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
      </div>
      {alert && (
        <div className="list-foot warn-text" role="alert">
          {alert}
        </div>
      )}
      <div className="list-foot" style={{ marginTop: alert ? 0 : undefined }}>
        Shown on every change you make. You can sign in with the username too.
      </div>
      {changed && (
        <button className="btn primary block" style={{ marginTop: -6, marginBottom: 18 }} disabled={saving} onClick={() => void save()}>
          Save name
        </button>
      )}
    </>
  )
}
