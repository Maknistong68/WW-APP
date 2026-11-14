import { useEffect, useRef, useState } from 'react'
import AuditQuestion from './AuditQuestion'
import Icon from './Icon'
import { isChecked } from '../lib/score'
import { reducedMotion } from '../lib/motion'
import { WALK_REMINDER } from '../templates/welfareWalk'
import { EMPTY_RESPONSE, type ComplianceAssessment, type Photo, type Question, type QuestionResponse } from '../types'

/**
 * The audit one question at a time, for walking around: the reminder and the
 * full question in large type, four big answers, and Full or N/A moves on by
 * itself. No or Partial keeps you there with the ready comments, a voice note
 * and the camera. Back / Next or swipe; Done goes back to the list at that
 * question. It answers through the same code as the list, so it saves and syncs
 * the same way.
 */
export default function AuditFocus({
  title,
  codes,
  start,
  questionByCode,
  responses,
  photosFor,
  commentsFor,
  onAnswer,
  onPatch,
  onCamera,
  onGallery,
  onViewPhoto,
  onClose,
}: {
  /** The place (or "All questions"). */
  title: string
  codes: string[]
  start: number
  questionByCode: Map<string, Question>
  responses: Record<string, QuestionResponse>
  photosFor: (code: string) => Photo[]
  commentsFor: (code: string) => string[]
  onAnswer: (code: string, value: ComplianceAssessment) => void
  onPatch: (code: string, patch: Partial<QuestionResponse>) => void
  onCamera: (code: string) => void
  onGallery: (code: string) => void
  onViewPhoto: (p: Photo) => void
  /** Closed at this question. */
  onClose: (code: string) => void
}) {
  const [i, setI] = useState(Math.min(Math.max(0, start), codes.length - 1))
  const bodyRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const code = codes[i]
  const question = questionByCode.get(code)
  const resp = responses[code] ?? EMPTY_RESPONSE
  const checked = codes.filter((c) => isChecked(responses[c])).length
  const last = i === codes.length - 1

  const go = (d: number) => setI((x) => Math.max(0, Math.min(codes.length - 1, x + d)))

  // a new question starts at its top
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [i])

  // the list behind stays put; Escape closes
  useEffect(() => {
    document.body.classList.add('focus-open')
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(codes[i])
    }
    window.addEventListener('keydown', key)
    return () => {
      document.body.classList.remove('focus-open')
      window.removeEventListener('keydown', key)
    }
  }, [codes, i, onClose])

  const answer = (value: ComplianceAssessment) => {
    onAnswer(code, value)
    // Full or N/A: on to the next one after a beat (so the tap is seen)
    if ((value === 'Full compliance' || value === 'N/A') && !last) {
      const at = i
      window.setTimeout(() => setI((x) => (x === at ? x + 1 : x)), reducedMotion() ? 0 : 260)
    }
  }

  if (!question) return null
  return (
    <div className="audit-focus" role="dialog" aria-modal="true" aria-label={`${title}, one question at a time`}>
      <div className="focus-top">
        <button type="button" className="round-btn" onClick={() => onClose(code)} aria-label="Done: back to the list">
          <Icon name="x" size={24} />
        </button>
        <div className="focus-title">
          <b>{title}</b>
          <span>
            {i + 1} of {codes.length} · {checked} checked
          </span>
        </div>
      </div>
      <div className="focus-bar" aria-hidden="true">
        <div style={{ transform: `scaleX(${(i + 1) / codes.length})` }} />
      </div>
      <div
        ref={bodyRef}
        className="focus-body"
        onTouchStart={(e) => {
          const t = e.touches[0]
          touch.current = { x: t.clientX, y: t.clientY }
        }}
        onTouchEnd={(e) => {
          const from = touch.current
          touch.current = null
          if (!from) return
          const t = e.changedTouches[0]
          const dx = t.clientX - from.x
          const dy = t.clientY - from.y
          // a sideways swipe (not a scroll, not on a text box)
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && !(e.target as HTMLElement).closest('textarea, input')) go(dx < 0 ? 1 : -1)
        }}
      >
        <AuditQuestion
          key={code}
          focus
          question={question}
          resp={resp}
          reminder={WALK_REMINDER.get(code)}
          photos={photosFor(code)}
          comments={commentsFor(code)}
          flash={false}
          onAnswer={answer}
          onPatch={(patch) => onPatch(code, patch)}
          onCamera={() => onCamera(code)}
          onGallery={() => onGallery(code)}
          onViewPhoto={onViewPhoto}
        />
        {resp.preset && resp.assessment === 'Full compliance' && <p className="note focus-preset">Starts as Full, like the Excel. Tap Full to confirm, or pick another answer.</p>}
      </div>
      <div className="focus-nav">
        <button type="button" className="btn" disabled={i === 0} onClick={() => go(-1)}>
          <Icon name="chevron-left" size={20} /> Back
        </button>
        <button type="button" className="btn primary" onClick={() => (last ? onClose(code) : go(1))}>
          {last ? 'Done' : 'Next'} <Icon name={last ? 'check' : 'chevron-right'} size={20} />
        </button>
      </div>
    </div>
  )
}
