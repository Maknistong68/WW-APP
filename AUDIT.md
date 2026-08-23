# WW-APP Audit Report

**Date:** 2026-08-23 · **Scope:** security, bugs & correctness, performance, code quality
**Codebase:** ~4,400 lines TS/React (Vite PWA, Supabase sync, Dexie/IndexedDB, Excel/Word export)

Findings were produced by four independent audit passes and the highest-severity items were
manually verified against the source. Locations are `file:line`.

---

## 1. Critical / High — fix first

These cluster around one theme: **the offline-first sync design has correctness holes that
cause silent data loss once two devices (or one device + flaky connectivity) are in play.**

### 1.1 Timestamp comparison is broken → every sync re-pushes everything *(verified)*
`src/lib/sync.ts:117, 136, 212, 242`
Local `updatedAt` is `new Date().toISOString()` (`…T10:00:00.000Z`); PostgREST returns the
same instant as `…T10:00:00+00:00`. These are compared **lexicographically**, and `.`/`0` >
`+`, so an identical instant always evaluates as "local newer". Consequences:
- Every inspection and photo is re-pushed on **every** sync — "already up to date" is unreachable.
- The "Cloud sync: N items updated" toast fires on every app open.
- Remote-newer detection is unreliable; last-write-wins conflict resolution is effectively broken.

**Fix:** compare `Date.parse(a) > Date.parse(b)` (epoch millis) everywhere timestamps are compared.

### 1.2 Stale in-memory snapshot clobbers synced data → permanent cross-device data loss *(verified)*
`src/pages/ChecklistPage.tsx:81–83, 101–116` + `src/App.tsx:14–23`
The inspection is loaded into `useState` **once** (photos use `useLiveQuery`; the inspection
does not). `backgroundSync` can pull a newer record into Dexie underneath the open page. The
page still shows the stale copy; the next tap writes the **entire stale object** back with a
fresh `updatedAt`, overwriting the pulled edits locally — and the next sync pushes that
regression to the cloud.
**Fix:** load the inspection via `useLiveQuery` (or re-read + merge before `put`), and/or
patch fields instead of whole-record `put`.

### 1.3 Pending autosave cancelled on unmount → last edit silently lost *(verified)*
`src/pages/ChecklistPage.tsx:101–107`
Writes are debounced 400 ms; the unmount cleanup `clearTimeout(saveTimer.current)` **cancels**
the pending write instead of flushing it. Answer a question, hit Back within 400 ms → the edit
is gone.
**Fix:** flush (perform the `put`) on unmount instead of clearing.

### 1.4 `syncing` guard set after awaits → concurrent syncs interleave *(verified)*
`src/lib/sync.ts:69–76`
`if (syncing) throw` runs at the top, but `syncing = true` is only set after
`await getClient()` and `await getSession()`. Background sync on app open + manual "Sync now"
(or the `online` event) can both pass the check → duplicate photo inserts → PK violation errors.
**Fix:** set `syncing = true` synchronously before the first `await` (with try/finally as now).

### 1.5 Remote `deleted` flag permanently wins → Undo and backup-restore are silently re-deleted
`src/lib/sync.ts:102–110, 116, 174–180, 191`
Push skips records whose remote row is `deleted`; pull deletes them locally. There is no
resurrection path. Delete a photo → sync → tap **Undo** → next sync deletes it again, silently.
Restore a deleted inspection from a backup JSON → next sync wipes it and all its photos.
**Fix:** if a local record is newer than the remote tombstone, push it with `deleted: false`.

### 1.6 Sync breaks permanently past 1,000 rows
`src/lib/sync.ts:93–95, 165–167`
Unpaginated `select()` is capped at PostgREST's 1,000-row default. Past that, truncated photos
look "not remote" → duplicate insert → PK violation → sync throws the same way forever.
At ~30 photos/inspection this is reachable in normal use.
**Fix:** paginate with `.range()` (and prefer a delta filter, see 3.4).

### 1.7 One bad record bricks sync forever
`src/lib/sync.ts:138–144, 229–230`
Every per-record error aborts the whole run. A single photo row whose storage object is
missing makes every future sync on every device die at the same record.
**Fix:** catch per-record, count failures, continue; report at the end.

### 1.8 UUID fallback is not a UUID → records permanently unsyncable
`src/db.ts:4–7`
When `crypto.randomUUID` is absent (older WebViews, insecure contexts), the fallback
`` `${Date.now()}-${random}` `` fails Postgres `uuid` parsing → "Push failed: invalid input
syntax for type uuid", forever, for those records.
**Fix:** use a proper v4 fallback built on `crypto.getRandomValues` (or refuse cloud sync in
insecure contexts).

### 1.9 Offline Word export is broken — logo never precached
`vite.config.ts:15` + `src/export/word.ts:18, 52–55`
The PWA precache glob omits `jpeg/jpg`, so `neom-logo.jpeg` (185 KB) is not cached, yet
`buildWord` `fetch()`es it at export time. Offline Word export — a headline offline feature —
throws when offline.
**Fix (one line):** add `jpeg,jpg` to `globPatterns` (or inline the logo as a data URI).

### 1.10 Excel and Word reports disagree on what counts as a "finding"
`src/export/excel.ts:493–497` vs `src/export/word.ts:85–87` (also `ChecklistPage.tsx:28–29`,
`src/lib/score.ts:27–43`)
The "flagged finding" rule is implemented four times with diverging definitions: Excel includes
questions with only an action plan; Word does not. Two official reports from the same
inspection can list different findings.
**Fix:** one `isFlagged()` in `score.ts`, used everywhere.

---

## 2. Security

**Overall: sound.** Verified clean: RLS enabled on both tables with correct `USING` +
`WITH CHECK` per-user policies; private storage bucket scoped to per-user folders; no
hardcoded secrets anywhere in the repo; no `eval` / `dangerouslySetInnerHTML` / `.rpc()` /
injection primitives; no Excel formula injection (user text written as strings); Supabase URL
validated to `https://*.supabase.co`.

| Sev | Finding | Location |
|---|---|---|
| Med | No security headers: no CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or HSTS. Clickjacking possible; any future XSS runs unmitigated with session token in localStorage. | `vercel.json:4–13`, `index.html` |
| Med | Deleted data retained in cloud forever: deletion only sets `deleted=true`; full `data` jsonb kept, and **photo storage objects are never removed by any code path**. "Deleted" worker photos remain in the bucket permanently. | `sync.ts:80–90`, `schema.sql` |
| Med | `googleMapsLink` free-text is written as an Excel hyperlink without scheme validation — a `file://` or UNC link in a distributed report can leak NTLM creds on click. | `excel.ts:181–184`, `InfoFormPage.tsx:154` |
| Low | "Disconnect" swallows `signOut()` failures and never removes the `sb-<ref>-auth-token` localStorage entry — re-entering the same URL on that device silently resumes the previous session. | `SettingsPage.tsx:59–67`, `sync.ts:30–34` |
| Low | Session tokens in localStorage (supabase-js default) — defense-in-depth only; no current XSS vector. | `sync.ts:48` |
| Low | Backup restore trusts file contents with only shallow validation (self-inflicted only; no cross-user path). | `db.ts:122–160` |
| Low | No at-rest protection: all inspection data + photos readable in IndexedDB on a lost/shared phone; no app lock. Design decision worth making consciously. | by design |
| Low | Client clocks drive last-write-wins — a skewed-forward clock clobbers newer edits from the user's other devices. | `sync.ts:117–126` |

**Priority:** add headers to `vercel.json`; decide on a purge policy for soft-deleted rows +
storage objects; validate the maps link as `https:`.

---

## 3. Performance

Verified good: exceljs, docx, and supabase-js are all correctly lazy-loaded via dynamic
`import()`; DB writes debounced; object URLs revoked; Dexie indexes match query patterns; no
polling (sync only on open / `online` / manual).

### 3.1 Typing re-renders the entire 900-line page per keystroke (High)
`ChecklistPage.tsx:109–126` — all state in one `inspection` object; every keystroke clones it
and re-renders every mounted section/question. `QuestionItem` and `WalkthroughLine` aren't
memoized and receive fresh inline callbacks/arrays every render, so memoization can't bail out.
Plus `renderQuestion` re-does `flatMap().find()` per question per render (O(n²)) even though a
`questionByCode` map already exists at line 165.
**Fix:** `React.memo` both components + stable callbacks (`useCallback`), use the existing map,
`useMemo` the derived structures (lines 165, 183–187, 366–368, 456–468).

### 3.2 Photo caption writes to IndexedDB per keystroke (Med)
`ChecklistPage.tsx:871–879` — each keystroke triggers a DB write → re-fires the photos
`useLiveQuery` → fresh Blob identities → every visible `PhotoThumb` recreates its object URL
and re-decodes its image. Typing 30 chars = 30 query + image-decode rounds. **Fix:** debounce.

### 3.3 Sync loads every photo blob into memory (Med)
`sync.ts:170` — `db.photos.toArray()` materializes all blobs (~50–100 MB+ with a few hundred
photos) just to compare metadata. **Fix:** iterate metadata only; fetch blobs lazily for
records that actually need upload.

### 3.4 No delta sync + N+1 pulls (Med)
`sync.ts:93–96, 138–144, 165–168` — every sync selects metadata for *all* rows ever created,
then fetches each inspection to pull in its own serial round-trip. **Fix:** filter by
`updated_at > lastSync`, batch pulls with `.in('uuid', […])`, parallelize photo transfers in
small batches.

### 3.5 Full-resolution photos rendered as 60 px thumbnails (Med)
`PhotoThumb.tsx:24` — 1600 px JPEGs decoded at full size (~7.7 MB raster each); 30 visible
photos ≈ 200 MB+ of bitmaps → scroll stutter on mid-range phones. **Fix:** generate a small
thumbnail blob at capture time; at minimum add `loading="lazy"` + `decoding="async"`.

### 3.6 Precache strategy (Low/decide)
`vite.config.ts:15–16` — the ~1 MB+ exceljs/docx chunks are precached for every user on every
update. Likely a deliberate offline trade-off; confirm hashed chunk names keep it incremental.

---

## 4. Bugs (beyond §1)

| Sev | Finding | Location |
|---|---|---|
| Med | `InfoFormPage.submit` has no try/finally around DB writes — quota failure leaves `saving=true` forever, button dead, no toast, inspection never created. | `InfoFormPage.tsx:74–105` |
| Med | Photo capture handlers have no catch — quota failure loses the photo **silently** (inspector believes evidence was captured); input value not reset so retry may not re-fire. | `ChecklistPage.tsx:191–232` |
| Med | Exports hard-code JPEG but `compressPhoto` falls back to the original file on undecodable formats (e.g. HEIC) — broken images / "repair" prompts in official reports. | `excel.ts:191,572`, `word.ts:237`, `db.ts:200–220` |
| Low | Bad inspection id → permanent "Loading…"; unknown `templateId` → blank page. | `ChecklistPage.tsx:41,81–83,161–163` |
| Low | `backgroundSync` can still raise an unhandled rejection (`getSession()` has no catch). | `sync.ts:268–276` |
| Low | Occupancy formula yields `#VALUE!` in the workbook when fields are blank (Word guards this; Excel doesn't). | `excel.ts:162` |
| Low | Settings auth-listener leaks on fast unmount. | `SettingsPage.tsx:33–42` |
| Low | Dictation: keyboard edits during listening are overwritten by the frozen-base transcript; stop→start race leaves mic live while UI shows idle. | `VoiceTextarea.tsx:53–73` |
| Low | Side effects (`logEvent`, `persist`) inside `setState` updaters — duplicate log rows under StrictMode, fragile under concurrent rendering. | `ChecklistPage.tsx:109–116, 725–731` |
| Low | Undo toast is replaced by the next toast (which per §1.1 fires constantly), killing the Undo window early; delete/duplicate show success toasts even on failure. | `ChecklistPage.tsx:316–328`, `HomePage.tsx:144–149, 197–201` |

Verified clean: `score.ts` math (100/50/0, N/A exclusion, rounding) matches the Excel
formulas; Dexie v1→v2 migration correct; all walkthrough codes resolve to real questions;
Excel cross-sheet references consistent.

---

## 5. Code quality

Calibration: the codebase is in **unusually good shape** for its size — no `any` anywhere,
tight union types, real JSDoc, consistent naming, correct lazy-loading, tombstone deletes.

| Impact | Finding |
|---|---|
| High | `ChecklistPage.tsx` (900 lines, ~20 hooks/refs, 4 modals, 2 view modes) should be decomposed. Natural seams: `useInspection(id)` hook (fixes §1.2/§1.3 in the same move), `usePhotoCapture` + modal components, `lib/exportInspection.ts`, `useChecklistSearch`, `WalkView`/`FullView` components. |
| High | Compliance-score mapping duplicated 5×; the canonical `complianceScore` helper in `types.ts:175–186` is exported but **never imported** (dead). Centralize in `score.ts` alongside `isFlagged` (§1.10). |
| Med | ~16 `as` casts on Supabase rows incl. `full.data as Inspection` trusted wholesale into IndexedDB — one `RemoteInspectionRow`/`RemotePhotoRow` interface would eliminate them. (`sync.ts`) |
| Med | No ESLint/Prettier at all, yet `Modal.tsx:33` carries an `eslint-disable` comment for a linter that never runs. Hooks-deps mistakes (the exact bug class in §1) go undetected. |
| Med | Dead code: `common.ts:70–76 findQuestion`, `sync.ts:278–279` re-exports, `Modal.tsx` `header` prop, zero-only spread in `excel.ts:60–67`. |
| Med | Walkthrough availability hardcoded to `templateId === 'accommodation'` in `templates/index.ts:15–16` — adding a template requires editing a hidden switch. |
| Low | Duplicated `MONTHS`/date-parse helpers (`common.ts` vs `HomePage.tsx`); localStorage keys as scattered literals with mismatched read/write construction (`InfoFormPage.tsx:12` vs `79–80`); the `err instanceof Error ? …` toast idiom repeated 7×; `!` assertion contradicted by `filter(Boolean)` (`ChecklistPage.tsx:435`); consider `noUncheckedIndexedAccess` in tsconfig. |

---

## Recommended fix order

1. **Sync correctness batch** (§1.1, 1.4, 1.5, 1.6, 1.7, 1.8 — all in `sync.ts` + `db.ts`): parse timestamps as epochs, set the guard synchronously, add resurrection, paginate, per-record error handling, real UUID fallback.
2. **ChecklistPage data-loss batch** (§1.2, 1.3): `useLiveQuery` for the inspection + flush-on-unmount.
3. **One-liners with outsized payoff**: `jpeg` in precache glob (§1.9), debounce caption (§3.2), security headers (§2).
4. **Report integrity**: unify `isFlagged`/score mapping (§1.10, quality H2/H3); guard the occupancy formula.
5. **Error-handling sweep**: try/finally in InfoFormPage, catch in photo capture, honest toasts.
6. **Performance pass on ChecklistPage** (§3.1) — ideally folded into the decomposition (quality H4).
7. Decide policy items: cloud purge of deleted data, at-rest protection/app lock.
