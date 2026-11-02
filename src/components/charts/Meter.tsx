import type { Tone } from '../../lib/tone'

/**
 * A score against its limit: the fill carries the status colour, the track is
 * a lighter step of the same colour, and a tick marks the target.
 */
export default function Meter({ pct, tone, target, label }: { pct: number | null; tone: Tone; target?: number; label: string }) {
  const w = pct === null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <div className={`meter ${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct === null ? undefined : Math.round(pct)} aria-label={label}>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${w}%` }} />
        {target !== undefined && <i className="meter-tick" style={{ left: `${target}%` }} />}
      </div>
      <div className="meter-scale">
        <span>0</span>
        {target !== undefined && (
          <span className="meter-target" style={{ left: `${target}%` }}>
            Target {target}%
          </span>
        )}
        <span>100</span>
      </div>
    </div>
  )
}
