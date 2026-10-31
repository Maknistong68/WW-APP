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
  one + button (`src/components/AddButton.tsx`); Home tiles open `/missing/:item` lists.
- Short, simple UI wording; Apple-style screens.

## Checks before pushing
```bash
npm test        # vitest: KPI rules, roles, to-do, dashboard, money, filters
npm run build   # strict tsc + vite build
```

## Where things are
- Data model: `src/types.ts`; every write goes through `src/lib/records.ts` (activity log).
- KPI rules: `src/lib/kpi.ts`; per-work-order subjects: `src/lib/subjects.ts`, `src/lib/kpiData.ts`.
- Home tiles and their missing-lists: `src/lib/todo.ts` (`SUBJECT_ITEMS`).
- Dashboard numbers: `src/lib/dashboard.ts`; charts in `src/components/charts/`.
- Supabase schema: `supabase/schema.sql` (project `ww-copilot`; built-in config in `.env.production`).
