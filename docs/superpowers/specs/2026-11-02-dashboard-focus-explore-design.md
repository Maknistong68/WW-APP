# WW Co-pilot: Dashboard as Focus · Explore · Over time (with hold-to-drill pop-ups)

**Date:** 2026-11-02 · **Status:** chosen by the owner from six drawn options ("Option 6"), with
the owner's addition: **holding anything opens a drill-down pop-up with its numbers and a chart**.

## Why

The Dashboard stacked 14 blocks on the Tickets view (two rows of big numbers, seven bar lists that
all looked the same, three month charts, a money row and a ticket list) and 11 on the KPIs view.
Numbers had labels but no meaning, and nothing said where to go next. The owner asked for a simple,
uniform layout, built for a 360 px phone, with new pictures (not the old charts), where the user
always knows what they are looking at.

## The shape (every tab the same)

Unchanged: the title area (Dashboard · 3D · Export · avatar), the **Tickets | Accommodation |
KPIs** sub-tabs and the **‹ Month › All** row (All on Tickets only). The month and the view live
in the link as before (`?v=`, `?m=`); the chosen chips join them (`?x=` Explore, `?t=` Over time),
so Back and shared links keep the view.

Then three sections, in this order:

1. **Focus** — two to four big cards side by side, swiped across, with "1 of 3" in the heading
   (the Home "Start here" strip). Each card is one figure: a **ring** (a whole split into parts), a
   **meter** (a score against its target) or a **split** (a number with a thin two-part bar). Under
   the figure a legend or one line of meaning, and one green link ("See the 7 late ›").
   Tap the card: the link. **Hold the card: its pop-up** (below).
2. **Explore** — one card; a row of chips picks the breakdown; one picture at a time: ranked
   thin bars (8 px, top 6 then Other), rows, or the compare grid. Tap a bar or row: the list
   behind it. **Hold: its pop-up.** The heading says the month ("Explore · October").
3. **Over time** — one card; chips pick the series; one line chart (area, end label, the
   existing callout with **Open** / **Show month** on tap or scrub).

### Tickets

| Focus card | Figure | Legend / line | Link | Hold: pop-up |
|---|---|---|---|---|
| Open tickets | ring, open at month end (today on All) split 0–10 / 11–30 / over 30 days | the three counts | See the N late › | facts Opened · Closed · Days to close; spark open per week; actions Open tickets · Over 30 days · Opened · Closed |
| Closure | meter, closure % vs target 90 (KPI colours) | "23 closed · 18 opened" | Closed in October › | facts Closed · Opened · Days to close; spark closure % 6 months (guide 90); actions Closed · Opened · Closure KPI page |
| Money | split, SAR still owed (red when any), thin bar recovered / still owed | "SAR 142K recovered · 11 tickets with money" | Owed tickets › | facts Still owed · Recovered · Total; spark recovered per month; actions Owed · Recovered · All with money |

Explore chips: **By contractor** (default) · By issue · By category · D&C vs cases · By age ·
Money by contractor · Owed by age · Largest amounts (the top-5 ticket rows). Bars count the
month's opened tickets (all tickets on All) with workers as the detail; money chips show SAR.
Hold a bar: pop-up with facts Tickets · Workers · SAR, a spark of that slice per month (6 months),
and actions Open tickets (plus Open contractor · See trends for a contractor). Hold a ticket row:
the ticket menu.

Over time chips: **Open** (per week, the imported weekly history continued) · Opened · Closed ·
Recovered (SAR), the last three per month over 12 months with Open on tap.

### KPIs

| Focus card | Figure | Line | Link | Hold |
|---|---|---|---|---|
| Overall KPI | ring, average %, split on track / at risk / critical / no data (subjects) | counts | See the N critical › | facts Overall · Critical · On track; spark overall 6 months (guide 90); actions Overall KPI page · Compare contractors · Critical only |
| Submissions | meter, in ÷ total %, due colour (amber in the last week, red after the 15th, green when all in) | "Due 15 Nov · 4 missing" | Missing submissions › | facts In · Missing · Due; spark % in per month; actions Missing submissions · Submission KPI page |
| Audits | meter, findings closed out % (KPI colours) | "5 findings open · 2 overdue" | Close-outs › | facts Findings open · Overdue · Latest quarter score; spark quarter averages; actions Close-outs · Quarterly audits |
| Workers | split, total declared, thin bar formal / illegal | "0 illegal · 12 visas expiring" | Workers › | facts Illegal · Visas ≤30 days · Paid fees; spark workers per month; actions Workers · Not declared |

Explore chips: **Each KPI** (default; the nine rows with their counts line and %) · By contractor
(overall, worst first, status word) · Workers (per contractor, illegal as detail) · Quarterly audits
(one bar per quarter) · Compare (the worst-5 grid with "Open full grid ›"). Hold a KPI row: facts
On track · At risk · Critical, spark of that item's average, actions Open KPI page · Compare month
by month. Hold a contractor: the contractor pop-up (KPI spark). Hold a quarter: facts audited ·
average · findings, spark of quarter averages, action Open the quarter.

Over time chips: **Overall KPI** (guides 90 / 70, points in status colours, Show month) · Workers ·
Submissions % · Audit score.

### Accommodation

| Focus card | Figure | Line | Link | Hold |
|---|---|---|---|---|
| Camps | ring, active camps split up to date / due soon / expired (never inspected counts as expired) | counts | See the N to inspect › | facts Up to date · Due soon · Expired; spark inspections per month; actions Open camps · Expired · Due soon |
| Inspections | meter, average score of the month's inspections vs 90 | "4 inspections in October" | Audits › | facts Inspections · Avg score · Camps; spark avg score per month; actions Open audits · Open camps |

Explore chips: **To inspect** (default; expired and due camps, worst first) · Scores by camp
(latest score per camp, lowest first, KPI colours) · By contractor (camps per contractor, overdue as
detail). Hold a camp: the camp pop-up. Hold a contractor: the contractor pop-up.

Over time chips: **Inspections** · Avg score (guides 90 / 70).

## The pop-up

The existing long-press pop-up (`showActions`: spotlight, grows out of the held item, actions
ripple in) gains one optional block, `figure`, drawn between the key numbers and the actions. Every
Dashboard pop-up is built by one helper, `peekMenu`, from: a title and sub line, a cover tile in the
status tone, up to 3 facts, a spark (6–12 points, optional guide), an optional figure (a thin split
bar with its legend), and actions that navigate. Edit actions never appear here (read-only numbers).

## Rules kept

- Every number opens the list it counted: the same `ticketLink` filters as before, so the Tickets
  list shows the same chips. The KPI, Missing, Close-outs, Camps, Audits and Compare screens open
  with the month.
- Colour means status, with an icon and a word beside it. Ring parts and meters use the status
  tones; ranked bars use the chart hue; 2 px surface gaps between parts.
- One UI cards (26 px, hairline, group title outside), the floating tab bar, SESL motion: cards
  stagger in, rings and meters fill, bars sweep, numbers count up; reduced motion turns it all off.
- Viewers see the same page (it is read-only).

## Code

- `src/lib/focus.ts` — `focusCards(d, view, month, kpiMonth, today)`: the cards, their figures,
  links and pop-up contents (pure; tested).
- `src/lib/explore.ts` — `EXPLORE_CHIPS`, `exploreData(d, view, chip, …)`: the chip lists and what
  each chip shows (bars, rows, tickets, grid), with each item's link and pop-up (pure; tested).
- `src/lib/overTime.ts` — `OVER_TIME_CHIPS`, `overTimeSeries(…)`: one series per chip (tested).
- `src/lib/peek.ts` — `ticketPeek`: facts, spark and age split for any set of tickets (tested).
- `src/components/charts/Ring.tsx`, `Meter.tsx`, `SplitBar.tsx`, `RankBars.tsx` — the new figures.
  `TrendLine` gains a `format` for SAR.
- `src/components/dash/FocusStrip.tsx`, `ExploreCard.tsx`, `OverTimeCard.tsx`, `Chips.tsx`.
- `src/components/ActionSheet.tsx` — `figure`; `src/components/menus.tsx` — `peekMenu`.
- `src/pages/DashboardPage.tsx` — the three sections per view; `src/styles/dash.css`.
- `BarList`, `MonthBars` and the KPI table leave the Dashboard (other screens keep what they use).

## Build order

1. Libs with tests (focus, explore, overTime, peek). 2. Figures (Ring, Meter, SplitBar,
RankBars, TrendLine format). 3. Pop-up figure + `peekMenu`. 4. Dashboard sections and page.
5. Styles, motion, dark. 6. `npm test`, `npm run build`, docs (`DESIGN.md`, `CLAUDE.md`), push to
the working branch and fast-forward production.
