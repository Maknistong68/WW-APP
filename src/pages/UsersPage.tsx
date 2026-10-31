import { useCallback, useEffect, useState } from 'react'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Modal, { ConfirmSheet } from '../components/Modal'
import { showToast } from '../components/Toast'
import { ROLE_LABEL, normRole, useAuthInfo, type AccessStatus, type Role } from '../lib/auth'
import { shortDate } from '../lib/dates'
import { logActivity } from '../lib/records'
import { getClient } from '../lib/sync'

interface Profile {
  id: string
  email: string
  status: AccessStatus
  role: Role
  created_at: string
}

const SECTIONS: { status: AccessStatus; title: string }[] = [
  { status: 'pending', title: 'Waiting for approval' },
  { status: 'approved', title: 'Team' },
  { status: 'rejected', title: 'No access' },
]

const ROLES: { role: Role; what: string }[] = [
  { role: 'admin', what: 'Everything, plus users and roles' },
  { role: 'editor', what: 'Add and change tickets, KPIs, camps' },
  { role: 'viewer', what: 'Look only · dashboard and exports' },
]

/** Number of accounts waiting for approval (admin only; 0 otherwise). */
export async function pendingCount(): Promise<number> {
  const c = await getClient()
  if (!c) return 0
  const { count } = await c.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return count ?? 0
}

/** One account: pick a role, approve, or remove access. */
function UserSheet({
  p,
  onSave,
  onRemove,
  onClose,
}: {
  p: Profile
  onSave: (role: Role, status: AccessStatus) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [role, setRole] = useState<Role>(p.status === 'approved' ? p.role : p.role === 'admin' ? 'admin' : 'editor')
  return (
    <Modal title={p.email} onClose={onClose}>
      <div className="sheet-body">
        <div className="section-label">Role</div>
        <div className="list">
          {ROLES.map((r) => (
            <button key={r.role} className="row" aria-pressed={role === r.role} onClick={() => setRole(r.role)}>
              <span className="row-main">
                <div className="row-title">{ROLE_LABEL[r.role]}</div>
                <div className="row-sub">{r.what}</div>
              </span>
              {role === r.role && (
                <span style={{ color: 'var(--brand)' }}>
                  <Icon name="check" size={20} strokeWidth={2.5} />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          {p.status === 'approved' ? (
            <>
              <button className="btn danger" onClick={onRemove}>
                Remove access
              </button>
              <button className="btn primary" disabled={role === p.role} onClick={() => onSave(role, 'approved')}>
                Save
              </button>
            </>
          ) : (
            <>
              {p.status === 'pending' && (
                <button className="btn" onClick={onRemove}>
                  Reject
                </button>
              )}
              <button className="btn primary" onClick={() => onSave(role, 'approved')}>
                Approve as {ROLE_LABEL[role]}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Admin: approve accounts and set each person's role. */
export default function UsersPage() {
  const me = useAuthInfo()
  const [list, setList] = useState<Profile[] | null>(null)
  const [open, setOpen] = useState<Profile | null>(null)
  const [removing, setRemoving] = useState<Profile | null>(null)

  const load = useCallback(async () => {
    const c = await getClient()
    if (!c) return
    const { data, error } = await c.from('profiles').select('id, email, status, role, created_at').order('created_at')
    if (error) showToast({ text: error.message })
    setList(((data ?? []) as Profile[]).map((p) => ({ ...p, role: normRole(p.role) })))
  }, [])
  useEffect(() => void load(), [load])

  const update = async (p: Profile, role: Role, status: AccessStatus) => {
    const c = await getClient()
    if (!c) return
    const { error } = await c
      .from('profiles')
      .update({ role, status, decided_at: new Date().toISOString() })
      .eq('id', p.id)
    if (error) return showToast({ text: error.message })
    const changes = [
      ...(p.status !== status ? [{ field: 'access', from: p.status, to: status }] : []),
      ...(p.role !== role ? [{ field: 'role', from: ROLE_LABEL[p.role], to: ROLE_LABEL[role] }] : []),
    ]
    const what =
      status === 'rejected'
        ? 'access removed'
        : p.status !== 'approved'
          ? `approved as ${ROLE_LABEL[role]}`
          : `role → ${ROLE_LABEL[role]}`
    logActivity('user', p.id, 'edit', `${p.email} · ${what}`, changes)
    showToast({ text: `${p.email} · ${what}` })
    void load()
  }

  if (me.role !== 'admin') {
    return (
      <Page title="Users" back="/" backLabel="Home">
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
                {rows.map((p) => {
                  const self = p.email === me.email
                  return (
                    <button key={p.id} className="row" disabled={self} onClick={() => setOpen(p)}>
                      <span className="row-main">
                        <div className="row-title">{p.email}</div>
                        <div className="row-sub">
                          {status === 'approved' ? ROLE_LABEL[p.role] : status === 'pending' ? 'New account' : 'No access'}
                          {self ? ' · you' : ''} · joined {shortDate(p.created_at.slice(0, 10))}
                        </div>
                      </span>
                      {status === 'pending' && <span className="tog on">Review</span>}
                      {!self && (
                        <span className="row-chev">
                          <Icon name="chevron-right" size={18} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <div className="list-foot">
        Admin: everything + users · Editor: add and change data · Viewer: look only. New accounts always start here.
      </div>

      {open && (
        <UserSheet
          p={open}
          onClose={() => setOpen(null)}
          onSave={(role, status) => {
            const p = open
            setOpen(null)
            void update(p, role, status)
          }}
          onRemove={() => {
            setRemoving(open)
            setOpen(null)
          }}
        />
      )}
      {removing && (
        <ConfirmSheet
          title={removing.status === 'pending' ? 'Reject this account?' : 'Remove access?'}
          message={`${removing.email} will no longer see any data.`}
          confirmLabel={removing.status === 'pending' ? 'Reject' : 'Remove access'}
          destructive
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const p = removing
            setRemoving(null)
            void update(p, p.role, 'rejected')
          }}
        />
      )}
    </Page>
  )
}
