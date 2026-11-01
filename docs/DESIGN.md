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

## 3D "Live site" (Dashboard → 3D)
A read-only, animated view of the project, in three.js via @react-three/fiber, loaded only when
opened. The model is in `src/lib/site.ts` and `src/lib/mapItems.ts` (pure, tested); the scene
is in `src/three/`.

- **The octagon** (80 tiles across) has two halves:
  - the **land half**, being built now;
  - the **floating city** on the sea half, not built yet: tinted, with a dashed border and a
    label, and nothing on it.

  Outside it is flat desert land: the highway, the workers' camp and the village.
- **Sites:** each contractor or work order has its own scope of works:
  - earthworks (Al Fahad 823), pipeline (PPCO), reservoir (Shapoorji);
  - nine buildings (SIBS + Al Fahad 882), culvert (Abyatona 1112), process plant (Thyssenkrupp);
  - roads (SAMA, RPCO), bridge (Abyatona 1134);
  - Coast Guard building (Al Fahad 1272), port (ECH), seawall + dredging (Archirodon).

  The catalog is `SITES`. Active work orders without a site are listed under "Not on the map".
- **Health bar:** the only number on the map. Each site office shows the month's overall KPI
  (full bar = 100%) in the status colours (green ≥ 90, amber 70–89, red < 70, grey no data).
  Tap a site or a bar to see the 8 items.
- **Look:**
  - chunky low-poly toy models in realistic colours;
  - scenery avoids the status hues, except the palms the Admin plants;
  - light theme = day, dark theme = night (lit windows, floodlights, highway lamps).
- **Motion:** sites pop in, bars fill with a spring, and machines work. Bounce is allowed inside
  the 3D scene only. Reduced motion freezes everything.
- **Edit map (Admins only):** ✎ opens the tools.
  - **Move:**
    - drag sites, roads, palms, camps and villages; things placed on a site are picked first;
    - drag a road's white dots to bend it;
    - Turn, Delete.
  - **Road:** tap points, then Finish; Small or Highway.
  - **Trees:** tap to plant, or Row for a line of palms.
  - **Camp / Village:** tap to place.
  - **Rules:**
    - sites may sit anywhere on land, inside or outside the octagon; land sites never in the sea;
    - coast sites slide along the coast;
    - Undo is per step, and Done saves everything for the team.
  - **Storage:** tables `sitePlaces` / `site_places` and `mapItems` / `map_items`.
    - Every change is in the activity log.
    - RLS: read = approved users, write = `private.is_admin()`.
- **Phones:** no shadow maps, fewer workers, no puffs or sparks, 30 fps when idle; check the
  budget with `#/dashboard/3d?stats`.
- **Failures:** no WebGL 2 → a message and a link to the 2D dashboard. If the first frame doesn't
  come within 10 s, a card says where it stopped.
