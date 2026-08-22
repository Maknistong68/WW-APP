import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { compressPhoto, db } from '../db'
import { getTemplate, countItems } from '../templates'
import {
  ASSESSMENT_OPTIONS,
  EMPTY_RESPONSE,
  FACILITY_PHOTOS,
  YES_NO_OPTIONS,
  type ComplianceAssessment,
  type Inspection,
  type Photo,
  type QuestionResponse,
} from '../types'
import PhotoThumb from '../components/PhotoThumb'

const ASSESS_LABEL: Record<ComplianceAssessment, string> = {
  '': '',
  'Full compliance': 'Full',
  'Partial compliance': 'Partial',
  'No compliance': 'None',
  'N/A': 'N/A',
}
const ASSESS_CLASS: Record<ComplianceAssessment, string> = {
  '': '',
  'Full compliance': 'sel-full',
  'Partial compliance': 'sel-partial',
  'No compliance': 'sel-none',
  'N/A': 'sel-na',
}

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

  const setResponse = (code: string, patch: Partial<QuestionResponse>) => {
    update((ins) => ({
      ...ins,
      responses: {
        ...ins.responses,
        [code]: { ...(ins.responses[code] ?? EMPTY_RESPONSE), ...patch },
      },
    }))
  }

  const progress = useMemo(() => {
    if (!template || !inspection) return { answered: 0, total: 0 }
    const total = countItems(template)
    const answered = Object.values(inspection.responses).filter((r) => r.assessment !== '' || r.yesNo !== '').length
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
    if (itemId !== FACILITY_PHOTOS) setOpenDetails((d) => ({ ...d, [itemId]: true }))
  }

  const jumpToItem = (code: string) => {
    const section = template.sections.find((s) => s.questions.some((qq) => qq.code === code))
    if (section) setOpenSections((o) => ({ ...o, [section.letter]: true }))
    setOpenDetails((d) => ({ ...d, [code]: true }))
    setFlashItem(code)
    setTimeout(() => {
      document.getElementById(`item-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
    setTimeout(() => setFlashItem(null), 1800)
  }

  const assignPhoto = async (itemId: string) => {
    if (!assigningPhoto?.id) return
    await db.photos.update(assigningPhoto.id, { itemId })
    setAssigningPhoto(null)
    if (itemId === FACILITY_PHOTOS) return
    // A photo usually documents a problem — pre-select No compliance if untouched.
    if ((inspection.responses[itemId]?.assessment ?? '') === '') {
      setResponse(itemId, { assessment: 'No compliance', yesNo: inspection.responses[itemId]?.yesNo ?? '' })
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
  const facilityShots = (photos ?? []).filter((p) => p.itemId === FACILITY_PHOTOS)
  const photosFor = (code: string) => (photos ?? []).filter((p) => p.itemId === code)

  return (
    <>
      <header className="app-header">
        <button className="back" onClick={() => navigate('/')} aria-label="Back">
          ‹
        </button>
        <h1>
          {template.shortName} · {inspection.info.contractorNames || inspection.info.facilityLocation}
        </h1>
      </header>
      <div className="progress-wrap">
        <div className="progress-bar">
          <div style={{ width: `${progress.total ? (progress.answered / progress.total) * 100 : 0}%` }} />
        </div>
        <div className="progress-text">
          {progress.answered} of {progress.total} questions answered
        </div>
      </div>

      <main className="page">
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

        <div className="card">
          <b style={{ fontSize: 14 }}>🏕 Facility / site photos</b>
          <p className="note" style={{ margin: '4px 0 8px' }}>
            General photos of the camp — exported into the General Information sheet.
          </p>
          <div className="photo-row">
            {facilityShots.map((p) => (
              <PhotoThumb key={p.id} blob={p.blob} className="photo-thumb" onClick={() => setViewingPhoto(p)} />
            ))}
            <button
              className="add-photo"
              title="Add facility photo"
              onClick={() => {
                itemCameraTarget.current = FACILITY_PHOTOS
                itemCameraRef.current?.click()
              }}
            >
              📷
            </button>
          </div>
        </div>

        {template.sections.map((section) => {
          const sectionAnswered = section.questions.filter((qq) => {
            const resp = inspection.responses[qq.code]
            return resp && (resp.assessment !== '' || resp.yesNo !== '')
          }).length
          const open = openSections[section.letter] ?? false
          return (
            <div key={section.letter} className="card section-card">
              <button
                className="section-head"
                onClick={() => setOpenSections((o) => ({ ...o, [section.letter]: !open }))}
              >
                <span className="chev">{open ? '▾' : '▸'}</span>
                <span className="letter">{section.letter}</span>
                {section.title}
                <span className="counts">
                  {sectionAnswered}/{section.questions.length}
                </span>
              </button>
              {open &&
                section.questions.map((question) => {
                  const resp = inspection.responses[question.code] ?? EMPTY_RESPONSE
                  const itemPhotos = photosFor(question.code)
                  const detailsOpen =
                    (openDetails[question.code] ?? false) ||
                    resp.assessment === 'No compliance' ||
                    resp.assessment === 'Partial compliance' ||
                    itemPhotos.length > 0 ||
                    !!resp.observation ||
                    !!resp.actionPlan
                  return (
                    <div
                      key={question.code}
                      id={`item-${question.code}`}
                      className={`item${flashItem === question.code ? ' flash' : ''}`}
                    >
                      <div className="item-text">
                        <b className="qcode">{question.code}</b> {question.text}
                      </div>
                      <div className="control-label">Yes / No / N-A</div>
                      <div className="result-btns">
                        {YES_NO_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            className={resp.yesNo === opt ? `sel-yn-${opt === 'Yes' ? 'yes' : opt === 'No' ? 'no' : 'na'}` : ''}
                            onClick={() => setResponse(question.code, { yesNo: resp.yesNo === opt ? '' : opt })}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <div className="control-label">Compliance assessment</div>
                      <div className="result-btns">
                        {ASSESSMENT_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            className={resp.assessment === opt ? ASSESS_CLASS[opt] : ''}
                            onClick={() =>
                              setResponse(question.code, { assessment: resp.assessment === opt ? '' : opt })
                            }
                          >
                            {ASSESS_LABEL[opt]}
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
                              onChange={(e) => setResponse(question.code, { observation: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label>Action plan / remarks</label>
                            <textarea
                              value={resp.actionPlan}
                              placeholder="What must be done, by whom, by when?"
                              onChange={(e) => setResponse(question.code, { actionPlan: e.target.value })}
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
                                itemCameraTarget.current = question.code
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
                          onClick={() => setOpenDetails((d) => ({ ...d, [question.code]: true }))}
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
            <label>Conclusion remarks (added to the Word report)</label>
            <textarea
              value={inspection.notes}
              placeholder="Particular concerns, priorities, deadlines…"
              onChange={(e) => update((ins) => ({ ...ins, notes: e.target.value }))}
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
              {exporting === 'excel' ? 'Exporting…' : '⬇ Excel report'}
            </button>
            <button className="btn" disabled={exporting !== null} onClick={() => doExport('word')}>
              {exporting === 'word' ? 'Exporting…' : '⬇ Word report'}
            </button>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            Excel: full inspection report workbook (Cover, General Information, Questionnaire, Summary, Photo
            Evidence). Word: non-compliance findings report. Both generated on your phone, no internet needed.
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
              <button className="assign-item" onClick={() => void assignPhoto(FACILITY_PHOTOS)}>
                🏕 <b>General facility / site photo</b>
              </button>
              {template.sections.map((section) => (
                <div key={section.letter}>
                  <div className="assign-section">
                    Section {section.letter} — {section.title}
                  </div>
                  {section.questions.map((question) => (
                    <button
                      key={question.code}
                      className="assign-item"
                      onClick={() => void assignPhoto(question.code)}
                    >
                      <b className="qcode">{question.code}</b> {question.text}
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
                <label>Caption</label>
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
                  Move / reassign
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
