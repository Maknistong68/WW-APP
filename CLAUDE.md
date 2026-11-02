# CLAUDE.md

WW Co-pilot: offline-first PWA (Vite + React + TS, Dexie, Supabase sync) for the Worker
Welfare routine: tickets, contractors and work orders, KPIs, audits, dashboard and activity log.

## Owner's standing rules
- **Always deploy to main.** Every finished change is pushed to the working branch **and** to
  `claude/welfare-inspection-app-vvl8of`, which is the Vercel production branch serving
  https://ww-app-omega.vercel.app. That branch is only ever fast-forwarded:
  `git push origin HEAD:claude/welfare-inspection-app-vvl8of`.
- Never write the client's parent-company name anywhere in code, data or commits; it was
  purged from git history.
- No worker personal data (names, Iqama, passport, phone). Manpower is stored as counts only.
- Access: the app opens on Login; new accounts are **pending** until the admin approves them on
  the Users page. Approved users share one data set (RLS via `private.is_approved()`).
- Roles: **Admin** (everything + Users page), **Editor** (add/change data), **Viewer** (read only).
  Writes are enforced by RLS `private.can_edit()`; viewers sync pull-only and the UI hides edit
  controls via `useAuthInfo().canEdit`. An admin cannot change their own role.
- No Import and no bulk KPI entry: the history is already in Supabase. New data comes from the
  one + button (`src/components/AddButton.tsx`). Home ("Good morning") is sections each person
  orders with Edit Home (kept on the phone): Start here (every late or this-week job as a swipeable
  card with its button), All areas (six app icons: Tickets, Submission, KPIs, Accommodation, Audits,
  Tasks, with a count badge or the next date), Watch and Month progress. An area opens its named
  task list (overdue / this week / later) whose rows open the right form or record, and holding an
  area gives a quick look.
- Short, simple UI wording. "Field tool" design in Samsung One UI 9 style: light by default
  (true-black dark follows the phone), colour = status (menu icons use fixed hues from
  `src/lib/hues.ts`), One UI app-icon tiles, expandable app bars, rounded grouped cards, a
  floating tab bar and floating panels, SESL motion with screen transitions.
  Follow `docs/DESIGN.md`; styles live in `src/styles/` (tokens.css first), tone rules in
  `src/lib/tone.ts`, motion helpers in `src/lib/nav.ts`, `scroll.ts`, `motion.ts`.

## Checks before pushing
```bash
npm test        # vitest: KPI rules, roles, to-do, dashboard, money, filters
npm run build   # strict tsc + vite build
```

## Where things are
- Data model: `src/types.ts`; every write goes through `src/lib/records.ts` (activity log).
- KPI rules: `src/lib/kpi.ts`; per-work-order subjects: `src/lib/subjects.ts`, `src/lib/kpiData.ts`.
- Home: `src/pages/TodoPage.tsx`; section order and Edit Home `src/lib/homeLayout.ts`,
  `src/components/HomeEditor.tsx`; Start here `src/components/StartHere.tsx` (cards: `TaskCard`).
- Home task list: `src/lib/tasks.ts` (areas: `AREAS`, `areaSummaries`, `areaTile`, icons
  `src/components/AreaCard.tsx`; rows `src/components/TaskRow.tsx`; an area's list `src/pages/AreaPage.tsx`, `/today/:area`; due rules in `src/lib/due.ts`; the team's own routine tasks in
  `src/lib/routines.ts`, table `routines`, sheet `src/components/RoutineSheet.tsx`); the per-work-order checks and
  the `/missing/:item` lists: `src/lib/todo.ts` (`SUBJECT_ITEMS`).
- Long-press menus: `src/components/menus.tsx` (rules in `src/lib/menuSpec.ts`), sheets opened from
  anywhere via `SheetHost`; ticket drill-down filters: `src/lib/ticketFilter.ts`.
- Tickets are D&C (hotline, WWCMPL…); the team's own items are **cases** (`src/lib/cases.ts`: stored as
  `source: 'Internal'`, numbered CASE-0001…, tabs D&C Tickets | Cases). `useAllData` gives `tickets` (D&C only:
  KPIs, Dashboard, counts) and `cases` apart.
- Quarterly audit close-out (findings / closed / due = audit + 30 days): `src/lib/closeout.ts`.
- Dashboard numbers: `src/lib/dashboard.ts`; its three sections: Focus cards `src/lib/focus.ts`,
  Explore chips `src/lib/explore.ts`, Over time series `src/lib/overTime.ts`, hold-to-drill pop-up data
  `src/lib/peek.ts` (`peekMenu` in `menus.tsx`); section components `src/components/dash/`, figures
  (`Ring`, `Meter`, `SplitBar`, `RankBars`, `TrendLine`) in `src/components/charts/`, styles `src/styles/dash.css`.
- Compare grid (`/compare`, every contractor or work order month by month): `src/lib/compare.ts`,
  `src/components/CompareGrid.tsx`. Audit history (quarterly scores + camp inspections):
  `src/lib/audits.ts`; inspection scores are memoised in `src/lib/inspectionScore.ts`.
- 3D "Live site" (Dashboard → 3D): world `src/lib/world.ts` (city-scale octagon, coast), zones
  `src/lib/zones.ts` (industrial zone, port land, harbour basin, island, floating city: land/water and the
  pale fill), model `src/lib/site.ts` (sites, fit rules, coast sites on the basin quay, manpower crews) and
  `src/lib/mapItems.ts` (highway, spine road, streets, palms, camps, villages and the zone outlines); scene
  `src/three/` (`Zones.tsx` draws the city); page `src/pages/City3DPage.tsx`. Only Admins edit the map
  (`canEditLayout`); the Zones tool reshapes the zones. Every site is barricaded; worker figures follow the
  month's manpower count.
- Supabase schema: `supabase/schema.sql` (project `ww-copilot`; built-in config in `.env.production`).
