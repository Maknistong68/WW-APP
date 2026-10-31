# WW Co-pilot design rules — "field tool"

The app is used on site, often outdoors in strong sun, by people checking compliance. The design
is light by default, calm and status-first: big rounded cards, big icons on soft tinted tiles,
one green action per screen.

## Theme
- **Light by default**, dark when the phone is dark. Settings → Appearance: Auto / Light / Dark
  (`src/lib/theme.ts`, stored in `ww.theme`, applied before the first paint).
- Tokens live in `src/styles/tokens.css` (one light block, one dark block). Never hard-code
  colours in components.

## Colour means status (and nothing else)

| Tone | Meaning | Use |
|---|---|---|
| `bad` (red) | overdue / non-compliant / missing | tickets > 30 days, expired camps, missing items |
| `warn` (amber) | due soon / partial | tickets 11–30 days, camps due in 14 days |
| `good` (green) | done / on track | closed out, entered, KPI ≥ 90% |
| `none` (grey) | no data / closed / neutral | closed tickets, inactive records |
| `info` (blue) | to do, no deadline yet | neutral list items, Create tiles |

- `src/lib/tone.ts` decides the tone for tickets, KPIs, camps, close-outs and Home items. Use
  it; don't invent new rules in a screen.
- Status is always **icon + word** (`StatusChip`), never colour alone.
- **Brand green is the one interactive accent:** the primary button, the active tab, the Create
  button, links and focus.
- All text pairs are ≥ 4.5:1 in both themes. Chart colours are validated with the dataviz
  checker on `#ffffff` and `#1a211e`.

## Shape and size
- **Cards:** 22px radius, 1px subtle border, soft shadow (alpha < 0.08) in light; border plus a
  top edge highlight in dark. No frosted glass, no gradients.
- **Icon tiles** (`IconTile`): 52px in lists, 64px on Home, Library and summaries; filled
  Phosphor icon in the tone colour on its tint.
- **Touch targets:** rows ≥ 76px, buttons ≥ 52px, inspection answers 56px, chips 44px.
- **Type:** Figtree (bundled). Page title 30/800, card title 18/800, numbers 30–34/800 tabular,
  body 16–17, meta 14 (never below 13). Sentence case, no ALL-CAPS labels.

## Building blocks (`src/components/`)
- **`CardList` + `ItemRow`:** every list. A rounded card with hairlines, tile + title + meta
  (+ status chip) + ⋯. Long-press or ⋯ opens the quick actions (`showActions`).
- **`BigCard`:** Home "Today" items and the Library grid.
- **`StatCard`:** headline numbers; can act as a filter.
- **`Summary`:** top of every detail screen: tile, title, chips and a 2×2 fact grid.
- **`ActionBar`:** pinned bottom bar on detail and form screens with one full-width green action
  (Close ticket, Score month, Start inspection, Save). It hides the tab bar.
- **`TabBar`:** Home · Tickets · **Create** (raised green circle) · Dashboard · Library. Hidden
  while inspecting.

## Screens
- **Today (Home):** three stat cards (Overdue / Due soon / Done), then sections of big cards in
  that order; Done is collapsed.
- **Tickets:** grouped by age ("Over 30 days", "11–30 days", "0–10 days"), closed tickets by
  month.
- **Inspection:**
  - one card per walkthrough line or question;
  - answers as big icon + word buttons (OK / Partial / OBS / N/A; Yes / No / N/A);
  - area and section tiles coloured by progress: red = something flagged, amber = started,
    green = done, grey = untouched.

## Long-press
- 450ms hold → haptic tick, the row presses in, then a sheet with verb-first actions.
- Edit actions are hidden from viewers. Destructive actions are red and confirmed by name.

## Motion
- 100 / 150 / 200 / 300ms only; ease-out in, ease-in out; transform and opacity only; no
  bounce.
- Screens slide 8px (forward / back) or fade (tabs). Sheets and the action bar rise; Home cards
  stagger in.
- `prefers-reduced-motion` switches it all off.
