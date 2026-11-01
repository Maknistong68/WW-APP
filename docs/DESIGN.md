# WW Co-pilot design rules: "field tool" in Samsung One UI 9 style

The app is used on site, often outdoors in strong sun, by people checking compliance. It looks
and moves like a stock Galaxy app (One UI 9). It is light by default and status-first: a tall
title area within thumb reach, rounded grouped cards, a floating tab bar, and one green action
per screen.

## Theme
- **Light by default, true-black dark** when the phone is dark. Settings → Appearance:
  Auto / Light / Dark.
  - Code: `src/lib/theme.ts`, stored in `ww.theme`.
  - `<html data-theme>` always holds the resolved theme. `public/theme-boot.js` sets it before
    the first paint (the CSP allows no inline scripts).
- **Tokens** live in `src/styles/tokens.css`: one light block, one `[data-theme='dark']` block.
  Never hard-code colours in components.
- **Surfaces:**

  | Surface | Light | Dark |
  |---|---|---|
  | Page `--bg` | `#f3f4f6` | `#000` |
  | Cards `--card` | `#fff` | `#1c1c1e` |
  | Sheets `--sheet` | – | `#232325` |
  | Cards in sheets `--card-on-sheet` | – | `#2c2c2e` |
- **Font:** the phone's own font (`system-ui`, Samsung's font on Galaxy phones). The 3D labels
  keep the bundled Figtree.
- **Accent:** one block (`--accent*`, aliased as `--brand*`). It is brand green. Switching to
  One UI blue is a token swap (`#0a6bd6` with white ink in light, `#3e91ff` with dark ink in
  dark), but blue is also the "to do" status colour.

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
- **The accent (green) is the one interactive colour:** primary buttons, the selected tab, the
  Create button, links, switches and focus.
- **Contrast:**
  - all text pairs are ≥ 4.5:1 in both themes, including on sheets;
  - chart colours pass the dataviz validator on `#ffffff` and `#1c1c1e`: `--chart` / `--chart-2`
    are `#137a3a` / `#1d5fd1` in light and `#2fa84f` / `#3987e5` in dark.

## Shape and size
- **Cards:** 26px radius, 1px hairline border, no shadow. A list's title sits *outside* its card,
  like One UI group titles (`CardList`: `.clist-head` + `.clist-body`).
- **Floating panels** (sheets, dialogs, drawer, action sheet): 28px radius, 10–12px from the
  screen edges, soft shadow.
- **Pill shapes:** buttons, search fields, filter chips and the tab bar. Fields are filled
  (white on grey), with a green outline on focus.
- **Icon tiles** (`IconTile`): squircle-ish, 52px in lists and 64px on Home / Library; a filled
  Phosphor icon in the tone colour on its tint.
- **Rows:** dividers are inset and start after the tile. The "more" icon is ⋮ (vertical).
- **On/off:** a One UI switch, i.e. `input[type=checkbox][role=switch]`.
- **Touch targets:** rows ≥ 76px, buttons ≥ 52px, inspection answers 56px, chips 40–44px.
- **Type:**

  | Text | Size / weight |
  |---|---|
  | Large title | 34/700 (28/700 on detail screens) |
  | Toolbar title | 19/700 |
  | Card title | 17–18/700 |
  | Row | 17/500–600 |
  | Meta | 14–15/500 |
  | Numbers | 28–32/700, tabular |

  Never below 13. Sentence case, no ALL-CAPS labels.

## Chrome
- **Expandable app bar** (`Page`):
  - main screens open with a tall title area, about a quarter of the screen
    (`clamp(112px, 18svh, 190px)`; detail screens `clamp(88px, 12svh, 140px)`);
  - the big title sits low, with an optional `subtitle` (Today shows the date);
  - the toolbar row underneath holds Back or the avatar, the actions, and the small title;
  - scrolling collapses the area into that toolbar, which pins with a blurred background;
  - stopping halfway snaps it open or shut;
  - there is no title area in landscape or below 640px height;
  - `album` screens (their own summary card) have no title area, and the small title fades in
    on scroll.
- **Tab bar:**
  - a floating, blurred pill holds Home · Tickets · Dashboard · Library, with a green highlight
    that slides (a gentle spring) to the selected tab;
  - the round green **+ Create** button sits beside it, for editors only;
  - both slide away while you scroll down and return when you scroll up or reach the top or end;
  - tapping the selected tab scrolls to the top;
  - hidden while inspecting, in 3D, and when a screen shows an `ActionBar`.
- **`ActionBar`:** a floating, blurred panel on detail and form screens with one green pill
  action (Close ticket, Score month, Start inspection, Save) and up to two round icon buttons.
- **Glass:** blur (`--blur: 20px` on an almost solid fill) is allowed **only** on floating chrome:
  the pinned toolbar, the tab pill, the Create button, the action bar, inspection headers and
  small FABs. Never on cards, sheets, dialogs or content. Low-end phones (`html[data-lite]`),
  "reduce transparency" and browsers without `backdrop-filter` get the same bars, solid.
- **Back:** use `useGoBack()` from `src/lib/nav.ts`. It goes back in history when the previous
  screen is the target (so its scroll returns), otherwise it opens the target as a "back" move.

## Screens
- **Today (Home):** three stat cards (Overdue / Due soon / Done), then sections of big cards in
  that order; Done is collapsed.
- **Tickets:** grouped by age ("Over 30 days", "11–30 days", "0–10 days"), closed tickets by
  month.
- **Dashboard:** views as a One UI sub-tab track, a month stepper, hero numbers, then charts.
- **Inspection:**
  - one card per walkthrough line or question;
  - answers as big icon + word buttons (OK / Partial / OBS / N/A; Yes / No / N/A);
  - area and section tiles coloured by progress: red = something flagged, amber = started,
    green = done, grey = untouched.

## Long-press
- A 450ms hold gives a haptic tick, the row presses in, then a floating sheet opens with
  verb-first actions.
- Edit actions are hidden from viewers. Destructive actions are red and confirmed in a dialog.

## Motion (One UI)
- **Curves** are Samsung's SESL interpolators:
  - `--ease-90` = `cubic-bezier(.33,0,.1,1)`: moves and entrances;
  - `--ease-80` = `cubic-bezier(.33,0,.2,1)`: settles and colour;
  - `--ease-70` = `cubic-bezier(.33,0,.3,1)`;
  - `--ease-exit` for leaving.
- **Durations:** press 100 · fast 150 · med 250 · in 350 · out 200 · page 400 · chart 600 (ms).
- **Properties:** animate transform and opacity only (plus a dim on screen snapshots).
- **Bounce:** none, except the tab highlight's gentle spring and the 3D scene.
- **Screens** (`src/components/RouteTransition.tsx`, View Transitions API):
  - opening a screen slides it in from the right while the old one drifts 25% left and dims;
  - Back reverses that, and tabs fade through;
  - redirects fade, and a search-only change (Dashboard views) doesn't move;
  - the tab bar, Create button and toast stay put, and slide in or out when only one side of
    the move has them;
  - new screens open at the top; Back and tab switches return to where you were;
  - never animated into or out of 3D, or after the browser's own back-swipe animation;
  - without View Transitions, screens fade in.
- **Overlays** animate in *and* out:
  - sheets close with a slide on backdrop tap, ×, Escape, a drag down, and after Save;
  - from code, call `ref.close(then)` on `Modal`;
  - the drawer closes before navigating;
  - toasts rise in and sink out.
- **Press:** controls (cards, buttons, chips, answers) press in to 0.97; rows and menu items only
  highlight.
- **Entry:**
  - cards stagger in (not on Back);
  - numbers count up (`CountUp`: from 0 the first time, from the old value on change, not on
    Back);
  - the trend line draws in, month bars grow, bar fills and progress bars sweep, and the KPI
    ring fills.
- **Reduced motion** (`prefers-reduced-motion`) turns it all off: screen changes are instant and
  numbers appear at once.

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
- **Screen motion:** no screen transition into or out of 3D, and no blur on its controls (they
  float over a moving canvas).
- **Failures:** no WebGL 2 → a message and a link to the 2D dashboard. If the first frame doesn't
  come within 10 s, a card says where it stopped.
