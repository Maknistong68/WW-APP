// Tap-to-add observation suggestions. Chips append/remove their phrase in the
// free-text observation (joined with '; '), so the stored value stays a plain
// string and exports, sync, and backups are untouched.
export default function ObservationChips({
  suggestions,
  value,
  onChange,
}: {
  suggestions: string[]
  value: string
  onChange: (next: string) => void
}) {
  if (suggestions.length === 0) return null
  const parts = value
    .split(/;\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  const selected = (s: string) => parts.includes(s)
  const toggle = (s: string) => {
    const next = selected(s) ? parts.filter((p) => p !== s) : [...parts, s]
    onChange(next.join('; '))
  }
  return (
    <div className="chip-row">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          className={`chip${selected(s) ? ' chip-on' : ''}`}
          onClick={() => toggle(s)}
        >
          {selected(s) ? '✓' : '+'} {s}
        </button>
      ))}
    </div>
  )
}
