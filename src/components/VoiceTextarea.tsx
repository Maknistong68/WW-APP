import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// Minimal typing for the Web Speech API (not in all TS DOM libs).
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechResultEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((e: unknown) => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}
interface SpeechResultEventLike {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

const getRecognizer = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Textarea with a dictation (voice-to-text) button.
 * Spoken text is appended to whatever is already typed. Falls back to a
 * plain textarea when the browser has no speech recognition.
 */
export default function VoiceTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
}) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const baseRef = useRef('')
  const supported = getRecognizer() !== null

  useEffect(
    () => () => {
      recRef.current?.abort?.()
    },
    [],
  )

  const toggle = () => {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const Recognizer = getRecognizer()
    if (!Recognizer) return
    const rec = new Recognizer()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = true
    baseRef.current = value.trim() ? `${value.replace(/\s+$/, '')} ` : ''
    rec.onresult = (e) => {
      let spoken = ''
      for (let i = 0; i < e.results.length; i++) {
        spoken += e.results[i][0].transcript
      }
      onChange((baseRef.current + spoken).replace(/\s+$/, ''))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  return (
    <div className="voice-wrap">
      <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {supported && (
        <button
          type="button"
          className={`mic-btn${listening ? ' listening' : ''}`}
          title={listening ? 'Stop dictation' : 'Dictate'}
          onClick={toggle}
        >
          <Icon name={listening ? 'stop' : 'mic'} size={19} />
        </button>
      )}
      {listening && <div className="mic-hint">Listening… tap the stop button when done</div>}
    </div>
  )
}
