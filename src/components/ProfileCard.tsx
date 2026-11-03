import { useEffect, useId, useState } from 'react'
import { getClient } from '../lib/sync'
import { refreshTeam } from '../lib/team'
import { nameProblem } from '../lib/authForm'
import { useAuthInfo } from '../lib/auth'
import { useSave } from '../lib/useSave'
import { beginEdit } from '../lib/editing'
import { showToast } from './Toast'

/** Settings › Your name: the name shown on every change you make. */
export default function ProfileCard() {
  const me = useAuthInfo()
  const [name, setName] = useState(me.fullName)
  useEffect(() => setName(me.fullName), [me.fullName])
  const { saving, alert, run } = useSave('Your name')
  const nameId = useId()
  const changed = name.trim() !== me.fullName
  // a half-typed name holds back an app update
  useEffect(() => (changed ? beginEdit() : undefined), [changed])

  const save = () =>
    run(async () => {
      const problem = nameProblem(name)
      if (problem) return problem
      if (!navigator.onLine) return 'Connect to the internet to save your name'
      const c = await getClient()
      if (!c) return 'Cloud sync is not set up'
      // an empty username keeps any username from before
      const { error } = await c.rpc('set_my_profile', { p_username: '', p_full_name: name.trim() })
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
      </div>
      {alert && (
        <div className="list-foot warn-text" role="alert">
          {alert}
        </div>
      )}
      <div className="list-foot" style={{ marginTop: alert ? 0 : undefined }}>
        Shown on every change you make.
      </div>
      {changed && (
        <button className="btn primary block" style={{ marginTop: -6, marginBottom: 18 }} disabled={saving} onClick={() => void save()}>
          Save name
        </button>
      )}
    </>
  )
}
