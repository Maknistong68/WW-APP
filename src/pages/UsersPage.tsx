import { useCallback, useEffect, useState } from 'react'
import Page from '../components/Page'
import { ConfirmSheet } from '../components/Modal'
import { showToast } from '../components/Toast'
import { useAuthInfo, type AccessStatus } from '../lib/auth'
import { shortDate } from '../lib/dates'
import { logActivity } from '../lib/records'
import { getClient } from '../lib/sync'

interface Profile {
  id: string
  email: string
  status: AccessStatus
  role: 'admin' | 'member'
  created_at: string
}

const SECTIONS: { status: AccessStatus; title: string }[] = [
  { status: 'pending', title: 'Waiting for approval' },
  { status: 'approved', title: 'Approved' },
  { status: 'rejected', title: 'No access' },
]

/** Number of accounts waiting for approval (admin only; 0 otherwise). */
export async function pendingCount(): Promise<number> {
  const c = await getClient()
  if (!c) return 0
  const { count } = await c.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return count ?? 0
}

/** Admin: approve or remove team members. */
export default function UsersPage() {
  const me = useAuthInfo()
  const [list, setList] = useState<Profile[] | null>(null)
  const [confirm, setConfirm] = useState<{ p: Profile; to: AccessStatus } | null>(null)

  const load = useCallback(async () => {
    const c = await getClient()
    if (!c) return
    const { data, error } = await c.from('profiles').select('id, email, status, role, created_at').order('created_at')
    if (error) showToast({ text: error.message })
    setList((data ?? []) as Profile[])
  }, [])
  useEffect(() => void load(), [load])

  const decide = async (p: Profile, to: AccessStatus) => {
    const c = await getClient()
    if (!c) return
    const { error } = await c.from('profiles').update({ status: to, decided_at: new Date().toISOString() }).eq('id', p.id)
    if (error) return showToast({ text: error.message })
    logActivity('user', p.id, 'edit', `${p.email} · ${to === 'approved' ? 'approved' : 'access removed'}`, [
      { field: 'access', from: p.status, to },
    ])
    showToast({ text: to === 'approved' ? `${p.email} can now use the app` : `${p.email} no longer has access` })
    void load()
  }

  if (me.role !== 'admin') {
    return (
      <Page title="Users" back="/" backLabel="To-do">
        <div className="empty-state">
          <b>Admins only</b>
        </div>
      </Page>
    )
  }

  return (
    <Page title="Users">
      {SECTIONS.map(({ status, title }) => {
        const rows = (list ?? []).filter((p) => p.status === status)
        if (!rows.length && status !== 'pending') return null
        return (
          <div key={status}>
            <div className="section-label">
              {title} · {rows.length}
            </div>
            {rows.length === 0 ? (
              <div className="list-foot">Nobody is waiting.</div>
            ) : (
              <div className="list">
                {rows.map((p) => (
                  <div key={p.id} className="row">
                    <span className="row-main">
                      <div className="row-title">{p.email}</div>
                      <div className="row-sub">
                        {p.role === 'admin' ? 'Admin · ' : ''}joined {shortDate(p.created_at.slice(0, 10))}
                      </div>
                    </span>
                    {p.role !== 'admin' && (
                      <>
                        {status !== 'approved' && (
                          <button className="tog on" onClick={() => setConfirm({ p, to: 'approved' })}>
                            Approve
                          </button>
                        )}
                        {status !== 'rejected' && (
                          <button className="tog" onClick={() => setConfirm({ p, to: 'rejected' })}>
                            {status === 'pending' ? 'Reject' : 'Remove'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <div className="list-foot">Approved users see and edit the same data as you. New accounts always start here.</div>

      {confirm && (
        <ConfirmSheet
          title={confirm.to === 'approved' ? 'Approve this account?' : 'Remove access?'}
          message={
            confirm.to === 'approved'
              ? `${confirm.p.email} will see and edit all tickets, contractors, camps and KPIs.`
              : `${confirm.p.email} will no longer see any data.`
          }
          confirmLabel={confirm.to === 'approved' ? 'Approve' : 'Remove access'}
          destructive={confirm.to !== 'approved'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const c = confirm
            setConfirm(null)
            void decide(c.p, c.to)
          }}
        />
      )}
    </Page>
  )
}
