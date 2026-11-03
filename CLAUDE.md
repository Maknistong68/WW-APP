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
  KPIs, Dashboard, counts) and `cases` apart. A case that turned into a D&C ticket is **linked**, never closed by it:
  `linkedTicketUuid` on the case only (rules `src/lib/caseLinks.ts`, sheet `LinkTicketSheet`, menu `link`/`linked`);
  closing the ticket asks to close its open cases too (`src/components/closeLinked.ts`).
- Quarterly audit close-out (findings / closed / due = audit + 30 days): `src/lib/closeout.ts`.
- Monthly documents (per work order, 11: the owner's 9 + WPS + Salary; due the 15th of the next month):
  rules `src/lib/submissions.ts` (`SUBMISSION_ITEMS`; each in with a date / not provided / N/A / waiting, a note,
  item 2's Issue log or IAP; N/A carries on until changed: `carryBefore`, `subjectPrior`, `docsSettled`). Stored in
  `KpiMonth.docs`; WPS / Manpower register / Salary also set the old fields the KPI score reads, so the score is
  unchanged (track only). Panel `src/components/SubmissionSheet.tsx` (sheet kind `submission`): saves only what was
  changed there onto a fresh copy (`applyDocChanges`); the KPI panel shows a Documents row and keeps the documents
  on save (`withDocsOf`). Lists: Home › Submission (`tasks.ts`), `/missing/submission` with document chips and
  reminders (`docRows`, `docMissing` in `todo.ts`, `chaseText`), contractor page, Excel sheet "Submissions".
- Dashboard numbers: `src/lib/dashboard.ts`; the Tickets view's tabs **D&C Tickets | Cases | All** (`?src=`, list and
  wording `src/lib/dashSource.ts`; Cases/All have no Closure KPI but "Closed in 30 days" and "Turned into tickets");
  its three sections: Focus cards `src/lib/focus.ts`,
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
- Saving: sheets use `useSave` (`src/lib/useSave.ts`, pure core `saveRun.ts`): a returned sentence is shown
  under the sheet title (`Modal` `alert`), a thrown error is explained by `saveError.ts` (red toast, Reload when
  the app was updated) and logged. Writes outside sheets use `attempt` / `tryWrite` (`src/lib/safeWrite.ts`).
  Nothing fails silently: `main.tsx` catches unhandled errors; problems also go to a localStorage copy
  (`localLog.ts`) shown in Settings › Sync log (Copy log). `db.ts` closes on `versionchange`. App updates wait
  while a panel is open (`appUpdate.ts`, `editing.ts`, `registerType: 'prompt'`).
- Who did it: every activity entry carries `by` / `byName` (`src/lib/activityEntry.ts`, the one builder;
  the signed-in person is set in `App.tsx` via `setActor`, `src/lib/actor.ts`). The server stamps them again
  from the sender (trigger `private.stamp_activity`). Names come from `team_members()` (names only, cached by
  `useTeam`, `src/lib/team.ts`); `whoName` reads "You" / name. History, the Activity log (Who filter) and a
  closed ticket's status line show it. Each person sets name + username in Settings (`ProfileCard`,
  RPC `set_my_profile`; rules in `src/lib/authForm.ts`). Deleting a user never deletes their records (FKs restrict).
- Removing tickets: only the Admin, with a reason (`RemoveTicketSheet`, `removeTicket` in `records.ts`, rules in
  `src/lib/removal.ts`, menu via `ticketActions(…, { admin })` and `isAdmin()`/`setRole` in `actor.ts`). The server
  keeps a non-admin's change to `deleted` back (trigger `private.guard_ticket_removal`). Removed tickets are listed
  with who/when/why and restored at `/tickets/removed` (`RemovedTicketsPage`, admin, online).
- Sign-in (`src/pages/LoginPage.tsx`): Sign in (username or email) · Create account (name, username, email,
  password) · Forgot password · Check your email · Set password · Waiting. Which screen: `src/lib/gate.ts`.
  Rules: `src/lib/authForm.ts`. A username signs in through the Edge Function `supabase/functions/sign-in`
  (service-role lookup, same answer for any wrong login, 10 tries / 15 min). Email links of every shape are read
  once in `main.tsx` (`src/lib/authReturn.ts`) and finished in `src/lib/auth.ts` (`detectSessionInUrl: false`);
  invite and reset links open Set password first.
- Invites (Users page → Invite, admin): name, username, email, role → Edge Function `supabase/functions/invite-user`
  (checks the caller is an approved admin; `inviteUserByEmail`, else a copy-able link via `generateLink`; the profile
  is approved with the chosen role). Rows show "Invited · not joined yet" until `joined_at` (set on first sign-in);
  "Send a new link" for them. Rules: `src/lib/invite.ts`; calls: `src/lib/functions.ts` (`callFunction`).
- Install first + Get started: `src/lib/platform.ts` (which phone/browser, `installPlan` steps per browser,
  `shouldOfferInstall`), `src/lib/installPrompt.ts` (`useInstallState`, skip = "Continue in browser"). On a phone
  or tablet in a browser tab, `src/pages/InstallPage.tsx` comes first (after Set password, `gate.ts`); never on a
  computer. Home shows `GetStarted` (steps from `src/lib/onboarding.ts`, done by doing: installed, name, synced,
  holding a ticket, saving KPIs, opening the Dashboard, inviting) and `UseAppNote` after a skip; Settings › Get
  started brings the card back. Waiting asks for the name and checks again every 30 s.
- Edge Function settings live in `supabase/config.toml` (`sign-in`: verify_jwt off; `invite-user`: on). A phone only
  sends its signed-in person's own activity entries (`src/lib/activityPush.ts`); others wait for their owner.
- Supabase schema: `supabase/schema.sql` (project `ww-copilot`; built-in config in `.env.production`).
