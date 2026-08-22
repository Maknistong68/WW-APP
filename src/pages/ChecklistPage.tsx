import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { compressPhoto, db } from '../db'
import { getTemplate, countItems } from '../templates'
import type { Inspection, ItemResponse, Photo, ResultValue } from '../types'
import PhotoThumb from '../components/PhotoThumb'

const EMPTY_RESPONSE: ItemResponse = { result: 'not_checked', observation: '', correctiveAction: '' }

export default function ChecklistPage() {
  const { id } = useParams()
  const inspectionId = Number(id)
  const navigate = useNavigate()

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [assigningPhoto, setAssigningPhoto] = useState<Photo | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null)
  const [flashItem, setFlashItem] = useState<string | null>(null)
  const [exporting, setExporting] = useState<null | 'excel' | 'word'>(null)

  const quickCameraRef = useRef<HTMLInputElement>(null)
  const itemCameraRef = useRef<HTMLInputElement>(null)
  const itemCameraTarget = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  const photos = useLiveQuery(
    () => db.photos.where('inspectionId').equals(inspectionId).sortBy('createdAt'),
    [inspectionId],
  )

  useEffect(() => {
    void db.inspections.get(inspectionId).then((ins) => setInspection(ins ?? null))
  }, [inspectionId])

  const template = inspection ? getTemplate(inspection.templateId) : undefined

  const persist = (next: Inspection) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void db.inspections.put({ ...next, updatedAt: new Date().toISOString() })
    }, 400)
  }
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const update = (mutate: (ins: Inspection) => Inspection) => {
    setInspection((prev) => {
      if (!prev) return prev
      const next = mutate(prev)
      persist(next)
      return next
    })
  }

  const setResponse = (itemId: string, patch: Partial<ItemResponse>) => {
    update((ins) => ({
      ...ins,
      responses: {
        ...ins.responses,
        [itemId]: { ...(ins.responses[itemId] ?? EMPTY_RESPONSE), ...patch },
      },
    }))
  }

  const progress = useMemo(() => {
    if (!template || !inspection) return { answered: 0, total: 0 }
    const total = countItems(template)
    const answered = Object.values(inspection.responses).filter((r) => r.result !== 'not_checked').length
    return { answered, total }
  }, [template, inspection])

  if (!inspection || !template) {
    return <main className="page">{inspection === null ? <div className="empty">Loading…</div> : null}</main>
  }

  // --- photo handling -------------------------------------------------------

  const addPhoto = async (file: File, itemId: string | null) => {
    const blob = await compressPhoto(file)
    const photo: Photo = {
      inspectionId,
      itemId,
      blob,
      caption: '',
      createdAt: new Date().toISOString(),
    }
    const photoId = await db.photos.add(photo)
    return { ...photo, id: photoId }
  }

  const onQuickCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // Photo-first flow: capture now, then choose where it belongs.
    const saved = await addPhoto(file, null)
    setAssigningPhoto(saved)
  }

  const onItemCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const itemId = itemCameraTarget.current
    if (!file || !itemId) return
    await addPhoto(file, itemId)
    setOpenDetails((d) => ({ ...d, [itemId]: true }))
  }

  const jumpToItem = (itemId: string) => {
    const section = template.sections.find((s) => s.items.some((i) => i.id === itemId))
    if (section) setOpenSections((o) => ({ ...o, [section.id]: true }))
    setOpenDetails((d) => ({ ...d, [itemId]: true }))
    setFlashItem(itemId)
    setTimeout(() => {
      document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
    setTimeout(() => setFlashItem(null), 1800)
  }

  const assignPhoto = async (itemId: string) => {
    if (!assigningPhoto?.id) return
    await db.photos.update(assigningPhoto.id, { itemId })
    setAssigningPhoto(null)
    // Non-compliant is the usual reason for taking a photo — pre-select it if untouched.
    if ((inspection.responses[itemId]?.result ?? 'not_checked') === 'not_checked') {
      setResponse(itemId, { result: 'non_compliant' })
    }
    jumpToItem(itemId)
  }

  const doExport = async (kind: 'excel' | 'word') => {
    setExporting(kind)
    try {
      // export the latest state even if the debounce hasn't flushed yet
      clearTimeout(saveTimer.current)
      await db.inspections.put({ ...inspection, updatedAt: new Date().toISOString() })
      // Export libraries are heavy — load them only when actually exporting.
      if (kind === 'excel') {
        const { exportExcel } = await import('../export/excel')
        await exportExcel(template, inspection)
      } else {
        const { exportWord } = await import('../export/word')
        await exportWord(template, inspection)
      }
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(null)
    }
  }

  const unassigned = (photos ?? []).filter((p) => p.itemId === null)
  const photosFor = (itemId: string) => (photos ?? []).filter((p) => p.itemId === itemId)

  return (
    <>
      <header className="app-header">
        <button className="back" onClick={() => navigate('/')} aria-label="Back">
          ‹
        </button>
        <h1>
          {template.shortName} · {inspection.meta.contractor || inspection.meta.reference}
        </h1>
      </header>
      <div className="progress-wrap">
        <div className="progress-bar">
          <div style={{ width: `${progress.total ? (progress.answered / progress.total) * 100 : 0}%` }} />
        </div>
        <div className="progress-text">
          {progress.answered} of {progress.total} items answered
        </div>
      </div>

      <main className="page">
        <div className="warn-box">
          Placeholder checklist — the items and export layout will be replaced to match your official
          documents once you share them.
        </div>

        {unassigned.length > 0 && (
          <div className="card">
            <b style={{ fontSize: 14 }}>📷 Photos waiting to be assigned</b>
            <div className="photo-row" style={{ marginTop: 8 }}>
              {unassigned.map((p) => (
                <PhotoThumb key={p.id} blob={p.blob} className="photo-thumb" onClick={() => setAssigningPhoto(p)} />
              ))}
            </div>
            <p className="note">Tap a photo to place it on the checklist.</p>
          </div>
        )}

        {template.sections.map((section) => {
          const sectionAnswered = section.items.filter(
            (i) => (inspection.responses[i.id]?.result ?? 'not_checked') !== 'not_checked',
          ).length
          const open = openSections[section.id] ?? false
          return (
            <div key={section.id} className="card section-card">
              <button
                className="section-head"
                onClick={() => setOpenSections((o) => ({ ...o, [section.id]: !open }))}
              >
                <span className="chev">{open ? '▾' : '▸'}</span>
                {section.title}
                <span className="counts">
                  {sectionAnswered}/{section.items.length}
                </span>
              </button>
              {open &&
                section.items.map((item) => {
                  const resp = inspection.responses[item.id] ?? EMPTY_RESPONSE
                  const itemPhotos = photosFor(item.id)
                  const detailsOpen =
                    (openDetails[item.id] ?? false) ||
                    resp.result === 'non_compliant' ||
                    itemPhotos.length > 0 ||
                    !!resp.observation ||
                    !!resp.correctiveAction
                  return (
                    <div key={item.id} id={`item-${item.id}`} className={`item${flashItem === item.id ? ' flash' : ''}`}>
                      <div className="item-text">{item.text}</div>
                      <div className="result-btns">
                        {(['compliant', 'non_compliant', 'na'] as ResultValue[]).map((r) => (
                          <button
                            key={r}
                            className={resp.result === r ? `sel-${r}` : ''}
                            onClick={() =>
                              setResponse(item.id, { result: resp.result === r ? 'not_checked' : r })
                            }
                          >
                            {r === 'compliant' ? '✓ Compliant' : r === 'non_compliant' ? '✗ Non-compliant' : 'N/A'}
                          </button>
                        ))}
                      </div>
                      {detailsOpen ? (
                        <div className="item-details">
                          <div className="field">
                            <label>Observation</label>
                            <textarea
                              value={resp.observation}
                              placeholder="What did you observe?"
                              onChange={(e) => setResponse(item.id, { observation: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label>Corrective action</label>
                            <textarea
                              value={resp.correctiveAction}
                              placeholder="What must be done, by whom, by when?"
                              onChange={(e) => setResponse(item.id, { correctiveAction: e.target.value })}
                            />
                          </div>
                          <div className="photo-row">
                            {itemPhotos.map((p) => (
                              <PhotoThumb
                                key={p.id}
                                blob={p.blob}
                                className="photo-thumb"
                                onClick={() => setViewingPhoto(p)}
                              />
                            ))}
                            <button
                              className="add-photo"
                              title="Add photo"
                              onClick={() => {
                                itemCameraTarget.current = item.id
                                itemCameraRef.current?.click()
                              }}
                            >
                              📷
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="details-toggle"
                          onClick={() => setOpenDetails((d) => ({ ...d, [item.id]: true }))}
                        >
                          + Add observation / photo
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
          )
        })}

        <div className="card">
          <div className="field">
            <label>General notes / summary</label>
            <textarea
              value={inspection.meta.notes}
              placeholder="Overall remarks for the report"
              onChange={(e) => update((ins) => ({ ...ins, meta: { ...ins.meta, notes: e.target.value } }))}
            />
          </div>
          <button
            className={`btn block ${inspection.status === 'completed' ? '' : 'primary'}`}
            onClick={() =>
              update((ins) => ({ ...ins, status: ins.status === 'completed' ? 'draft' : 'completed' }))
            }
          >
            {inspection.status === 'completed' ? '↩ Reopen as draft' : '✔ Mark inspection complete'}
          </button>
          <div className="btn-row">
            <button className="btn" disabled={exporting !== null} onClick={() => doExport('excel')}>
              {exporting === 'excel' ? 'Exporting…' : '⬇ Excel'}
            </button>
            <button className="btn" disabled={exporting !== null} onClick={() => doExport('word')}>
              {exporting === 'word' ? 'Exporting…' : '⬇ Word report'}
            </button>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            Exports are generated on your phone — no internet needed. The layout is a placeholder until
            the official template is added.
          </p>
        </div>
      </main>

      {/* Photo-first flow: floating camera button */}
      <button className="fab" title="Take photo" onClick={() => quickCameraRef.current?.click()}>
        📷
      </button>
      <input
        ref={quickCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onQuickCapture}
      />
      <input
        ref={itemCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onItemCapture}
      />

      {/* Assign-photo modal */}
      {assigningPhoto && (
        <div className="modal-backdrop" onClick={() => setAssigningPhoto(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Where does this photo belong?</b>
              <button className="icon-btn" onClick={() => setAssigningPhoto(null)}>
                ✕
              </button>
            </div>
            <PhotoThumb blob={assigningPhoto.blob} className="assign-preview" />
            <div className="modal-body">
              {template.sections.map((section) => (
                <div key={section.id}>
                  <div className="assign-section">{section.title}</div>
                  {section.items.map((item) => (
                    <button key={item.id} className="assign-item" onClick={() => void assignPhoto(item.id)}>
                      {item.text}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Photo viewer */}
      {viewingPhoto && (
        <div className="modal-backdrop" onClick={() => setViewingPhoto(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Photo</b>
              <button className="icon-btn" onClick={() => setViewingPhoto(null)}>
                ✕
              </button>
            </div>
            <div className="viewer">
              <PhotoThumb blob={viewingPhoto.blob} />
              <div className="field" style={{ marginTop: 12 }}>
                <label>Caption (appears in the report)</label>
                <input
                  defaultValue={viewingPhoto.caption}
                  placeholder="e.g. Blocked fire exit, Block B"
                  onChange={(e) => {
                    if (viewingPhoto.id) void db.photos.update(viewingPhoto.id, { caption: e.target.value })
                  }}
                />
              </div>
              <div className="btn-row">
                <button
                  className="btn"
                  onClick={() => {
                    const p = viewingPhoto
                    setViewingPhoto(null)
                    setAssigningPhoto(p)
                  }}
                >
                  Move to another item
                </button>
                <button
                  className="btn"
                  style={{ color: 'var(--red)' }}
                  onClick={() => {
                    if (viewingPhoto.id && confirm('Delete this photo?')) {
                      void db.photos.delete(viewingPhoto.id)
                      setViewingPhoto(null)
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
