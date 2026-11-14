import { useState } from 'react'
import type { ComplianceAssessment, Photo, Question, QuestionResponse } from '../types'
import Icon, { type IconName } from './Icon'
import PhotoThumb from './PhotoThumb'
import VoiceTextarea from './VoiceTextarea'

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
}: {
  question: Question
  resp: QuestionResponse
  photos: Photo[]
  /** The question's ready comments for a finding. */
  comments: string[]
  flash: boolean
  onAnswer: (value: ComplianceAssessment) => void
  onPatch: (patch: Partial<QuestionResponse>) => void
  onCamera: () => void
  onGallery: () => void
  onViewPhoto: (p: Photo) => void
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const a = resp.assessment
  const finding = a === 'No compliance'
  const open = finding || a === 'Partial compliance' || noteOpen || photos.length > 0 || !!resp.observation || !!resp.actionPlan
  return (
    <div id={`item-${question.code}`} className={`item audit-q${flash ? ' flash' : ''}`}>
      <div className="item-text">
        <b className="qcode">{question.code}</b> {question.text}
      </div>
      <div className="result-btns audit-answers" role="group" aria-label={`Answer ${question.code}`}>
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" className={a === o.value ? o.cls : ''} aria-pressed={a === o.value} onClick={() => onAnswer(a === o.value ? '' : o.value)}>
            <Icon name={o.icon} size={22} fill={a === o.value} />
            {o.label}
          </button>
        ))}
      </div>
      {open ? (
        <div className="item-details audit-finding">
          {comments.length > 0 && (finding || a === 'Partial compliance') && (
            <>
              <div className="control-label">{finding ? 'Finding: pick a comment' : 'Comment (optional)'}</div>
              <div className="obs-chips">
                {comments.map((c) => {
                  const on = resp.observation === c || resp.observation.startsWith(`${c} `)
                  return (
                    <button key={c} type="button" className={`obs-chip${on ? ' obs-chip-on' : ''}`} onClick={() => onPatch({ observation: on ? '' : c })}>
                      {on ? '✓ ' : ''}
                      {c}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor={`obs-${question.code}`}>Comment for the report</label>
            <VoiceTextarea
              id={`obs-${question.code}`}
              value={resp.observation}
              placeholder="Pick a comment above, or say what you found. No worker names or ID numbers."
              onChange={(observation) => onPatch({ observation })}
            />
          </div>
          <div className="field">
            <label htmlFor={`note-${question.code}`}>Note / action (optional)</label>
            <VoiceTextarea
              id={`note-${question.code}`}
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
