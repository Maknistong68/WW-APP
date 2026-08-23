import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import { compressPhoto, db, logEvent, newUuid } from '../db'
import { scoreInspection } from '../lib/score'
import { getTemplate, getWalkthrough, countItems } from '../templates'
import {
  EMPTY_RESPONSE,
  FACILITY_PHOTOS,
  WALK_STATUS_PATCH,
  type Inspection,
  type Photo,
  type QuestionResponse,
  type Section,
  type WalkStatus,
  type WalkthroughLine as WalkLine,
} from '../types'
import PhotoThumb from '../components/PhotoThumb'
import QuestionItem from '../components/QuestionItem'
import WalkthroughLine, { lineStatus } from '../components/WalkthroughLine'
import Modal from '../components/Modal'
import { showToast } from '../components/Toast'
import { newer } from '../lib/sync'

type Filter = 'all' | 'unanswered' | 'flagged'

const isAnswered = (r?: QuestionResponse) => !!r && (r.assessment !== '' || r.yesNo !== '')
const isFlagged = (r?: QuestionResponse) =>
  r?.assessment === 'No compliance' || r?.assessment === 'Partial compliance'

const MIME = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

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
  const [sectionSheet, setSectionSheet] = useState(false)
  const [flashItem, setFlashItem] = useState<string | null>(null)
  const [exporting, setExporting] = useState<null | 'excel' | 'word'>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [compact, setCompact] = useState(false)
  const [view, setViewState] = useState<'walk' | 'full'>(() =>
    localStorage.getItem('ww.view') === 'full' ? 'full' : 'walk',
  )
  const [openAreas, setOpenAreas] = useState<Record<number, boolean>>({})
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({})

  const setView = (v: 'walk' | 'full') => {
    setViewState(v)
    try {
      localStorage.setItem('ww.view', v)
    } catch {
      // non-fatal
    }
  }

  const quickCameraRef = useRef<HTMLInputElement>(null)
  const quickGalleryRef = useRef<HTMLInputElement>(null)
  const itemCameraRef = useRef<HTMLInputElement>(null)
  const itemGalleryRef = useRef<HTMLInputElement>(null)
  const itemTarget = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const pendingSave = useRef<Inspection | null>(null)
  const captionTimer = useRef<ReturnType<typeof setTimeout>>()
  const pendingCaption = useRef<{ photoId: number; caption: string } | null>(null)
  const lastScrollY = useRef(0)

  const photos = useLiveQuery(
    () => db.photos.where('inspectionId').equals(inspectionId).sortBy('createdAt'),
    [inspectionId],
  )

  // The row is observed live so copies pulled by cloud sync reach the editor.
  // Adoption only happens when the DB copy is genuinely newer: local edits
  // stamp a fresh updatedAt on every change, so our own write echoes (and any
  // older data) never overwrite unsaved keystrokes.
  const dbInspection = useLiveQuery(() => db.inspections.get(inspectionId), [inspectionId])
  useEffect(() => {
    if (!dbInspection) return
    setInspection((prev) =>
      !prev || newer(dbInspection.updatedAt, prev.updatedAt) ? dbInspection : prev,
    )
  }, [dbInspection])

  // F-07: collapse the toolbar while scrolling down, restore on scroll up.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const goingDown = y > lastScrollY.current
      lastScrollY.current = y
      setCompact(goingDown && y > 140)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const template = inspection ? getTemplate(inspection.templateId) : undefined
  const walkthrough = inspection ? getWalkthrough(inspection.templateId) : null
  const walkMode = view === 'walk' && walkthrough !== null

  // Guarded write-through: never overwrite a DB copy newer than the state
  // this edit came from (e.g. cloud sync pulled another device's record
  // between the keystroke and the debounce firing) — the adoption effect
  // above brings that newer copy into the editor instead.
  const writeInspection = async (next: Inspection) => {
    await db.transaction('rw', db.inspections, async () => {
      const existing = await db.inspections.get(next.id!)
      if (existing && newer(existing.updatedAt, next.updatedAt)) return
      await db.inspections.put(next)
    })
  }

  const persist = (next: Inspection) => {
    pendingSave.current = next
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      pendingSave.current = null
      void writeInspection(next)
    }, 400)
  }

  const flushSave = () => {
    const pending = pendingSave.current
    if (!pending) return
    pendingSave.current = null
    clearTimeout(saveTimer.current)
    void writeInspection(pending)
  }

  // Photo captions are debounced the same way: a per-keystroke DB write would
  // re-fire the photos live query and re-decode every visible thumbnail.
  const setCaption = (photoId: number, caption: string) => {
    pendingCaption.current = { photoId, caption }
    clearTimeout(captionTimer.current)
    captionTimer.current = setTimeout(flushCaption, 400)
  }

  const flushCaption = () => {
    const pending = pendingCaption.current
    if (!pending) return
    pendingCaption.current = null
    clearTimeout(captionTimer.current)
    void db.photos.update(pending.photoId, {
      caption: pending.caption,
      updatedAt: new Date().toISOString(),
    })
  }

  // Flush (not discard) pending saves when leaving the page or when the app
  // is backgrounded/closed, so edits from the last 400 ms are never lost.
  useEffect(() => {
    const flushAll = () => {
      flushSave()
      flushCaption()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushAll()
    }
    window.addEventListener('pagehide', flushAll)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flushAll)
      document.removeEventListener('visibilitychange', onHide)
      flushAll()
    }
  }, [])

  const update = (mutate: (ins: Inspection) => Inspection) => {
    setInspection((prev) => {
      if (!prev) return prev
      // Stamping updatedAt here (not at write time) keeps the in-memory copy
      // comparable against sync-pulled records in the adoption effect.
      const next = { ...mutate(prev), updatedAt: new Date().toISOString() }
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

  const questionByCode = new Map(template.sections.flatMap((s) => s.questions).map((q) => [q.code, q]))

  const setLineStatus = (line: WalkLine, status: WalkStatus) => {
    const current = lineStatus(line.codes, inspection.responses)
    const patch =
      current === status ? { yesNo: '' as const, assessment: '' as const } : WALK_STATUS_PATCH[status]
    update((ins) => ({
      ...ins,
      responses: {
        ...ins.responses,
        ...Object.fromEntries(
          line.codes.map((c) => [c, { ...(ins.responses[c] ?? EMPTY_RESPONSE), ...patch }]),
        ),
      },
    }))
  }

  // Questions the walkthrough doesn't touch (answered only in Full view)
  const coveredCodes = new Set((walkthrough ?? []).flatMap((a) => a.lines.flatMap((l) => l.codes)))
  const uncovered = walkthrough
    ? template.sections.flatMap((s) => s.questions).filter((q) => !coveredCodes.has(q.code))
    : []
  const uncoveredUnanswered = uncovered.filter((q) => !isAnswered(inspection.responses[q.code])).length

  // --- photo handling -------------------------------------------------------

  const addPhotos = async (files: FileList | File[], itemId: string | null): Promise<Photo[]> => {
    const saved: Photo[] = []
    for (const file of Array.from(files)) {
      const blob = await compressPhoto(file)
      const now = new Date().toISOString()
      const photo: Photo = {
        uuid: newUuid(),
        inspectionId,
        itemId,
        blob,
        caption: '',
        createdAt: now,
        updatedAt: now,
      }
      const photoId = await db.photos.add(photo)
      saved.push({ ...photo, id: photoId })
    }
    logEvent(
      inspectionId,
      `Photo${saved.length === 1 ? '' : 's'} added`,
      `${saved.length} to ${itemId ?? 'unassigned'}`,
    )
    return saved
  }

  const onQuickCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    // Photo-first flow: capture now, then choose where it belongs.
    const saved = await addPhotos(files, null)
    e.target.value = ''
    setAssigningPhoto(saved[0])
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
    if (walkMode && walkthrough) {
      // Find the first walkthrough line containing this code and reveal it.
      for (let ai = 0; ai < walkthrough.length; ai++) {
        const li = walkthrough[ai].lines.findIndex((l) => l.codes.includes(code))
        if (li >= 0) {
          const lineId = `wline-${ai}-${li}`
          setOpenAreas((o) => ({ ...o, [ai]: true }))
          setExpandedLines((e) => ({ ...e, [lineId]: true }))
          setFlashItem(lineId)
          setTimeout(() => {
            document.getElementById(lineId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 60)
          setTimeout(() => setFlashItem(null), 1800)
          return
        }
      }
      // Not covered by the walkthrough — fall through to the full view.
      setView('full')
    }
    const section = template.sections.find((s) => s.questions.some((qq) => qq.code === code))
    if (section) setOpenSections((o) => ({ ...o, [section.letter]: true }))
    setOpenDetails((d) => ({ ...d, [code]: true }))
    setFlashItem(code)
    setTimeout(() => {
      document.getElementById(`item-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
    setTimeout(() => setFlashItem(null), 1800)
  }

  const jumpToSection = (letter: string) => {
    setSectionSheet(false)
    setQuery('')
    setFilter('all')
    setOpenSections((o) => ({ ...o, [letter]: true }))
    setTimeout(() => {
      document.getElementById(`section-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  const jumpToArea = (ai: number) => {
    setSectionSheet(false)
    setQuery('')
    setFilter('all')
    setOpenAreas((o) => ({ ...o, [ai]: true }))
    setTimeout(() => {
      document.getElementById(`area-${ai}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  const assignPhoto = async (itemId: string) => {
    if (!assigningPhoto?.id) return
    await db.photos.update(assigningPhoto.id, { itemId, updatedAt: new Date().toISOString() })
    logEvent(inspectionId, 'Photo assigned', itemId === FACILITY_PHOTOS ? 'facility photos' : itemId)
    setAssignQuery('')
    if (itemId !== FACILITY_PHOTOS && (inspection.responses[itemId]?.assessment ?? '') === '') {
      // A photo usually documents a problem — pre-select No compliance if untouched.
      setResponse(itemId, { assessment: 'No compliance', yesNo: inspection.responses[itemId]?.yesNo ?? '' })
    }
    // F-14: chain through remaining unassigned photos instead of reopening the picker.
    const remaining = (photos ?? []).filter((p) => p.itemId === null && p.id !== assigningPhoto.id)
    showToast({
      text: itemId === FACILITY_PHOTOS ? 'Added to facility photos' : `Photo attached to ${itemId}`,
      duration: 2500,
    })
    if (remaining.length > 0) {
      setAssigningPhoto(remaining[0])
    } else {
      setAssigningPhoto(null)
      if (itemId !== FACILITY_PHOTOS) jumpToItem(itemId)
    }
  }

  const deletePhoto = async (photo: Photo) => {
    if (!photo.id) return
    // Re-read before deleting so Undo restores the latest caption, not a stale copy.
    const fresh = (await db.photos.get(photo.id)) ?? photo
    await db.photos.delete(photo.id)
    if (fresh.uuid) await db.tombstones.add({ table: 'photos', uuid: fresh.uuid })
    logEvent(inspectionId, 'Photo deleted', fresh.itemId ?? 'unassigned')
    setViewingPhoto(null)
    // F-08: undo instead of a blocking confirm — the blob is still in memory.
    showToast({
      text: 'Photo deleted',
      actionLabel: 'Undo',
      onAction: () => {
        const { id: _oldId, ...rest } = fresh
        void _oldId
        // A fresh updatedAt lets the restore win over the deletion during
        // sync, resurrecting the photo if the deletion already reached the
        // cloud (sync marks deletions with their own timestamp).
        void db.photos.add({ ...rest, updatedAt: new Date().toISOString() })
        if (fresh.uuid) {
          void db.tombstones.where('uuid').equals(fresh.uuid).delete()
        }
        logEvent(inspectionId, 'Photo restored')
      },
    })
  }

  const doExport = async (kind: 'excel' | 'word') => {
    setExporting(kind)
    try {
      // export the latest state even if the debounce hasn't flushed yet
      flushSave()
      // Export libraries are heavy — load them only when actually exporting.
      const { blob, fileName } =
        kind === 'excel'
          ? await (await import('../export/excel')).buildExcel(template, inspection)
          : await (await import('../export/word')).buildWord(template, inspection)
      saveAs(blob, fileName)
      logEvent(inspectionId, kind === 'excel' ? 'Excel report exported' : 'Word report exported', fileName)
      const file = new File([blob], fileName, { type: MIME[kind] })
      const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      showToast({
        text: `Saved ${fileName}`,
        duration: 7000,
        actionLabel: canShare ? 'Share…' : undefined,
        onAction: canShare
          ? () => {
              void navigator.share({ files: [file], title: fileName }).catch(() => {})
            }
          : undefined,
      })
    } catch (err) {
      showToast({
        text: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        duration: 8000,
      })
    } finally {
      setExporting(null)
    }
  }

  const unassigned = (photos ?? []).filter((p) => p.itemId === null)
  const facilityShots = (photos ?? []).filter((p) => p.itemId === FACILITY_PHOTOS)
  const photosFor = (code: string) => (photos ?? []).filter((p) => p.itemId === code)

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

  // --- walkthrough rendering helpers ---------------------------------------

  const lineFullyAnswered = (line: WalkLine) =>
    line.codes.every((c) => (inspection.responses[c]?.assessment ?? '') !== '')
  const lineMatchesFilter = (line: WalkLine) => {
    if (filter === 'unanswered') return !lineFullyAnswered(line)
    if (filter === 'flagged')
      return line.codes.some((c) => isFlagged(inspection.responses[c]))
    return true
  }
  const q = query.trim().toLowerCase()
  const lineMatchesQuery = (line: WalkLine, areaTitle: string) =>
    !q ||
    line.label.toLowerCase().includes(q) ||
    areaTitle.toLowerCase().includes(q) ||
    line.codes.some(
      (c) => c.toLowerCase().includes(q) || questionByCode.get(c)?.text.toLowerCase().includes(q),
    )
  const walkSearching = walkMode && (q !== '' || filter !== 'all')
  const walkMatches = walkSearching
    ? (walkthrough ?? [])
        .map((area, ai) => ({
          area,
          ai,
          lines: area.lines
            .map((line, li) => ({ line, li }))
            .filter(({ line }) => lineMatchesFilter(line) && lineMatchesQuery(line, area.title)),
        }))
        .filter((a) => a.lines.length > 0)
    : []

  const renderWalkLine = (ai: number, li: number, line: WalkLine) => {
    const lineId = `wline-${ai}-${li}`
    return (
      <WalkthroughLine
        key={lineId}
        id={lineId}
        line={line}
        questions={line.codes.map((c) => questionByCode.get(c)!).filter(Boolean)}
        responses={inspection.responses}
        photos={line.codes.flatMap((c) => photosFor(c))}
        expanded={expandedLines[lineId] ?? false}
        flash={flashItem === lineId}
        onStatus={(s) => setLineStatus(line, s)}
        onToggleExpand={() => setExpandedLines((e) => ({ ...e, [lineId]: !(e[lineId] ?? false) }))}
        onPatchPrimary={(patch) => setResponse(line.codes[0], patch)}
        onCamera={() => {
          itemTarget.current = line.codes[0]
          itemCameraRef.current?.click()
        }}
        onGallery={() => {
          itemTarget.current = line.codes[0]
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
      <div className={`top-stack${compact ? ' compact' : ''}`}>
        <header className="app-header">
          <button className="back" onClick={() => navigate('/')} aria-label="Back">
            ‹
          </button>
          <h1>
            {template.shortName} · {inspection.info.contractorNames || inspection.info.facilityLocation}
          </h1>
          <button
            className="icon-btn header-btn"
            aria-label="Edit inspection details"
            title="Edit inspection details"
            onClick={() => navigate(`/inspection/${inspectionId}/edit`)}
          >
            ✎
          </button>
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
          <div className="search-row">
            <div className="search-box">
              <span className="search-icon" aria-hidden="true">🔎</span>
              <input
                type="search"
                value={query}
                placeholder="Search questions (e.g. fire, bed, A7…)"
                aria-label="Search questions"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="clear-btn" onClick={() => setQuery('')} aria-label="Clear search">
                  ✕
                </button>
              )}
            </div>
            {walkthrough && (
              <button
                className="jump-btn"
                aria-label={walkMode ? 'Switch to full questionnaire' : 'Switch to walkthrough'}
                title={walkMode ? 'Switch to full questionnaire' : 'Switch to area-by-area walkthrough'}
                onClick={() => setView(walkMode ? 'full' : 'walk')}
              >
                {walkMode ? '📋 Full' : '🚶 Walk'}
              </button>
            )}
            <button
              className="jump-btn"
              aria-label={walkMode ? 'Jump to area' : 'Jump to section'}
              title={walkMode ? 'Jump to area' : 'Jump to section'}
              onClick={() => setSectionSheet(true)}
            >
              {walkMode ? '1→13' : 'A→X'}
            </button>
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

        {walkSearching ? (
          <>
            <div className="result-count">
              {walkMatches.reduce((n, m) => n + m.lines.length, 0)} item
              {walkMatches.reduce((n, m) => n + m.lines.length, 0) === 1 ? '' : 's'} found
            </div>
            {walkMatches.length === 0 && <div className="empty">Nothing matches. Try another word or filter.</div>}
            {walkMatches.map(({ area, ai, lines }) => (
              <div key={ai} className="card section-card">
                <div className="section-head static">
                  <span className="letter">{ai + 1}</span>
                  {area.title}
                </div>
                {lines.map(({ line, li }) => renderWalkLine(ai, li, line))}
              </div>
            ))}
          </>
        ) : searching && !walkMode ? (
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
                  aria-label="Take facility photo"
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
                  aria-label="Choose facility photos from gallery"
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

            {walkMode ? (
              <>
                {(walkthrough ?? []).map((area, ai) => {
                  const answeredLines = area.lines.filter(lineFullyAnswered).length
                  const open = openAreas[ai] ?? false
                  return (
                    <div key={ai} id={`area-${ai}`} className="card section-card">
                      <button
                        className="section-head"
                        onClick={() => setOpenAreas((o) => ({ ...o, [ai]: !open }))}
                      >
                        <span className="chev">{open ? '▾' : '▸'}</span>
                        <span className="letter">{ai + 1}</span>
                        {area.title}
                        <span className="counts">
                          {answeredLines}/{area.lines.length}
                        </span>
                      </button>
                      {open && area.lines.map((line, li) => renderWalkLine(ai, li, line))}
                    </div>
                  )
                })}
                {uncovered.length > 0 && (
                  <div className="card">
                    <b style={{ fontSize: 14 }}>📋 Not covered by the walkthrough</b>
                    <p className="note" style={{ margin: '4px 0 8px' }}>
                      {uncovered.length} questions (mostly documentation) exist only in the full
                      questionnaire —{' '}
                      {uncoveredUnanswered > 0 ? `${uncoveredUnanswered} still unanswered.` : 'all answered ✓'}
                    </p>
                    <button
                      className="btn block"
                      onClick={() => {
                        setView('full')
                        setFilter('unanswered')
                      }}
                    >
                      Open full questionnaire
                    </button>
                  </div>
                )}
              </>
            ) : (
              template.sections.map((section) => {
                const sectionAnswered = section.questions.filter((qq) =>
                  isAnswered(inspection.responses[qq.code]),
                ).length
                const open = openSections[section.letter] ?? false
                return (
                  <div key={section.letter} id={`section-${section.letter}`} className="card section-card">
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
              })
            )}

            <div className="card">
              <div className="field">
                <label>Conclusion remarks (added to the Word report)</label>
                <textarea
                  value={inspection.notes}
                  placeholder="Particular concerns, priorities, deadlines…"
                  onChange={(e) => update((ins) => ({ ...ins, notes: e.target.value }))}
                />
              </div>
              {(() => {
                const score = scoreInspection(template, inspection)
                return (
                  score.pct !== null && (
                    <p className="note" style={{ marginTop: 0 }}>
                      Current compliance score: <b>{score.pct}%</b>
                      {score.flagged > 0 && ` · ${score.flagged} open finding${score.flagged === 1 ? '' : 's'}`}
                    </p>
                  )
                )
              })()}
              <button
                className={`btn block ${inspection.status === 'completed' ? '' : 'primary'}`}
                onClick={() =>
                  update((ins) => {
                    const completed = ins.status !== 'completed'
                    logEvent(inspectionId, completed ? 'Inspection completed' : 'Inspection reopened')
                    return { ...ins, status: completed ? 'completed' : 'draft' }
                  })
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
        <button
          className="fab small"
          aria-label="Add photos from gallery"
          title="Add photos from gallery"
          onClick={() => quickGalleryRef.current?.click()}
        >
          🖼
        </button>
        <button className="fab" aria-label="Take photo" title="Take photo" onClick={() => quickCameraRef.current?.click()}>
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

      {/* Section / area jump sheet */}
      {sectionSheet && (
        <Modal title={walkMode ? 'Jump to area' : 'Jump to section'} onClose={() => setSectionSheet(false)}>
          <div className="modal-body">
            {walkMode
              ? (walkthrough ?? []).map((area, ai) => {
                  const done = area.lines.filter(lineFullyAnswered).length
                  return (
                    <button key={ai} className="assign-item" onClick={() => jumpToArea(ai)}>
                      <span className="letter">{ai + 1}</span> {area.title}
                      <span className="jump-count">
                        {done}/{area.lines.length}
                      </span>
                    </button>
                  )
                })
              : template.sections.map((section) => {
                  const done = section.questions.filter((qq) => isAnswered(inspection.responses[qq.code])).length
                  return (
                    <button key={section.letter} className="assign-item" onClick={() => jumpToSection(section.letter)}>
                      <span className="letter">{section.letter}</span> {section.title}
                      <span className="jump-count">
                        {done}/{section.questions.length}
                      </span>
                    </button>
                  )
                })}
          </div>
        </Modal>
      )}

      {/* Assign-photo modal */}
      {assigningPhoto && (
        <Modal
          title={
            unassigned.length > 1
              ? `Where does this photo belong? (${unassigned.length} to assign)`
              : 'Where does this photo belong?'
          }
          onClose={() => setAssigningPhoto(null)}
        >
          <PhotoThumb blob={assigningPhoto.blob} className="assign-preview" />
          <div className="assign-search">
            <input
              type="search"
              value={assignQuery}
              placeholder="Search questions…"
              aria-label="Search questions to assign"
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
        </Modal>
      )}

      {/* Photo viewer */}
      {viewingPhoto && (
        <Modal
          title="Photo"
          onClose={() => {
            flushCaption()
            setViewingPhoto(null)
          }}
        >
          <div className="viewer">
            <PhotoThumb blob={viewingPhoto.blob} />
            <div className="field" style={{ marginTop: 12 }}>
              <label>Caption (printed in the reports)</label>
              <input
                defaultValue={viewingPhoto.caption}
                placeholder="e.g. Blocked fire exit, Block B"
                onChange={(e) => {
                  if (viewingPhoto.id) setCaption(viewingPhoto.id, e.target.value)
                }}
              />
            </div>
            <div className="btn-row">
              <button
                className="btn"
                onClick={() => {
                  flushCaption()
                  const p = viewingPhoto
                  setViewingPhoto(null)
                  setAssigningPhoto(p)
                }}
              >
                Move / reassign
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  // flush first so Undo restores the latest caption
                  flushCaption()
                  void deletePhoto(viewingPhoto)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
