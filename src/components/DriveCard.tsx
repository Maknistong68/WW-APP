import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from './Icon'
import { openSheet } from './SheetHost'
import { showToast } from './Toast'
import { useAuthInfo } from '../lib/auth'
import { callFunction } from '../lib/functions'
import { type DriveCopy, type DriveStatus, driveLine, photosText, rememberDrive } from '../lib/drive'
import { logEvent } from '../db'

/** How the admin came back from Google's sign-in page (drive-connect's redirect). */
const RETURN_TEXT: Record<string, string> = {
  connected: 'Google Drive connected. New photos go there.',
  cancelled: 'Google Drive not connected: the sign-in was cancelled.',
  expired: 'That took too long. Tap Connect again.',
  failed: 'Google Drive did not connect. Try again.',
}

/**
 * Settings › Google Drive: every photo taken in the app is copied to one
 * Google Drive folder. The admin connects the Google account once; everyone
 * sees whether it's on and how many photos are waiting.
 */
export default function DriveCard() {
  const me = useAuthInfo()
  const admin = me.role === 'admin'
  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [params, setParams] = useSearchParams()

  const check = useCallback(async () => {
    try {
      const s = await callFunction<DriveStatus>('drive-connect', { action: 'status' })
      setStatus(s)
      setError('')
      rememberDrive(s.connected && !s.problem)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (!me.userId) return
    void check()
    // back from Google's page (or another app): look again
    const onShow = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [me.userId, check])

  useEffect(() => {
    const word = params.get('drive')
    if (!word) return
    const next = new URLSearchParams(params)
    next.delete('drive')
    setParams(next, { replace: true })
    setTimeout(() => showToast({ text: RETURN_TEXT[word] ?? RETURN_TEXT.failed, duration: 6000 }), 300)
    logEvent(null, word === 'connected' ? 'Google Drive connected' : `Google Drive connect ${word === 'cancelled' ? 'cancelled' : 'failed'}`, word)
  }, [params, setParams])

  if (!me.userId) return null

  const connect = async () => {
    setBusy('connect')
    try {
      const { url } = await callFunction<{ url: string }>('drive-connect', { action: 'start' })
      window.location.assign(url)
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : String(e), duration: 7000 })
      setBusy('')
    }
  }

  const copyMissing = async () => {
    setBusy('copy')
    let total = 0
    try {
      // 25 at a time until none are left (or a round copies nothing)
      for (let round = 0; round < 40; round++) {
        const r = await callFunction<DriveCopy>('drive-photo', { sweep: true })
        total += r.copied
        if (r.problem) throw new Error(r.problem)
        setStatus((s) => (s ? { ...s, waiting: r.waiting ?? s.waiting } : s))
        if (!r.connected || !r.copied || !r.waiting) break
      }
      showToast({ text: total ? `${photosText(total)} copied to Google Drive` : 'No photos could be copied. Try again later.' })
    } catch (e) {
      showToast({ text: `Copying stopped after ${photosText(total)}: ${e instanceof Error ? e.message : String(e)}`, duration: 7000 })
    } finally {
      setBusy('')
      void check()
    }
  }

  const disconnect = () =>
    openSheet({
      kind: 'confirm',
      title: 'Disconnect Google Drive?',
      message: 'New photos stop going to Drive. Photos already there stay.',
      confirmLabel: 'Disconnect',
      destructive: true,
      onConfirm: () =>
        void (async () => {
          setBusy('disconnect')
          try {
            await callFunction('drive-connect', { action: 'disconnect' })
            rememberDrive(false)
            showToast({ text: 'Google Drive disconnected' })
          } catch (e) {
            showToast({ text: e instanceof Error ? e.message : String(e) })
          } finally {
            setBusy('')
            void check()
          }
        })(),
    })

  const on = !!status?.connected && !status.problem
  const line = error && !status ? 'Can’t check now. Are you online?' : driveLine(status)

  return (
    <>
      <div className="section-label">Google Drive</div>
      <div className="list drive-card">
        <div className="row">
          <span className="row-icon h-blue">
            <Icon name="cloud" size={20} fill />
          </span>
          <span className="row-main">
            <div className="row-title">Photos to Google Drive</div>
            <div className={`row-sub${status && status.connected && status.problem ? ' warn-text' : ''}`}>{line}</div>
          </span>
          {on && <Icon name="check-circle" size={20} fill className="ok-text" />}
        </div>
        {on && status?.folderUrl && (
          <a className="row" href={status.folderUrl} target="_blank" rel="noreferrer">
            <span className="row-main">Open the folder</span>
            <span className="row-chev">
              <Icon name="external-link" size={18} />
            </span>
          </a>
        )}
        {admin && on && !!status?.waiting && (
          <button className="row" onClick={() => void copyMissing()} disabled={!!busy}>
            <span className="row-main">
              <div className="row-title">{busy === 'copy' ? 'Copying…' : 'Copy missing photos now'}</div>
              <div className="row-sub">{photosText(status.waiting)} not on Drive yet</div>
            </span>
          </button>
        )}
        {admin && status?.ready && !on && (
          <button className="row" onClick={() => void connect()} disabled={!!busy}>
            <span className="row-main">
              <div className="row-title">{busy === 'connect' ? 'Opening Google…' : status.connected ? 'Connect again' : 'Connect Google Drive'}</div>
              <div className="row-sub">Sign in with the Google account that keeps the photos</div>
            </span>
            <span className="row-chev">
              <Icon name="chevron-right" size={18} />
            </span>
          </button>
        )}
        {admin && status?.connected && (
          <button className="row" onClick={disconnect} disabled={!!busy}>
            <span className="row-main danger-text">Disconnect</span>
          </button>
        )}
      </div>
      <div className="list-foot">
        {status?.connected && status.problem
          ? admin
            ? 'Google stopped the app’s access, for example after a password change. Connect again with the same account: nothing is lost.'
            : 'Google stopped the app’s access. The admin connects it again in Settings.'
          : status && !status.ready
          ? admin
            ? 'Add the Google sign-in keys on the server first (the one-time setup), then connect here.'
            : 'The admin turns this on.'
          : on
            ? 'Every photo taken in the app is copied there after it syncs, in a folder per contractor and visit.'
            : admin
              ? 'Connect once. Every photo taken in the app is then copied to a folder in that Google account. The app only sees the files it makes.'
              : 'The admin connects the team’s Google Drive here.'}
      </div>
    </>
  )
}
