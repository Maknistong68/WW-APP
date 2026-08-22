import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { compressPhoto, db } from '../db'
import { getTemplate, countItems } from '../templates'
import {
  EMPTY_RESPONSE,
  FACILITY_PHOTOS,
  type Inspection,
  type Photo,
  type QuestionResponse,
  type Section,
} from '../types'
import PhotoThumb from '../components/PhotoThumb'
import QuestionItem from '../components/QuestionItem'

type Filter = 'all' | 'unanswered' | 'flagged'

const isAnswered = (r?: QuestionResponse) => !!r && (r.assessment !== '' || r.yesNo !== '')
const isFlagged = (r?: QuestionResponse) =>
  r?.assessment === 'No compliance' || r?.assessment === 'Partial compliance'

export default function ChecklistPage() {
  const { id } = useParams()
  const inspectionId = Number(id)
  const navigate = useNavigate()

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [assigningPhoto, setAssigningPhoto] = useState<Photo | null>(null)
  const [assignQuery, setAssignQuery] = useState('')
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null)
  const [flashItem, setFlashItem] = useState<string | null>(null)
  const [exporting, setExporting] = useState<null | 'excel' | 'word'>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const quickCameraRef = useRef<HTMLInputElement>(null)
  const quickGalleryRef = useRef<HTMLInputElement>(null)
  const itemCameraRef = useRef<HTMLInputElement>(null)
  const itemGalleryRef = useRef<HTMLInputElement>(null)
  const itemTarget = useRef<string | null>(null)
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
    if (!template || !inspection) return { answered: 0, total: 0, flagged: 0 }
    const total = countItems(template)
    const answered = Object.values(inspection.responses).filter(isAnswered).length
    const flagged = Object.values(inspection.responses).filter(isFlagged).length
    return { answered, total, flagged }
  }, [template, inspection])

  // Search + filter across the whole questionnaire
  const matches = useMemo(() => {
    if (!template || !inspection) return null
    const q = query.trim().toLowerCase()
    if (!q && filter === 'all') return null
    const out: Array<{ section: Section; codes: string[] }> = []
    for (const section of template.sections) {
      const codes = section.questions
        .filter((question) => {
          const resp = inspection.responses[question.code]
          if (filter === 'unanswered' && isAnswered(resp)) return false
          if (filter === 'flagged' && !isFlagged(resp)) return false
          if (!q) return true
          return (
            question.code.toLowerCase().includes(q) ||
            question.text.toLowerCase().includes(q) ||
            section.title.toLowerCase().includes(q) ||
            (resp?.observation ?? '').toLowerCase().includes(q)
          )
        })
        .map((question) => question.code)
      if (codes.length > 0) out.push({ section, codes })
    }
    return out
  }, [template, inspection, query, filter])

  if (!inspection || !template) {
    return <main className="page">{inspection === null ? <div className="empty">Loading…</div> : null}</main>
  }

  // --- photo handling -------------------------------------------------------

  const addPhotos = async (files: FileList | File[], itemId: string | null): Promise<Photo[]> => {
    const saved: Photo[] = []
    for (const file of Array.from(files)) {
      const blob = await compressPhoto(file)
      const photo: Photo = {
        inspectionId,
        itemId,
        blob,
        caption: '',
        createdAt: new Date().toISOString(),
      }
      const photoId = await db.photos.add(photo)
      saved.push({ ...photo, id: photoId })
    }
    return saved
  }

  const onQuickCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    // Photo-first flow: capture now, then choose where it belongs.
    const saved = await addPhotos(files, null)
    e.target.value = ''
    if (saved.length === 1) setAssigningPhoto(saved[0])
    // Multiple gallery picks land in the "waiting to be assigned" card.
  }

  const onItemCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    const itemId = itemTarget.current
    if (!files?.length || !itemId) return
    await addPhotos(files, itemId)
    e.target.value = ''
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
    setAssignQuery('')
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

  const allOpen = template.sections.every((s) => openSections[s.letter])
  const searching = matches !== null

  const renderQuestion = (code: string) => {
    const question = template.sections.flatMap((s) => s.questions).find((qq) => qq.code === code)!
    return (
      <QuestionItem
        key={code}
        question={question}
        resp={inspection.responses[code] ?? EMPTY_RESPONSE}
        photos={photosFor(code)}
        detailsOpen={openDetails[code] ?? false}
        flash={flashItem === code}
        onPatch={(patch) => setResponse(code, patch)}
        onOpenDetails={() => setOpenDetails((d) => ({ ...d, [code]: true }))}
        onCamera={() => {
          itemTarget.current = code
          itemCameraRef.current?.click()
        }}
        onGallery={() => {
          itemTarget.current = code
          itemGalleryRef.current?.click()
        }}
        onViewPhoto={setViewingPhoto}
      />
    )
  }

  const assignQ = assignQuery.trim().toLowerCase()
  const assignSections = template.sections
    .map((section) => ({
      section,
      questions: section.questions.filter(
        (question) =>
          !assignQ ||
          question.code.toLowerCase().includes(assignQ) ||
          question.text.toLowerCase().includes(assignQ) ||
          section.title.toLowerCase().includes(assignQ),
      ),
    }))
    .filter((s) => s.questions.length > 0)

  return (
    <>
      <div className="top-stack">
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
          {progress.answered} of {progress.total} answered
          {progress.flagged > 0 && ` · ${progress.flagged} non-compliance`}
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔎</span>
          <input
            type="search"
            value={query}
            placeholder="Search questions (e.g. fire, bed, A7…)"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="clear-btn" onClick={() => setQuery('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
        <div className="chip-row">
          {(
            [
              ['all', 'All'],
              ['unanswered', 'Unanswered'],
              ['flagged', 'Non-compliant'],
            ] as Array<[Filter, string]>
          ).map(([f, label]) => (
            <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {label}
              {f === 'unanswered' && ` (${progress.total - progress.answered})`}
              {f === 'flagged' && ` (${progress.flagged})`}
            </button>
          ))}
          {!searching && (
            <button
              className="chip"
              onClick={() =>
                setOpenSections(Object.fromEntries(template.sections.map((s) => [s.letter, !allOpen])))
              }
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
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

        {searching ? (
          <>
            <div className="result-count">
              {matches.reduce((n, m) => n + m.codes.length, 0)} question
              {matches.reduce((n, m) => n + m.codes.length, 0) === 1 ? '' : 's'} found
            </div>
            {matches.length === 0 && <div className="empty">Nothing matches. Try another word or filter.</div>}
            {matches.map(({ section, codes }) => (
              <div key={section.letter} className="card section-card">
                <div className="section-head static">
                  <span className="letter">{section.letter}</span>
                  {section.title}
                </div>
                {codes.map(renderQuestion)}
              </div>
            ))}
          </>
        ) : (
          <>
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
                  title="Take facility photo"
                  onClick={() => {
                    itemTarget.current = FACILITY_PHOTOS
                    itemCameraRef.current?.click()
                  }}
                >
                  📷
                </button>
                <button
                  className="add-photo"
                  title="Choose from gallery"
                  onClick={() => {
                    itemTarget.current = FACILITY_PHOTOS
                    itemGalleryRef.current?.click()
                  }}
                >
                  🖼
                </button>
              </div>
            </div>

            {template.sections.map((section) => {
              const sectionAnswered = section.questions.filter((qq) =>
                isAnswered(inspection.responses[qq.code]),
              ).length
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
                  {open && section.questions.map((qq) => renderQuestion(qq.code))}
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
                Excel: full inspection report workbook. Word: non-compliance findings report. Both generated on
                your phone, no internet needed.
              </p>
            </div>
          </>
        )}
      </main>

      {/* Photo-first flow: floating camera + gallery buttons */}
      <div className="fab-stack">
        <button className="fab small" title="Add photos from gallery" onClick={() => quickGalleryRef.current?.click()}>
          🖼
        </button>
        <button className="fab" title="Take photo" onClick={() => quickCameraRef.current?.click()}>
          📷
        </button>
      </div>
      <input
        ref={quickCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onQuickCapture}
      />
      <input ref={quickGalleryRef} type="file" accept="image/*" multiple hidden onChange={onQuickCapture} />
      <input
        ref={itemCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onItemCapture}
      />
      <input ref={itemGalleryRef} type="file" accept="image/*" multiple hidden onChange={onItemCapture} />

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
            <div className="assign-search">
              <input
                type="search"
                value={assignQuery}
                placeholder="Search questions…"
                onChange={(e) => setAssignQuery(e.target.value)}
              />
            </div>
            <div className="modal-body">
              {!assignQ && (
                <button className="assign-item" onClick={() => void assignPhoto(FACILITY_PHOTOS)}>
                  🏕 <b>General facility / site photo</b>
                </button>
              )}
              {assignSections.map(({ section, questions }) => (
                <div key={section.letter}>
                  <div className="assign-section">
                    Section {section.letter} — {section.title}
                  </div>
                  {questions.map((question) => (
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
              {assignSections.length === 0 && <div className="empty">No question matches “{assignQuery}”.</div>}
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
