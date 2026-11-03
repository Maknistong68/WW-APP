import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Page from '../components/Page'
import Icon from '../components/Icon'
import IconTile from '../components/IconTile'
import StatusChip from '../components/StatusChip'
import ItemRow from '../components/ItemRow'
import CardList from '../components/CardList'
import Modal, { ConfirmSheet, type ModalHandle } from '../components/Modal'
import SaveButton from '../components/SaveButton'
import { displayName } from '../lib/actor'
import { callFunction } from '../lib/functions'
import { copyText } from '../lib/clipboard'
import { inviteProblem, inviteStatus } from '../lib/invite'
import { useSave } from '../lib/useSave'
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
  username: string | null
  full_name: string | null
  invited_at: string | null
  joined_at: string | null
}

/** The link to send by hand: shown with a Copy button. */
function LinkSheet({ name, link, noEmail, onClose }: { name: string; link: string; noEmail: boolean; onClose: () => void }) {
  const copy = () =>
    void copyText(link).then((ok) => showToast({ text: ok ? 'Link copied. Send it by WhatsApp or email.' : 'Could not copy. Hold the link to copy it.' }))
  return (
    <Modal title="Send this link" onClose={onClose}>
      <div className="sheet-body">
        <p className="list-foot" style={{ marginTop: 0 }}>
          {noEmail ? `No email could go out, so send this link to ${name} yourself.` : `Send this link to ${name} by WhatsApp or email.`} It opens WW
          Co-pilot, where they choose a password. It works once and runs out after about an hour; then open their name
          and tap Send a new link.
        </p>
        <div className="list">
          <div className="row" style={{ overflowWrap: 'anywhere', fontSize: 14, userSelect: 'all' }}>
            {link}
          </div>
        </div>
        <button className="btn primary block" onClick={copy}>
          <Icon name="copy" size={18} /> Copy link
        </button>
      </div>
    </Modal>
  )
}

/** Invite a person: name, email, role. They set their own password from the email. */
function InviteSheet({ onClose, onDone }: { onClose: () => void; onDone: (r: { name: string; link?: string }) => void }) {
  const [f, setF] = useState({ name: '', email: '', role: 'editor' as Role })
  const ids = { name: useId(), email: useId() }
  const sheet = useRef<ModalHandle>(null)
  const { saving, alert, run } = useSave('Invite')
  const send = () =>
    run(async () => {
      const problem = inviteProblem(f)
      if (problem) return problem
      if (!navigator.onLine) return 'Connect to the internet to send an invite'
      try {
        const r = await callFunction<{ id: string; emailed: boolean; link?: string }>('invite-user', {
          name: f.name.trim(),
          email: f.email.trim(),
          role: f.role,
        })
        logActivity('user', r.id, 'add', `${f.name.trim()} invited as ${ROLE_LABEL[f.role]}`)
        const done = () => onDone({ name: f.name.trim(), link: r.link })
        if (sheet.current) sheet.current.close(done)
        else done()
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    })
  return (
    <Modal
      ref={sheet}
      title="Invite"
      onClose={onClose}
      alert={alert}
      header={
        <SaveButton saving={saving} onClick={() => void send()}>
          Send
        </SaveButton>
      }
    >
      <div className="sheet-body">
        <div className="list">
          <label className="row" htmlFor={ids.name}>
            <span className="row-label">Name</span>
            <input id={ids.name} value={f.name} autoFocus autoComplete="off" placeholder="e.g. Mona Ali" onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <label className="row" htmlFor={ids.email}>
            <span className="row-label">Email</span>
            <input id={ids.email} type="email" inputMode="email" autoCapitalize="none" value={f.email} placeholder="name@company.com" onChange={(e) => setF({ ...f, email: e.target.value })} />
          </label>
        </div>
        <div className="section-label">Role</div>
        <div className="list">
          {ROLES.map((r) => (
            <button key={r.role} className="row" aria-pressed={f.role === r.role} onClick={() => setF({ ...f, role: r.role })}>
              <span className="row-main">
                <div className="row-title">{ROLE_LABEL[r.role]}</div>
                <div className="row-sub">{r.what}</div>
              </span>
              {f.role === r.role && (
                <span style={{ color: 'var(--brand)' }}>
                  <Icon name="check" size={20} strokeWidth={2.5} />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="list-foot">They get an email to choose their password, then sign in with their email. No approval needed.</div>
      </div>
    </Modal>
  )
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
  onResend,
  onClose,
}: {
  p: Profile
  onSave: (role: Role, status: AccessStatus, names: { full_name: string }) => void
  onRemove: () => void
  onResend: () => void
  onClose: () => void
}) {
  const [role, setRole] = useState<Role>(p.status === 'approved' ? p.role : p.role === 'admin' ? 'admin' : 'editor')
  const [name, setName] = useState(p.full_name ?? '')
  const namesChanged = name.trim() !== (p.full_name ?? '')
  const names = { full_name: name.trim() }
  return (
    <Modal title={displayName(p) || p.email} onClose={onClose}>
      <div className="sheet-body">
        <div className="list">
          <label className="row">
            <span className="row-label">Name</span>
            <input value={name} placeholder="Their name" onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <div className="list-foot" style={{ marginTop: -8 }}>{p.email}</div>
        {inviteStatus(p) && (
          <div className="list">
            <button className="row" onClick={onResend}>
              <span className="row-main">
                <div className="row-title">Send a new link</div>
                <div className="row-sub">{inviteStatus(p)} · invited {shortDate((p.invited_at ?? '').slice(0, 10))}</div>
              </span>
              <Icon name="share" size={20} />
            </button>
          </div>
        )}
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
              <button className="btn primary" disabled={role === p.role && !namesChanged} onClick={() => onSave(role, 'approved', names)}>
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
              <button className="btn primary" onClick={() => onSave(role, 'approved', names)}>
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
  const [inviting, setInviting] = useState(false)
  const [link, setLink] = useState<{ name: string; link: string; noEmail: boolean } | null>(null)

  const load = useCallback(async () => {
    const c = await getClient()
    if (!c) return
    const { data, error } = await c
      .from('profiles')
      .select('id, email, status, role, created_at, username, full_name, invited_at, joined_at')
      .order('created_at')
    if (error) showToast({ text: error.message })
    setList(((data ?? []) as unknown as Profile[]).map((p) => ({ ...p, role: normRole(p.role) })))
  }, [])

  const resend = (p: Profile) =>
    void callFunction<{ link?: string }>('invite-user', { resendFor: p.id })
      .then((r) => r.link && setLink({ name: displayName(p) || p.email, link: r.link, noEmail: false }))
      .catch((err: unknown) => showToast({ text: err instanceof Error ? err.message : String(err), tone: 'bad' }))
  useEffect(() => void load(), [load])

  const update = async (p: Profile, role: Role, status: AccessStatus, names?: { full_name: string }) => {
    const c = await getClient()
    if (!c) return
    const nameChange = names && names.full_name !== (p.full_name ?? '')
    const { error } = await c
      .from('profiles')
      .update({
        role,
        status,
        decided_at: new Date().toISOString(),
        ...(nameChange ? { full_name: names.full_name || null } : {}),
      })
      .eq('id', p.id)
    if (error)
      return showToast({
        text: error.code === '23514' ? 'Check the name' : error.message,
        tone: 'bad',
      })
    const changes = [
      ...(p.status !== status ? [{ field: 'access', from: p.status, to: status }] : []),
      ...(p.role !== role ? [{ field: 'role', from: ROLE_LABEL[p.role], to: ROLE_LABEL[role] }] : []),
      ...(nameChange ? [{ field: 'name', from: displayName(p), to: displayName(names) }] : []),
    ]
    const what =
      status === 'rejected'
        ? 'access removed'
        : p.status !== 'approved'
          ? `approved as ${ROLE_LABEL[role]}`
          : p.role !== role
            ? `role → ${ROLE_LABEL[role]}`
            : 'name changed'
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
    <Page
      title="Users"
      back="/library"
      backLabel="Library"
      actions={
        <button className="nav-btn strong" onClick={() => setInviting(true)}>
          Invite
        </button>
      }
    >
      {SECTIONS.map(({ status, title }) => {
        const rows = (list ?? []).filter((p) => p.status === status)
        if (!rows.length && status !== 'pending') return null
        return (
          <div key={status}>
            {rows.length === 0 ? (
              <CardList title={title} count={0}>
                <div className="list-foot" style={{ margin: '4px 18px 16px' }}>Nobody is waiting.</div>
              </CardList>
            ) : (
              <CardList title={title} count={rows.length}>
                {rows.map((p) => {
                  const self = p.id === me.userId || p.email === me.email
                  const name = displayName(p)
                  const invited = inviteStatus(p)
                  return (
                    <ItemRow
                      key={p.id}
                      tile={<IconTile text={p.full_name || p.email} tone={status === 'pending' ? 'warn' : status === 'rejected' ? 'none' : 'info'} size={52} />}
                      title={name || p.email}
                      sub={[
                        name ? p.email : '',
                        `${status === 'approved' ? ROLE_LABEL[p.role] : status === 'pending' ? 'New account' : 'No access'}${self ? ' · you' : ''}`,
                        invited ?? `joined ${shortDate((p.joined_at ?? p.created_at).slice(0, 10))}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      trail={status === 'pending' ? <StatusChip tone="warn">Review</StatusChip> : invited ? <StatusChip tone="info">Invited</StatusChip> : undefined}
                      onOpen={self ? undefined : () => setOpen(p)}
                    />
                  )
                })}
              </CardList>
            )}
          </div>
        )
      })}
      <div className="list-foot">
        Admin: everything + users · Editor: add and change data · Viewer: look only. Invited people start with the role you
        pick; accounts made on the sign-in screen wait here for you.
      </div>

      {open && (
        <UserSheet
          p={open}
          onClose={() => setOpen(null)}
          onSave={(role, status, names) => {
            const p = open
            setOpen(null)
            void update(p, role, status, names)
          }}
          onResend={() => {
            const p = open
            setOpen(null)
            resend(p)
          }}
          onRemove={() => {
            setRemoving(open)
            setOpen(null)
          }}
        />
      )}
      {inviting && (
        <InviteSheet
          onClose={() => setInviting(false)}
          onDone={(r) => {
            setInviting(false)
            if (r.link) setLink({ name: r.name, link: r.link, noEmail: true })
            else showToast({ text: `Invite sent to ${r.name}` })
            void load()
          }}
        />
      )}
      {link && <LinkSheet name={link.name} link={link.link} noEmail={link.noEmail} onClose={() => setLink(null)} />}
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
