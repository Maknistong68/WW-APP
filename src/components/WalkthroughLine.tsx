import {
  assessmentToWalkStatus,
  type Photo,
  type Question,
  type QuestionResponse,
  type WalkStatus,
  type WalkthroughLine as Line,
} from '../types'
import PhotoThumb from './PhotoThumb'
import VoiceTextarea from './VoiceTextarea'

const STATUS_LABEL: Record<WalkStatus, string> = {
  ok: '✓ OK',
  partial: '◐ Partial',
  obs: '✗ OBS',
  na: 'N/A',
}
const STATUS_CLASS: Record<WalkStatus, string> = {
  ok: 'sel-full',
  partial: 'sel-partial',
  obs: 'sel-none',
  na: 'sel-na',
}

/** Aggregate status of a line's mapped questions. */
export function lineStatus(
  codes: string[],
  responses: Record<string, QuestionResponse>,
): WalkStatus | 'none' | 'mixed' {
  const statuses = codes.map((c) => assessmentToWalkStatus(responses[c]?.assessment ?? ''))
  if (statuses.every((s) => s === null)) return 'none'
  const first = statuses[0]
  if (first !== null && statuses.every((s) => s === first)) return first
  return 'mixed'
}

export default function WalkthroughLine({
  line,
  id,
  questions,
  responses,
  photos,
  expanded,
  flash,
  onStatus,
  onToggleExpand,
  onPatchPrimary,
  onCamera,
  onGallery,
  onViewPhoto,
}: {
  line: Line
  id: string
  /** Full question objects for line.codes, in order. */
  questions: Question[]
  responses: Record<string, QuestionResponse>
  photos: Photo[]
  expanded: boolean
  flash: boolean
  onStatus: (status: WalkStatus) => void
  onToggleExpand: () => void
  onPatchPrimary: (patch: Partial<QuestionResponse>) => void
  onCamera: () => void
  onGallery: () => void
  onViewPhoto: (p: Photo) => void
}) {
  const status = lineStatus(line.codes, responses)
  const primary = responses[line.codes[0]]
  const showDetails =
    expanded || status === 'obs' || status === 'partial' || photos.length > 0 || !!primary?.observation

  return (
    <div id={id} className={`item wline${flash ? ' flash' : ''}`}>
      <button className="wline-head" onClick={onToggleExpand}>
        <span className="wline-label">{line.label}</span>
        <span className="wline-codes">
          {line.codes.join(' · ')}
          {status === 'mixed' && <span className="badge draft" style={{ marginLeft: 6 }}>mixed</span>}
        </span>
      </button>
      <div className="result-btns">
        {(Object.keys(STATUS_LABEL) as WalkStatus[]).map((s) => (
          <button
            key={s}
            className={status === s ? STATUS_CLASS[s] : ''}
            onClick={() => onStatus(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {showDetails && (
        <div className="item-details">
          <div className="wline-questions">
            {questions.map((q) => (
              <div key={q.code} className="wline-q">
                <b className="qcode">{q.code}</b> {q.text}
              </div>
            ))}
          </div>
          <div className="field">
            <label>Observation</label>
            <VoiceTextarea
              value={primary?.observation ?? ''}
              placeholder="What did you observe? Type or tap 🎤 to dictate."
              onChange={(observation) => onPatchPrimary({ observation })}
            />
          </div>
          <div className="field">
            <label>Action plan / remarks</label>
            <VoiceTextarea
              value={primary?.actionPlan ?? ''}
              placeholder="What must be done, by whom, by when?"
              onChange={(actionPlan) => onPatchPrimary({ actionPlan })}
            />
          </div>
          <div className="photo-row">
            {photos.map((p) => (
              <PhotoThumb key={p.id} blob={p.blob} className="photo-thumb" onClick={() => onViewPhoto(p)} />
            ))}
            <button className="add-photo" title="Take photo" onClick={onCamera}>
              📷
            </button>
            <button className="add-photo" title="Choose from gallery" onClick={onGallery}>
              🖼
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
