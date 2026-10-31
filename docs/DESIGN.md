# WW Co-pilot design rules

The look is "night shift": dark, calm, Spotify-inspired. Big covers, few words, one green
action per screen. These rules keep new screens consistent.

## Surfaces and colour
- One dark ladder, depth by lightness (no borders, no frosted glass):
  `--bg #121212` → `--elev #181818` → `--card #1f1f1f` → `--press #2a2a2a` → sheets `--sheet #242424`.
- Text `#fff`, secondary `--muted #b3b3b3`, hints `--faint #7c7c7c`.
- **Green (`--brand`) = brand and the primary action only.** Text on green is dark (`--brand-ink`).
- Red / amber are status only (overdue / due soon), always with a word, never colour alone.
- Gradients live in the page header glow and in cover art (`src/lib/art.ts`), never behind body text.
  Each section has a fixed hue pair; records get a stable gradient from their name.

## Type
- One family: Figtree (bundled, works offline).
- Page titles 30px / 800, detail titles 26px / 800, section titles 20px / 800 (sentence case, no
  ALL-CAPS labels), body 16px, secondary 14px.

## Layout patterns
- **List** (Tickets, Contractors, Camps, Library, Users): `MediaRow` — cover, title, subtitle,
  status chip, ⋯. Rows sit on the background.
- **Detail** (ticket, contractor, camp): `AlbumHeader` — big cover, title, subtitle, meta chips,
  icon buttons, and one round green primary action (Close ✓, Score, Start inspection ▶).
- **Home**: greeting, one "Up next" hero (the only loud element), filter chips, 2-column cards.
- **Dashboard**: filter chips for the views, stat cards, "Needs attention" rows, charts in cards.
- Filters are pill chips; the selected chip is green. Month steppers are neutral.

## Navigation
- Bottom tab bar: Home · Tickets · Create · Dashboard · Library (Create hidden for viewers).
- The avatar (top-left on main screens) opens the profile drawer. Sub-screens show a round back
  button.

## Long-press
- Every list row and Home card supports long-press (450ms, haptic tick, the row lifts) and opens
  the quick-action sheet (`showActions`). Every row also has a ⋯ button with the same sheet.
- Actions are verb-first ("Close ticket", "Start inspection", "Copy number"). Edit actions are
  marked `edit: true` so viewers never see them. Destructive ones are red and confirmed by name.

## Motion
- Durations 100 / 150 / 200 / 300ms only; ease-out on enter, ease-in on exit; transform and
  opacity only; no bounce.
- Screens: forward slides 8px from the right, back from the left, tabs fade. Sheets rise 24px.
  Home cards stagger in (30ms steps, first 12).
- `prefers-reduced-motion` turns all of it off.

## Charts
- `--chart` and `--chart-2` are validated on the dark surface (dataviz validator: CVD ΔE ≥ 21,
  contrast ≥ 3:1). A legend appears for two series; a single series is named by its title.
