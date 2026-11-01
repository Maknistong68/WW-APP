# WW Co-pilot: deeper UI plan (Home task list · contractor trends · drill-down · long-press)

**Date:** 2026-11-01 · **Status:** built and deployed (steps 0–5).

**Owner's follow-up:** "Choose by yourself; make it fun and easy: long-press, animations, pop-ups."
So the open questions were decided (7-day "This week", Watch card kept, menus as pop-ups that grow
out of the held item, swipe for the main action, a check-and-sparkle when things get done, a gentle
spring on pop-ups only), and a **Part E: Feel** layer was built first: hold-to-pop menus with a
spotlight and preview, haptics (`src/lib/haptics.ts`), swipe actions, the done check, chart
callouts with Open, and the number-to-chip morph. "Open" was dropped from menus (a tap already
opens). The live rules are in `docs/DESIGN.md`.

## Context

You said the app feels thin: long-press and drill-down are missing in many places, Home doesn't
show enough, and the Dashboard has no history (e.g. "tap a contractor → chart of its KPIs over
the months"). I had explorers walk every screen, then had the design checked against the code.

| Area | Today |
|---|---|
| **Home** | 11 cards that only show counts. Nothing is named, there are no due dates, and since 1 November October's real gaps have vanished: the due rule checks the wrong month. |
| **Dashboard** | 23 of its 34 big numbers look tappable but do nothing. Charts only show a tooltip. You can't open the tickets behind a bar. The month you picked is lost when you change screen. |
| **History** | None per contractor. The contractor page has no chart. The only trends are site-wide, months with no data are drawn as 0%, and a month at 100% stretches the axis to 200%. |
| **Long-press** | Only 9 menus, and they don't match. Ticket rows get a full menu on the Tickets tab but only Open/Copy elsewhere. Most camp, work-order, KPI and inspection rows have none. |
| **Dead ends** | Ticket → contractor, camp → contractor, and most activity-log rows can't be opened. |

**Your decisions:**
1. Home becomes a **named task list**.
2. **Due dates for a month's items:**
   - WPS, manpower and salary declarations: the **15th of the next month** (October → 15 Nov);
   - the other KPIs (accommodation, onboarding, offboarding, meeting, worker counts): the **end of
     the next month** (October → 30 Nov).
3. Home chases gaps from **October 2026** onwards. Older imported blanks never appear.
4. History first:
   - one contractor over time;
   - tickets, money and workers per contractor.

   The comparison heatmap and audit-score history wait.
5. **The due-date fix ships first**, then a **visual mockup page** for you to review, then the
   bigger phases.

**Approach:** improve the screens you already have, in phases that each ship and deploy on their
own. No new tab. I also considered a separate "Reports" tab, which splits contractor information
across two places, and rebuilding around contractors, which is too big a jump at once. I don't
recommend either.

The sketches below are rough; the mockup page shows the real look.

---

## Part A: Home, "what I must do", by name and date

The rule that keeps it short: **urgent things are named one by one; later things are grouped.**

```
Today                                         Sunday 1 November
October: declarations due 15 Nov · KPIs due 30 Nov
[ 2 Overdue ]   [ 3 This week ]   [ 19 Done ]          ← tap to filter

Overdue
 ▣ WWCMPL-1043         Open 34 days · RPCO · 12 workers
 ▣ Camp Duba 3         Inspection expired 5 days ago         Start
 ▣ +3 more tickets over 30 days                                  ›

This week
 ▣ SIBS · WO 1112      Audit close-out · 3 of 5 closed     due Wed
 ▣ WWCMPL-1088         Turns 30 days on Thu · SAMA
 ▣ Draft inspection    Camp Duba 1 · started yesterday    Continue

Later
 ▸ October declarations   9 work orders     due 15 Nov   (tap to open)
 ▸ October KPIs           11 work orders    due 30 Nov
 ▸ Quarterly audit        5 work orders     due 31 Dec

Watch          2 contractors below 70% · 4 visas expire ≤30 days · 1 paid fees
October progress  ▓▓▓▓▓▓▓░░░  31 of 52 entered
Show 19 done ▾
```

From 8 November the October declarations move to **This week**, one row per work order, e.g.
`RPCO · WO 882 · Oct: WPS, Salary missing · due 15 Nov`. From 16 November any still missing are
**Overdue**: `… 1d late`.

| Row | Overdue | This week | Tap (editor) | Tap (viewer) |
|---|---|---|---|---|
| **Declarations**, per WO per month: WPS, manpower, salary | after the 15th of next month | due within 7 days | that WO's KPI sheet for that month | the contractor |
| **Monthly KPIs**, per WO per month: accommodation, onboarding, offboarding, meeting, workers | after the end of next month | due within 7 days | KPI sheet (or Manpower) | the contractor |
| **Ticket**: one row each, up to 5, then "+N more" | over 30 days | turns 30 within 7 days | the ticket | the ticket |
| **Camp** | expired or never inspected | due within 7 days | Start inspection | the camp |
| **Audit close-out** | past its due date | due within 7 days | Update findings | the contractor |
| **Quarterly audit**: one grouped row | the quarter has ended | last 7 days of the quarter | missing list | missing list |
| **Draft inspection** | – | – | Continue | Open |
| **Watch line**: KPI < 70%, visas, illegal workers, paid recruitment fees | – | – | the list behind each | same |

- **Long-press on a row:** Fill in ✎, Open contractor, See trends, Copy as text, plus actions for
  that row type (Close ticket ✎, Start inspection ✎). The menu also shows the "what this means"
  help text.
- **Done** lists each work-order month that is fully entered, e.g. `RPCO · WO 882 · October all
  in`. The Done counter counts those.
- **Carry-over:**
  - gaps stay until they're filled, for up to 3 ended months back;
  - gaps older than that, back to October 2026, fold into one row: "N gaps in older months";
  - the current month never shows, because it isn't due yet.

---

## Part B: Trends, one contractor over time

**Where:** the contractor page gets two One UI sub-tabs: **This month | Trends**. ("History" is
already the change log at the bottom of that page, so this one is called Trends.) Every contractor
name or bar in the app can open it.

```
RPCO                                      [This month] [Trends]
[6 months] [1 year] [All]       [All WOs] [WO 882] [WO 1134]

 Overall now 84% ▲3     On track 7 of 12 months     Avg close 9 days

Overall KPI
100 ┤
 90 ┤┄┄┄┄┄┄┄┄┄┄┄┄┄●┄┄┄●┄┄   ← on-track line
 70 ┤┄┄┄●┄┄┄●┄┄●┄┄┄┄┄┄┄┄┄   ← critical line
    ┤ ●          (gap = no data, never 0%)
     Dec Jan … Oct Nov       tap a point → that month's values → "Open month"

Each KPI (sparkline · latest · status)
 Submission     ▁▃▅▇▇▇  100%  On track    ›
 Grievance      ▇▅▃▁▃▅   70%  At risk     ›   tap → this KPI for RPCO:
 Ticket closure ▃▃▅▅▇▇   92%  On track    ›   line + month table that
 …                                              explains each score

Tickets per month   opened vs closed            tap a month → those tickets
Money (SAR)         owed at month end · recovered per month
Workers             total · illegal · formal %
[Show as table]
```

- The range and work-order choice change every chart on the tab.
- Point colours are the status colours, and the tooltip names the status in words.
- Work orders that have since been switched off still appear in the months they were active.
- **One-contractor KPI page** (`/contractors/:id/kpi/:key`): a big line chart, plus a table by month
  showing what made each score. For example, Grievance shows the tickets closed and the average
  days to close.

---

## Part C: Drill-down, every number opens what's behind it

1. **Ticket filters in the link.** The Tickets screen accepts contractor, work order, month,
   opened/closed/open-at-month-end, issue, category, source and age, and shows them as removable
   chips: `Tickets  [RPCO ×] [Opened in Oct ×]`. A drill-down shows a Back button. The list
   always matches the number you tapped.
2. **Every big Dashboard number opens its list:**
   - Opened, Closed and Over 30 days → filtered tickets;
   - SAR owed → tickets with money owed;
   - Critical → contractors below 70%;
   - Illegal and Visas → work orders with those counts;
   - Expired and Due soon → filtered camps.
3. **Every bar and month opens:**
   - a contractor bar → that contractor's Trends;
   - an issue, category or source bar → those tickets;
   - a month bar or point → that month.
4. **Tappable looks tappable.** Live numbers get a small › and a pressed state. Plain numbers
   stay plain.
5. **The month travels with you.** The Dashboard, contractor and KPI screens keep the month in
   the link.
6. **Dead ends fixed:**
   - ticket → contractor and work order;
   - camp → contractor;
   - activity-log rows → camp, KPI month, inspection;
   - the close-out row for viewers;
   - the Overall KPI row.
7. **KPI detail page:** each contractor row gets a sparkline and its change from last month.
   On track and Critical filter the list.

## Part D: Long-press, one menu per record, everywhere

The menu header previews the record: key numbers and, for contractors, a 6-month sparkline.
✎ means editors only, and destructive actions are confirmed with the record's name.

| Record | Menu |
|---|---|
| Ticket | Open · Close ✎ (closes a combined group together) / Reopen ✎ · Edit ✎ · Open contractor · Open main ticket · Copy number · Delete ✎ |
| Contractor | Open · Trends · Tickets · Score a WO ✎ · Edit ✎ |
| Work order | Fill in this month ✎ · Manpower ✎ · Tickets · Trends · Open contractor · Turn off ✎ |
| Camp | Start inspection ✎ · Open · Open contractor · Edit ✎ |
| Inspection | Open · Repeat visit ✎ · Delete ✎ |
| KPI item | Open for this month · See trend |

You can also open the menu with ⋯, right-click and the keyboard menu key, not only by holding.

---

## Order of work

| Step | What you get | Size |
|---|---|---|
| **0. Due-date fix** | The 15th / end-of-next-month rules on today's Home cards, Needs attention, Missing submissions and the help text. The 100% axis no longer stretches to 200%, and no-data months are no longer drawn as 0%. | small |
| **Mockups** | A private page with phone-size mockups of Parts A–D. You comment, I adjust. No app code. | small |
| **1. Groundwork + long-press + drill-down** | Part D, Part C1, C4–C6, and the safety fixes listed below | medium ×3 |
| **2. Home task list** | Part A | large |
| **3. Contractor Trends** | Part B, plus the chart upgrades | large |
| **4. Dashboard drill-down** | Part C2, C3 and C7 | medium |

Every step runs `npm test` and `npm run build`. It is pushed to `claude/vigilant-hawking-vue3cm`
**and** fast-forwarded to `claude/welfare-inspection-app-vvl8of`, the production branch (CLAUDE.md
rule).

After you approve this plan:
1. save it as `docs/superpowers/specs/2026-11-01-ui-depth-design.md`;
2. build and deploy step 0;
3. publish the mockup page;
4. after your comments, write a detailed build plan for steps 1–4 (writing-plans skill).

---

## Technical design (for building)

**Step 0: due-date fix** (`src/lib/todo.ts`, `src/lib/attention.ts`, `src/pages/TodoPage.tsx` HELP,
`src/components/charts/MonthBars.tsx`, `src/pages/DashboardPage.tsx:145`, `src/pages/KpiDetailPage.tsx:24`)
- Add `declarationsDue(m) = <m+1>-15` and `kpisDue(m) = last day of m+1` to `src/lib/dates.ts`
  (or `todo.ts`).
- In `buildTodo`, the declaration and KPI cards look at the most recent ended month. They are
  amber within 7 days of the due date and red after it.
- `attention.ts:49` uses the same rule.
- Move `niceMax` to `src/lib/chartScale.ts` (so that `niceMax(100) === 100`).
- KPI trend series keep `null` for no data. MonthBars skips the bar, and the line skips the point.
- Tests: update `todo.test.ts:26-32`, and add `attention.test.ts` and `chartScale.test.ts`.

**Step 1: groundwork**
- **Speed:** add `src/lib/kpiIndex.ts`. It memoises lookups by subject and month and inspection
  scores (keyed on the `d.kpis` array plus a `WeakMap<Inspection, number|null>`), and is used inside
  `subjectKpi`, `auditPctFor` and `kpiForSubject`. The public signatures stay the same.
  Test: `kpiIndex.test.ts` (cached equals uncached).
- **Safety fixes found in the check:**
  - Saving a KPI or Manpower month reuses the existing row's uuid, looked up by the
    `[contractorUuid+workOrderUuid+month]` unique index (`db.ts:77-78`). Today two editors filling
    the same task hit a silent ConstraintError.
  - Closing a main ticket from a list closes its whole group, as the detail page already does.
  - Check how many audits are left as drafts before making `auditPctFor` (`kpiData.ts:63`) count
    completed inspections only. A half-filled draft feeds Accommodation today.
- **Sheets from anywhere:** add `src/components/SheetHost.tsx` with `openSheet({kind, uuid, …})` for
  ticket edit, close, close-group, delete, KPI and manpower.
  - It reads the record fresh with `db.*.get(uuid)` when the sheet opens, and closes when the route
    changes.
  - Mount it next to `ActionSheetHost` in `App.tsx`. A `NavBridge` inside the router lets menus
    navigate.
- **Menus:**
  - `src/lib/menuSpec.ts` is pure: action ids per record, role and state. Test:
    `menuSpec.test.ts`.
  - `src/components/menus.tsx` maps those ids to handlers.
  - Every list uses them: `TicketRow` (`TicketsPage.tsx:77,195`), contractor, camp, work order,
    inspection and KPI rows.
  - Labels are unique within a menu (`ActionSheet.tsx:110` keys buttons by label).
  - `ActionSheetSpec` gains an optional `facts` / `spark` peek.
- **Input parity:**
  - `useLongPress` opens the menu on right-click and the ContextMenu key.
  - Pressing Enter on the ⋯ in `ItemRow` stops bubbling to the row.
  - `BigCard` gets a wrapper so it can hold a ⋯ button.
- **Ticket filters:** `src/lib/ticketFilter.ts`.
  - `TicketQuery {f, c, wo, m, in, issue, cat, src, age}`, `parseTicketQuery`, `ticketLink`
    (always sets `f=all`), `filterTickets`, `queryChips`.
  - Exports `openedIn` / `closedIn` / `openAtEnd`, and `periodStats` (`dashboard.ts:71`) uses them,
    so the counts and the lists match.
  - Tests: `ticketFilter.test.ts` (round-trip, and counts equal `periodStats`).
  - Camps get `?s=`.
- **Month in the URL:**
  - The Dashboard's `?m=` merges with `?v=` (`DashboardPage.tsx:109-113`);
  - ContractorDetail reads `?m=`;
  - KPI rows pass it on.
  - Search-only changes don't animate (`nav.ts:34`), so scroll to the top yourself.
- **Dead links:**
  - ticket → contractor and work order (`TicketDetailPage.tsx:110-111`);
  - camp → contractor (`CampDetailPage.tsx:93`);
  - activity-log rows (`ActivityPage.tsx:46-51`);
  - `Hero` gets `to?` with a ›.

**Step 2: Home** (`src/lib/tasks.ts`, `src/pages/TodoPage.tsx`)
- `TASKS_FROM = '2026-10'`.
- `taskMonths(today)` returns the ended months ≥ `TASKS_FROM`, at most 3.
- `missingItems(d, s, m)` reuses `SUBJECT_ITEMS` (`todo.ts:68`).
- `buildTasks(d, today, {ticketCap: 5})` returns `{tasks, counts, progress}`.
  - `Task {key, kind, group, title, detail, due, daysLate, tone, icon, subject?, month?, missing?, sheet?, to, help}`.
  - The Watch line comes from `buildAttention`.
- Fill in opens via `SheetHost` (the same path as `SubjectEditor`, `SubjectPicker.tsx:86`).
- `buildTodo` is removed. `SUBJECT_ITEMS` and `/missing/:item` stay.
- Test: `tasks.test.ts` covers the due dates, the 7-day window, `TASKS_FROM`, the older-gaps row,
  the ticket cap, a legacy-blanks flood, and viewer versus editor tap targets.

**Step 3: Trends**
- **`src/lib/trends.ts`:**
  - `contractorSubjects(d, c)` includes inactive work orders;
  - `trendMonths(d, cUuid, '6m'|'1y'|'all', today)`;
  - `contractorKpiSeries` returns all items in one pass, with null gaps;
  - `contractorTicketSeries`, `contractorMoneySeries`, `contractorWorkforceSeries`;
  - `trendSummary`;
  - `itemInputs`, which explains a score.
  - Tickets filed at contractor level follow the `subjectTickets` rule (`subjects.ts:43`).
  - Test: `trends.test.ts`.
- **Charts:**
  - `TrendLine`: `value: number|null`, `mode: 'week'|'month'`, `guides`, `domain`, `onSelect`;
  - `MonthBars`: `onSelect`, `max`;
  - new `Sparkline`;
  - `BarList`: rows become buttons, plus `onMore` and `other: 'none'` for percentages.
  - Colours come only from the existing `--chart`, `--chart-2` and status tokens. Re-run the
    dataviz validator if any colour is added.
- **Pages:**
  - the ContractorDetailPage sub-tab `?tab=trends&r=1y&wo=`;
  - a new route `/contractors/:uuid/kpi/:key` in `App.tsx`, with no route conflicts.

**Step 4: Dashboard drill-down.** Wire every `Hero` and every bar in `DashboardPage.tsx` to
`ticketLink`, `?s=` or Trends, using the mapping in Part C2–C3. The KPI detail rows get
sparklines, and their numbers filter the list.

## Verification
- `npm test` and `npm run build` pass at every step.
- New pure modules have tests first (TDD): tasks, ticketFilter, trends, menuSpec, kpiIndex,
  chartScale, attention.
- Run the app with Playwright (pre-installed Chromium) at 390px phone width, in light and dark,
  and screenshot Home, Tickets with chips, contractor Trends, Dashboard and a long-press menu.
- In those screenshots, check that:
  - every tapped number's list count equals the number;
  - no-data months show as gaps;
  - the 90/70 lines show.
- Repeat as a **viewer** account: no ✎ actions, rows open records, no fill-in.
- Check Home on fixed dates: 1 Nov (nothing overdue, October in Later), 8 Nov (declarations in
  This week) and 16 Nov (overdue, "1d late").
- After each deploy, open https://ww-app-omega.vercel.app and confirm the change is live.
