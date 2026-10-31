# WW Co-pilot — Design

**Date:** 2026-10-31 · **Status:** awaiting approval · **User:** single (owner only)

## 1. Goal

One phone app for the whole Worker Welfare routine: tickets, contractor KPIs,
manpower, audits, dashboard, and an automatic activity log. Simple, few words,
Apple-like. Replaces the Ticket Tracker, Violation Log, KPI System and Workforce
Declaration workbooks.

### Agreed decisions

| Topic | Decision |
|---|---|
| Users | Owner only. One login, no roles. |
| Co-pilot | Smart app now (no AI). AI assistant is a later, separate project. |
| work PC | The app never runs on or reads from the work PC. Phone (and personal laptop) only. |
| Data entry | History imported **once** from the files already received. After that, everything is typed in the app. |
| Personal data | No worker names, Iqama, passport or phone numbers. Manpower is stored as counts only. |
| Base | Grow the existing WW-APP (PWA, offline, Supabase sync, audits). No second app. |
| Look | Apple iOS style (see §4). |
| KPI auto-calc | Grievance score and Ticket closure % calculated from tickets. |
| Grievance > 30 days | Scores 0%. |
| Closure % | Fixed formula (see §5), not the Excel one. |

### Out of scope (now)

AI assistant · team/multi-user · reading anything from systems · storing
worker personal data · recurring file imports.

## 2. Data

All records live in IndexedDB first (Dexie) and sync to Supabase.

### Contractor
`uuid, name, workOrder, active, aliases[], notes, updatedAt`
- `aliases` holds every spelling met (e.g. full legal name, short name, name +
  work-order number). All lookups and imports resolve through it, so totals add up.

### Ticket
`uuid, source (| Internal), ticketNo?, channel, contractorUuid, subcontractor,
category, issue, priority (1–4), severity, workers, violations, assignedTo,
status (Open | In progress | Closed), openedAt, closedAt?, contractorAction,
wwAction, notes, updatedAt`
- Pick-lists (channel, category, issue, priority, assignedTo) are fixed, cleaned
  lists. Free text only in actions/notes.
- `aging` is never stored: `today − openedAt` (or `closedAt − openedAt` if closed).

### KPI month (contractor × month)
`uuid, contractorUuid, month (YYYY-MM), wps, manpowerDecl, salaryDecl (yes/no),
accommodationPct, onboardingPct, offboarded, offboardTotal, meetingAttended,
quarterlyAuditPct?, updatedAt`
- Calculated, not stored: monthly submission %, offboarding %, grievance %,
  formal-vs-illegal %, ticket closure %, overall %, status.
- `accommodationPct` defaults to the score of that contractor's latest audit in
  the month (editable).

### Manpower (contractor × month, counts only)
`uuid, contractorUuid, month, totalWorkers, illegalOrFreelance, visaExpiring30d,
paidRecruitmentFees, updatedAt`

### Weekly count
`uuid, weekEnding (date), openTickets` — imported from the 86 weekly tabs. After
the import date, weekly points are computed from ticket dates instead.

### Activity log
`uuid, time, entity (ticket | contractor | kpi | manpower | audit | import),
entityUuid, action (add | edit | close | reopen | delete | import),
changes [{field, from, to}]`
- Written automatically by the data layer on every change. Add-only.

## 3. Screens

Bottom tab bar, 5 tabs. ⚙ (top-right on every tab) opens Settings.

| Tab | Content |
|---|---|
| **Today** | 3 hero numbers: Open · Over 30 days · Missing submissions. "Needs you" list (max 5): oldest open tickets over 30 days, contractors missing this month's WPS / manpower / salary. |
| **Tickets** | Segmented Open / Closed / All, search. Row: contractor · issue · age chip. **＋** sheet: contractor, issue, workers, source (rest optional, under "More"). Swipe left = Close (asks action taken). Tap = detail + history from the activity log. |
| **Contractors** | List: name, overall KPI %, status dot. Detail: score ring, this month ✓/✗ (WPS, manpower, salary), open tickets, manpower counts, last audit, "Score this month" sheet. |
| **Audits** | Existing inspection flow, restyled only. |
| **Dashboard** | Month picker. Hero numbers. Weekly open-ticket trend (line). Tickets by contractor (bar). Tickets by issue (bar). KPI status per contractor (table with status icon). Export button. |

**Settings:** Supabase sign-in & sync · one-time history import · activity log
viewer (filter by type, search) · backup/restore (existing).

## 4. Look (Apple iOS style)

- System font (`-apple-system`, SF Pro on iPhone). Large bold titles that shrink
  on scroll.
- Grouped inset lists and white cards on `#F2F2F7`; true-black dark mode with its
  own tuned colours.
- One accent: the app's existing green. Red / orange / green only for status,
  always paired with an icon + label.
- Bottom tab bar with thin line icons; add/edit as bottom sheets; swipe actions on rows.
- 44px minimum tap targets; safe-area insets respected.
- Minimal words: numbers, chips, icons. No paragraphs on screens.
- Charts follow the dataviz skill: thin marks, one axis, hover/tap tooltips,
  validated palette in light and dark, status colours reserved.

## 5. Calculations

| Item | Rule |
|---|---|
| Aging bucket | 0–10 · 11–30 · 31–60 · 61–90 · 90+ days |
| Monthly submission % | WPS, manpower, salary: all 3 yes = 100%, none = 0%, otherwise 50% |
| Offboarding % | `offboarded ÷ offboardTotal` (blank if total is 0) |
| Formal vs illegal % | From manpower: `(total − illegal) ÷ total` (blank if no manpower record) |
| Grievance % | Average days-to-close of the contractor's tickets **closed in the month**: ≤10 → 100%, ≤15 → 90%, ≤20 → 80%, ≤30 → 70%, >30 → 0%. Blank if none closed. |
| Ticket closure % | Tickets closed in the month ÷ tickets open at any point in the month (opened before month end and not closed before month start). Blank if none. |
| Overall % | Average of the non-blank values of: submission, accommodation, onboarding, offboarding, grievance, formal-vs-illegal, ticket closure, meeting attendance. Quarterly audit shown but not averaged (same as Excel). |
| Status | ≥90% 🟢 On track · ≥70% 🟡 At risk · <70% 🔴 Critical · no data = "No data" |

All rules live in one module (`src/lib/kpi.ts`) with unit tests.

## 6. One-time history import

Settings → "Import history" → pick files on the phone (Violation Log, Internal
Ticket Tracker, KPI System). Runs fully in the browser (ExcelJS); files are never
uploaded or committed.

1. **Detect** each file by its sheet names.
2. **Map columns by header text**, not position (weekly tabs differ in layout).
3. **Clean values**: priority spellings unified, inspector name variants unified,
   category/issue spellings unified, mixed date formats (`dd-mm-yyyy hh:mm` text and
   real dates) parsed.
4. **Contractor matching**: group name variants automatically; one confirm screen
   lets the owner merge/split groups before saving.
5. **De-duplicate** tickets by ticket number (the same ticket in the Overall
   log and the internal tracker is stored once).
6. **Preview** counts (tickets, contractors, KPI months, weekly points, skipped
   rows with reason) → **Confirm** → save + one `import` entry in the activity log.

Free-text description columns are not imported (they can contain worker names).

## 7. Sync & safety

- Supabase tables: `contractors, tickets, kpi_months, manpower, weekly_counts,
  activity_log`, same pattern as `inspections` (uuid, user_id, data jsonb,
  updated_at, deleted) with row-level security per user.
- One generic sync routine for all record tables: last-write-wins by `updatedAt`,
  soft deletes.
- `activity_log`: RLS allows insert and select only — no update/delete, even from
  the dashboard.
- Failed sync retries on next open/online; nothing is lost locally.
- Bad import rows are listed and skipped, never half-saved (import is one
  transaction).

## 8. Exports

From Dashboard, for the selected month:
- **Excel**: sheets Tickets, KPIs, Manpower, Weekly trend.
- **Word**: one-page monthly summary (hero numbers, KPI table, open tickets over
  30 days), using the existing OXAGON cover style.

## 9. Testing

- Unit tests (Vitest) for every rule in §5, the import cleaners and contractor
  matching, using made-up fixtures only.
- `npm run build` must pass (TypeScript strict).
- Playwright screenshots of each tab at iPhone size, light and dark, reviewed
  before hand-over.

## 10. Build order

Each phase ships working on its own.

1. **Foundation** — Apple-style shell (tab bar, large titles, sheets), new Dexie
   tables, Supabase schema + generic sync, contractor master list, activity log.
2. **Tickets** — list, add sheet, swipe-close, detail with history.
3. **History import** — §6.
4. **Today + Dashboard** — hero numbers, charts, needs-you list.
5. **KPIs + Manpower** — monthly scoring sheet, auto-calc, contractor detail.
6. **Exports** — Excel + Word monthly.

Later, separate project: AI co-pilot (draft letters, weekly summary).
