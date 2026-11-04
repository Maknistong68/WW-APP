import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { showToast } from './Toast'
import { useAuthInfo } from '../lib/auth'
import { localDate, monthLabel } from '../lib/dates'
import { lastEndedMonth } from '../lib/due'
import { TEAM_SETTINGS_UUID, docOn, ruleAt, switchDoc } from '../lib/docRules'
import { saveRecord } from '../lib/records'
import { attempt } from '../lib/safeWrite'
import { SUBMISSION_ITEMS, type SubmissionItem } from '../lib/submissions'
import { backgroundSync } from '../lib/sync'
import { haptic } from '../lib/haptics'

/**
 * Settings › Monthly documents: the Admin switches a document off (or back on)
 * for the whole team, from the month being collected now. Earlier months keep
 * their numbers (src/lib/docRules.ts). Everyone else sees the switches only.
 */
export default function DocSwitches() {
  const me = useAuthInfo()
  // The phone-only copy (nobody signed in) is its own admin.
  const admin = me.role === 'admin'
  const row = useLiveQuery(() => db.teamSettings.get(TEAM_SETTINGS_UUID), [])
  const rules = row?.docRules ?? []
  const month = lastEndedMonth(localDate())

  const flip = (item: SubmissionItem, on: boolean) =>
    void attempt('Monthly documents', async () => {
      haptic('tick')
      const fresh = await db.teamSettings.get(TEAM_SETTINGS_UUID)
      const docRules = switchDoc(fresh?.docRules ?? [], item.key, !on, month)
      await saveRecord('teamSettings', { uuid: TEAM_SETTINGS_UUID, updatedAt: fresh?.updatedAt ?? '', docRules }, 'Monthly documents')
      showToast({ text: `${item.label} ${on ? 'on' : 'off'} from ${monthLabel(month)}` })
      backgroundSync()
    })

  return (
    <>
      <div className="section-label">Monthly documents</div>
      <div className="list">
        {SUBMISSION_ITEMS.map((i) => {
          const on = docOn(rules, i.key, month)
          const rule = ruleAt(rules, i.key, month)
          const sub = !on && rule ? `Off from ${monthLabel(rule.from)}` : rule ? `On again from ${monthLabel(rule.from)}` : i.group
          return (
            <label key={i.key} className="row">
              <span className="row-main">
                <div className="row-title">{i.label}</div>
                <div className={`row-sub${on ? '' : ' warn-text'}`}>{sub}</div>
              </span>
              <input type="checkbox" role="switch" aria-label={`${i.label}: asked for`} checked={on} disabled={!admin} onChange={(e) => flip(i, e.target.checked)} />
            </label>
          )
        })}
      </div>
      <div className="list-foot">
        {admin ? '' : 'Only the admin changes this. '}Off documents are not asked for or counted from {monthLabel(month)} on. Earlier months keep their
        numbers. WPS, Manpower register and Salary also leave the KPI score.
      </div>
    </>
  )
}
