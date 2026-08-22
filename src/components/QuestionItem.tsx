import {
  ASSESSMENT_OPTIONS,
  YES_NO_OPTIONS,
  type ComplianceAssessment,
  type Photo,
  type Question,
  type QuestionResponse,
} from '../types'
import PhotoThumb from './PhotoThumb'
import VoiceTextarea from './VoiceTextarea'

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

export default function QuestionItem({
  question,
  resp,
  photos,
  detailsOpen,
  flash,
  onPatch,
  onOpenDetails,
  onCamera,
  onGallery,
  onViewPhoto,
}: {
  question: Question
  resp: QuestionResponse
  photos: Photo[]
  detailsOpen: boolean
  flash: boolean
  onPatch: (patch: Partial<QuestionResponse>) => void
  onOpenDetails: () => void
  onCamera: () => void
  onGallery: () => void
  onViewPhoto: (p: Photo) => void
}) {
  const showDetails =
    detailsOpen ||
    resp.assessment === 'No compliance' ||
    resp.assessment === 'Partial compliance' ||
    photos.length > 0 ||
    !!resp.observation ||
    !!resp.actionPlan

  return (
    <div id={`item-${question.code}`} className={`item${flash ? ' flash' : ''}`}>
      <div className="item-text">
        <b className="qcode">{question.code}</b> {question.text}
      </div>
      <div className="control-label">Yes / No / N-A</div>
      <div className="result-btns">
        {YES_NO_OPTIONS.map((opt) => (
          <button
            key={opt}
            className={resp.yesNo === opt ? `sel-yn-${opt === 'Yes' ? 'yes' : opt === 'No' ? 'no' : 'na'}` : ''}
            onClick={() => onPatch({ yesNo: resp.yesNo === opt ? '' : opt })}
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
            onClick={() => onPatch({ assessment: resp.assessment === opt ? '' : opt })}
          >
            {ASSESS_LABEL[opt]}
          </button>
        ))}
      </div>
      {showDetails ? (
        <div className="item-details">
          <div className="field">
            <label>Observation</label>
            <VoiceTextarea
              value={resp.observation}
              placeholder="What did you observe? Type or tap 🎤 to dictate."
              onChange={(observation) => onPatch({ observation })}
            />
          </div>
          <div className="field">
            <label>Action plan / remarks</label>
            <VoiceTextarea
              value={resp.actionPlan}
              placeholder="What must be done, by whom, by when?"
              onChange={(actionPlan) => onPatch({ actionPlan })}
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
      ) : (
        <button className="details-toggle" onClick={onOpenDetails}>
          + Add observation / photo
        </button>
      )}
    </div>
  )
}
