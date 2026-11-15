import { useState } from 'react'
import type { ComplianceAssessment, Photo, Question, QuestionResponse } from '../types'
import Icon, { type IconName } from './Icon'
import PhotoThumb from './PhotoThumb'
import VoiceTextarea from './VoiceTextarea'
import type { Findings } from '../templates/welfareFindings'

// One Worker Welfare audit question, made for a phone: the question in full,
// one row of four big answers (Full / Partial / No / N/A). A "No" opens the
// finding right there: the question's ready comments, a note, and the camera,
// with its photos in a strip that scrolls sideways (never on top of anything).

const OPTIONS: { value: ComplianceAssessment; label: string; icon: IconName; cls: string }[] = [
  { value: 'Full compliance', label: 'Full', icon: 'check-circle', cls: 'sel-full' },
  { value: 'Partial compliance', label: 'Partial', icon: 'half', cls: 'sel-partial' },
  { value: 'No compliance', label: 'No', icon: 'x-circle', cls: 'sel-none' },
  { value: 'N/A', label: 'N/A', icon: 'minus-circle', cls: 'sel-na' },
]

export default function AuditQuestion({
  question,
  resp,
  photos,
  comments,
  flash,
  onAnswer,
  onPatch,
  onCamera,
  onGallery,
  onViewPhoto,
  reminder,
  focus,
  findings,
}: {
  question: Question
  resp: QuestionResponse
  photos: Photo[]
  /** The client's own short comments for this question (from the Excel). */
  comments: string[]
  /** Researched findings for this question: 3 for No, 2 for Partial (shown first). */
  findings?: Findings
  flash: boolean
  onAnswer: (value: ComplianceAssessment) => void
  onPatch: (patch: Partial<QuestionResponse>) => void
  onCamera: () => void
  onGallery: () => void
  onViewPhoto: (p: Photo) => void
  /** Walk view: the question's short reminder, shown first (the full question under it). */
  reminder?: string
  /** The one-at-a-time screen: large, always open, its own ids. */
  focus?: boolean
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [fullText, setFullText] = useState(false)
  const id = (what: string) => `${focus ? 'focus-' : ''}${what}-${question.code}`
  // the researched findings for this answer first (No: not in place, Partial: partly), then the checklist's own
  const ready = resp.assessment === 'No compliance' ? (findings?.no ?? []) : resp.assessment === 'Partial compliance' ? (findings?.partial ?? []) : []
  const chip = (c: string) => {
    const on = resp.observation === c || resp.observation.startsWith(`${c} `)
    return (
      <button key={c} type="button" className={`obs-chip${on ? ' obs-chip-on' : ''}`} onClick={() => onPatch({ observation: on ? '' : c })}>
        {on ? '✓ ' : ''}
        {c}
      </button>
    )
  }
  const a = resp.assessment
  /** Still the Full it started with (like the client's Excel): tapping Full confirms it. */
  const preset = !!resp.preset && a === 'Full compliance'
  const finding = a === 'No compliance'
  const open = finding || a === 'Partial compliance' || noteOpen || photos.length > 0 || !!resp.observation || !!resp.actionPlan
  return (
    <div id={id('item')} className={`item audit-q${flash ? ' flash' : ''}${focus ? ' focus' : ''}`}>
      {reminder ? (
        <>
          <div className="item-text audit-reminder">
            <b className="qcode">{question.code}</b> {reminder}
          </div>
          {/* the full question: two lines while walking, all of it on a tap (always all on the one-at-a-time screen) */}
          <button type="button" className={`audit-full${fullText || focus ? ' open' : ''}`} onClick={() => setFullText((x) => !x)} aria-expanded={fullText || focus}>
            {question.text}
          </button>
        </>
      ) : (
        <div className="item-text">
          <b className="qcode">{question.code}</b> {question.text}
        </div>
      )}
      <div className="result-btns audit-answers" role="group" aria-label={`Answer ${question.code}`}>
        {OPTIONS.map((o) => {
          const isPreset = preset && o.value === 'Full compliance'
          return (
            <button
              key={o.value}
              type="button"
              className={isPreset ? 'sel-preset' : a === o.value ? o.cls : ''}
              aria-pressed={a === o.value}
              aria-label={isPreset ? 'Full (starts as Full: tap to confirm)' : undefined}
              onClick={() => onAnswer(isPreset ? o.value : a === o.value ? '' : o.value)}
            >
              <Icon name={o.icon} size={22} fill={a === o.value && !isPreset} />
              {o.label}
            </button>
          )
        })}
      </div>
      {open ? (
        <div className="item-details audit-finding">
          {(finding || a === 'Partial compliance') && (ready.length > 0 || comments.length > 0) && (
            <>
              <div className="control-label">{finding ? 'Finding: pick a comment' : 'Comment (optional)'}</div>
              {ready.length > 0 && <div className="obs-chips">{ready.map(chip)}</div>}
              {comments.length > 0 && (
                <>
                  <div className="control-label checklist-label">From the checklist</div>
                  <div className="obs-chips">{comments.map(chip)}</div>
                </>
              )}
            </>
          )}
          <div className="field">
            <label htmlFor={id('obs')}>Comment for the report</label>
            <VoiceTextarea
              id={id('obs')}
              value={resp.observation}
              placeholder="Pick a comment above, or say what you found. No worker names or ID numbers."
              onChange={(observation) => onPatch({ observation })}
            />
          </div>
          <div className="field">
            <label htmlFor={id('note')}>Note / action (optional)</label>
            <VoiceTextarea
              id={id('note')}
              value={resp.actionPlan}
              placeholder="What must be done, by whom, by when?"
              onChange={(actionPlan) => onPatch({ actionPlan })}
            />
          </div>
          <div className="audit-photos" aria-label="Photos">
            <button type="button" className="add-photo" title="Take photo" aria-label={`Take a photo for ${question.code}`} onClick={onCamera}>
              <Icon name="camera" size={26} />
            </button>
            <button type="button" className="add-photo" title="Choose from gallery" aria-label={`Add photos for ${question.code} from the gallery`} onClick={onGallery}>
              <Icon name="image" size={26} />
            </button>
            {photos.map((p) => (
              <PhotoThumb key={p.id} blob={p.blob} className="photo-thumb" onClick={() => onViewPhoto(p)} />
            ))}
          </div>
          {finding && !resp.observation.trim() && <p className="audit-warn">A “No” needs a comment: it goes in the report’s findings.</p>}
        </div>
      ) : (
        a !== '' && (
          <button type="button" className="details-toggle" onClick={() => setNoteOpen(true)}>
            <Icon name="plus" size={16} /> Add a note or photo
          </button>
        )
      )}
    </div>
  )
}
