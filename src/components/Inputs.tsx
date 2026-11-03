import { haptic } from '../lib/haptics'

// The number and yes/no inputs the KPI panels and Monthly entry share, so a
// value is read the same way everywhere.

/** A typed number: digits and one dot; blank (or not a number yet, like ".") = null. */
export const num = (v: string): number | null => {
  const t = v.replace(/[^\d.]/g, '')
  if (t === '') return null
  const n = Number(t)
  // "." or "1.2.3" is not a number yet: keep the field blank rather than NaN.
  return Number.isFinite(n) ? n : null
}

/** Whole counts (findings, workers): no decimals. */
export const count = (v: string): number | null => {
  const n = num(v)
  return n === null ? null : Math.floor(n)
}

/** A percentage, at most 100. */
export const pctOf = (v: string): number | null => {
  const n = num(v)
  return n === null ? null : Math.min(100, n)
}

/** A value as the field shows it ('' for none). */
export const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

/** A % row in a settings-style list. */
export function PctRow({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <input inputMode="decimal" placeholder="—" value={str(value)} onChange={(e) => onChange(pctOf(e.target.value))} />
      <span className="row-trail">%</span>
    </label>
  )
}

/** Yes / No buttons; tap the picked one again to clear it (not answered). */
export function YesNo({ label, value, onChange, noLabel = 'No' }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void; noLabel?: string }) {
  const pick = (v: boolean) => {
    haptic('tick')
    onChange(value === v ? null : v)
  }
  return (
    <span className="yesno" role="group" aria-label={label}>
      <button type="button" className={`tog yes${value === true ? ' on' : ''}`} aria-pressed={value === true} onClick={() => pick(true)}>
        Yes
      </button>
      <button type="button" className={`tog no${value === false ? ' on' : ''}`} aria-pressed={value === false} onClick={() => pick(false)}>
        {noLabel}
      </button>
    </span>
  )
}

/** A Yes / No row in a settings-style list. */
export function YesNoRow({ label, value, onChange, noLabel = 'No' }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void; noLabel?: string }) {
  return (
    <div className="row">
      <span className="row-main">{label}</span>
      <YesNo label={label} value={value} onChange={onChange} noLabel={noLabel} />
    </div>
  )
}
