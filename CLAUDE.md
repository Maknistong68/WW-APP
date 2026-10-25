# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An offline-first, mobile-first PWA for worker welfare inspections (labour accommodation audits). Inspectors fill a checklist on a phone, attach photos, and export an Excel workbook and a Word findings report that must match the official client templates. Stack: Vite + React 18 + TypeScript, Dexie (IndexedDB), ExcelJS, docx, `vite-plugin-pwa`, optional Supabase sync. Deployed as a static site on Vercel (`vercel.json` sets the CSP and service-worker cache headers).

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run build     # tsc -b (typecheck) + vite build → dist/
npm run preview   # serve the production build
npm run icons     # regenerate public/pwa-*.png (scripts/make-icons.mjs, no image deps)
```

There is no test suite and no linter. `npm run build` is the only check; the TS config is strict with `noUnusedLocals`/`noUnusedParameters`, so unused imports or variables fail the build.

## Architecture

**Routing** (`src/App.tsx`): `HashRouter` with `base: './'` in `vite.config.ts`, so the build runs on any static host without rewrites. `App` also triggers `backgroundSync` on load and on the `online` event.

**Storage** (`src/db.ts`): IndexedDB via Dexie is the source of truth. Tables are `inspections`, `photos` (Blobs), `logs` (activity log), and `tombstones` (local deletions waiting to be pushed to the cloud). Schema changes need a new `this.version(n)` with an upgrade. Every inspection and photo carries a `uuid` for cross-device identity, which must be a valid v4 UUID because it goes into Postgres `uuid` columns. Backup/restore (a JSON file with base64 photos) is in `db.ts` too. Small UI prefs and form drafts live in `localStorage` under `ww.*` keys.

**Data model** (`src/types.ts`): an `Inspection` holds `info: GeneralInfo` plus `responses: Record<questionCode, QuestionResponse>`. Photos link to an inspection by local numeric `inspectionId` and to a question by `itemId`: a question code, `FACILITY_PHOTOS` (`'@facility'`) for site photos, or `null` while unassigned.

**Templates** (`src/templates/`): checklists are plain data (`InspectionTemplate` → sections → questions), registered in `templates/index.ts`.
- `accommodation.ts` was generated 1:1 from the official workbook. Keep question text verbatim, because the exports have to match the official documents.
- `welfareAudit.ts` is a placeholder until the official checklist is provided.
- `walkthrough.ts` is an area-by-area view of the same questionnaire. Each line maps to one or more question codes, and answering a line writes the same status to all of them (`WALK_STATUS_PATCH` in `types.ts`). Only `accommodation` has a walkthrough (`getWalkthrough`).
- `observations.ts` and `remarks.ts` hold curated quick-pick chip text. `lib/suggestions.ts` merges them with phrases learned from past inspections.

**Scoring rules** (`src/lib/score.ts`): this file is the single source of truth for answered / flagged / finding status and for the scoring scale (Full = 2 or 100, Partial = 1 or 50, None = 0, N/A excluded). The Excel and Word exports, the checklist filters, and the KPIs must all agree, so change the rules here and nowhere else.

**Exports** (`src/export/`): `excel.ts` builds the whole workbook in code with ExcelJS: styles, live scoring formulas, data-validation dropdowns, and embedded photos. No template file is loaded at runtime. `word.ts` builds the findings report with `docx` and fetches the bundled logos from `src/assets/` at export time. `common.ts` has shared photo loading, date formatting and file names. Both exports aim for a 1:1 match with the official reference documents, so layout changes should be deliberate.

**Cloud sync** (`src/lib/sync.ts`, `supabase/schema.sql`): optional. The user enters a Supabase URL and anon key in Settings, which are stored in `localStorage`. The Supabase SDK is imported dynamically only when sync is used. Sync is last-write-wins per record by `updatedAt`:
- Always compare timestamps with `newer()` (parsed dates). Local values end in `Z` and PostgREST returns `+00:00`, so string comparison gives the wrong answer.
- Deletions are recorded locally as tombstones and become soft-delete (`deleted`) rows remotely.
- Reads page past PostgREST's 1,000-row cap with `selectAll`.
- An error on one record is collected and reported without aborting the rest of the sync.
- The `syncing` lock is claimed before the first `await`.

**Checklist editor** (`src/pages/ChecklistPage.tsx`, the largest file): the inspection is observed with `useLiveQuery` and adopted only when the DB copy is newer. Edits are debounced (400 ms) through `writeInspection`, which refuses to overwrite a newer DB row. Pending saves are flushed on unmount, not dropped. Every edit must stamp a fresh `updatedAt`, or sync and the adoption logic will treat it as stale.

**PWA**: `registerSW({ immediate: true })` in `main.tsx`. The Workbox `globPatterns` must include every asset fetched at export time (for example the `.jpeg`/`.png` logos), or offline Word export breaks. The CSP in `vercel.json` only allows `connect-src` to `*.supabase.co`, so any new external origin has to be added there.

## Background docs

`AUDIT.md` is an earlier audit (security, sync correctness, performance) with `file:line` references. Most of its critical sync and data-loss findings have since been fixed (see the comments in `sync.ts` and `ChecklistPage.tsx`), so check the current code before acting on any item in it.
