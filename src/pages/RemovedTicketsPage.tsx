import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import Page from '../components/Page'
import CardList from '../components/CardList'
import ItemRow from '../components/ItemRow'
import IconTile from '../components/IconTile'
import Icon from '../components/Icon'
import { openSheet } from '../components/SheetHost'
import { showToast } from '../components/Toast'
import { useAuthInfo } from '../lib/auth'
import { whoName } from '../lib/actor'
import { useTeam } from '../lib/team'
import { removalInfo } from '../lib/removal'
import { logActivity } from '../lib/records'
import { attempt } from '../lib/safeWrite'
import { backgroundSync, getClient, syncOrWait } from '../lib/sync'
import { shortDate } from '../lib/dates'
import { contractorName, ticketLabel, useContractors } from '../lib/useData'
import type { Ticket } from '../types'

/**
 * Tickets and cases the admin removed, with who, when and why. Restore puts
 * one back for the whole team. Read from the server (a removed ticket is no
 * longer on any phone), so it needs the internet.
 */
export default function RemovedTicketsPage() {
  const { role, userId } = useAuthInfo()
  const team = useTeam()
  const { byUuid } = useContractors()
  const [rows, setRows] = useState<Ticket[] | null>(null)
  const [problem, setProblem] = useState('')
  const entries = useLiveQuery(() => db.activity.where('entity').equals('ticket').filter((a) => a.action === 'delete').toArray(), [])

  const load = useCallback(async () => {
    if (!navigator.onLine) return setProblem('Connect to the internet to see removed tickets.')
    const c = await getClient()
    if (!c) return setProblem('Cloud sync is not set up.')
    // a removal made on this phone reaches the server first (waiting for a sync already running)
    await syncOrWait().catch(() => {})
    const r = await attempt('Removed tickets', async () => {
      const { data, error } = await c.from('tickets').select('uuid, data, updated_at').eq('deleted', true)
      if (error) throw new Error(error.message)
      // After 180 days a removed ticket's contents are emptied on the server (purge_deleted): nothing to restore.
      return ((data ?? []) as { uuid: string; data: Ticket & { purged?: boolean }; updated_at: string }[]).filter((x) => !x.data?.purged)
    })
    if (!r) return setProblem('Could not load the list. Try again.')
    setProblem('')
    setRows(r.map((x) => ({ ...x.data, uuid: x.uuid, updatedAt: x.updated_at })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const restore = (t: Ticket) =>
    openSheet({
      kind: 'confirm',
      title: `Restore ${t.ticketNo || 'this ticket'}?`,
      message: 'It comes back in every list, count and the Dashboard for the whole team.',
      confirmLabel: 'Restore',
      onConfirm: () =>
        void attempt(`Restore ${t.ticketNo}`, async () => {
          if (!navigator.onLine) throw new Error('Connect to the internet to restore a ticket')
          const c = await getClient()
          if (!c) throw new Error('Cloud sync is not set up')
          const { error } = await c.from('tickets').update({ deleted: false, updated_at: new Date().toISOString() }).eq('uuid', t.uuid)
          if (error) throw new Error(error.message)
          logActivity('ticket', t.uuid, 'restore', ticketLabel(t, byUuid))
          return true
        }).then((ok) => {
          if (!ok) return
          setRows((list) => list?.filter((x) => x.uuid !== t.uuid) ?? null)
          showToast({ text: `${t.ticketNo || 'Ticket'} restored` })
          backgroundSync()
        }),
    })

  if (role !== 'admin') {
    return (
      <Page title="Removed" back="/tickets" backLabel="Tickets">
        <div className="empty-state">
          <Icon name="shield" size={44} />
          <b>Admins only</b>
        </div>
      </Page>
    )
  }

  return (
    <Page title="Removed" back="/tickets" backLabel="Tickets">
      {problem ? (
        <div className="empty-state">
          <Icon name="cloud" size={44} />
          <b>{problem}</b>
          <button className="btn" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : rows === null ? null : rows.length === 0 ? (
        <div className="empty-state">
          <Icon name="check-circle" size={44} />
          <b>Nothing removed</b>
          Removed tickets and cases show here, with who removed them and why.
        </div>
      ) : (
        <>
          <CardList title="Removed tickets and cases" count={rows.length}>
            {rows.map((t) => {
              const info = removalInfo(entries ?? [], t.uuid)
              const who = info ? whoName(info.entry, team, userId) : null
              const when = info ? shortDate(info.time.slice(0, 10)) : shortDate(t.updatedAt.slice(0, 10))
              return (
                <ItemRow
                  key={t.uuid}
                  tile={<IconTile icon="trash" tone="none" size={52} />}
                  title={`${t.ticketNo} · ${contractorName(byUuid, t.contractorUuid) || t.issue || 'No contractor'}`}
                  sub={`Removed ${when}${who ? ` · by ${who}` : ''} · ${info?.reason || 'No reason given'}`}
                  trail={<Icon name="undo" size={22} />}
                  onOpen={() => restore(t)}
                  wrap
                />
              )
            })}
          </CardList>
          <div className="list-foot">Tap one to restore it.</div>
        </>
      )}
    </Page>
  )
}
