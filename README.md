# WW Co-pilot — Worker Welfare in one app

A mobile-first **PWA** for the whole Worker Welfare routine: tickets, contractor KPIs,
manpower counts, camp audits, a live dashboard and an automatic activity log. Works offline,
stores everything on the phone first, and syncs to your own Supabase.

Design spec: [`docs/superpowers/specs/2026-10-31-ww-copilot-design.md`](docs/superpowers/specs/2026-10-31-ww-copilot-design.md)

## The 5 tabs

| Tab | What it's for |
|---|---|
| **Today** | Open tickets · over 30 days · missing monthly documents, plus a short "needs you" list |
| **Tickets** | + internal tickets. **＋** to add (contractor, issue, workers, source). **Swipe left to close.** Aging is automatic. |
| **Contractors** | KPI % and status per contractor; detail with monthly scoring, manpower counts, open tickets, last audit |
| **Audits** | The Labour Accommodation Audit checklist with Excel + Word reports (unchanged) |
| **Dashboard** | Month picker, weekly open-ticket trend, by contractor, by issue, KPI status; export Excel / Word |

⚙ Settings: one-time **history import**, **activity log**, backup/restore, Supabase sync.

### KPI rules (all in `src/lib/kpi.ts`)
- Monthly submission: WPS + manpower + salary declarations — all 3 = 100%, none = 0%, else 50%.
- **Grievance (auto from tickets):** average days to close of tickets closed in the month —
  ≤10 → 100%, ≤15 → 90%, ≤20 → 80%, ≤30 → 70%, over 30 → 0%.
- **Ticket closure (auto):** closed in the month ÷ open at any point in the month.
- **Formal vs illegal (auto):** from the manpower counts.
- Accommodation uses the month's audit score when not typed in.
- Overall = average of the 8 scored KPIs (quarterly audit shown, not averaged).
  🟢 ≥90% on track · 🟡 ≥70% at risk · 🔴 below 70% critical.

### Privacy
No worker names, Iqama or passport numbers are stored: manpower is counts only, and the import
drops free-text description columns and the Workforce Declaration worker list.

### One-time history import
Settings → Import history → pick the Violation Log, Internal Ticket Tracker and KPI System
workbooks. They are read on the phone (never uploaded); columns are matched by header text,
spellings are cleaned, contractor name variants are grouped for you to confirm, and the 86
weekly tabs become the open-ticket trend line.

## Deploy to Vercel (recommended)

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the **WW-APP** repository.
2. Select the branch to deploy (`claude/welfare-inspection-app-vvl8of` until it's merged to main).
3. Click **Deploy** — Vercel auto-detects Vite; `vercel.json` in the repo handles caching/service-worker headers.

Every push to the branch redeploys automatically.

## Cloud sync with Supabase

The app is fully usable offline with no account. Cloud sync keeps everything (audits, photos,
tickets, contractors, KPIs, activity log) in your own Supabase, so nothing is lost with the
phone.

**Built-in project (recommended).** When `.env.production` contains `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, the app is pre-connected: just open ⚙ Settings → create your account
once → Sign in → Sync now. The anon key is public by design; all data is protected by
row-level security (each user only sees their own rows). Database setup = run
[`supabase/schema.sql`](supabase/schema.sql) once in the project (safe to re-run).

**Manual project.** Without those variables, Settings asks for a Project URL and anon key
(Supabase → Settings → API) after you have run `supabase/schema.sql` in that project's SQL
Editor.

Sync is offline-first with last-write-wins per record; deletions propagate across devices; the
activity log is append-only (no update/delete policy exists).

## Install on your phone

Host the built app anywhere static (Vercel, Netlify, GitHub Pages), open the URL in
Chrome/Safari on your phone, then **Add to Home Screen**. It installs like a native app and
works offline afterwards.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm test          # unit tests (KPI rules, aging, import cleaners…)
npm run icons     # regenerate PWA icons (already committed)
```

Stack: Vite + React + TypeScript, `vite-plugin-pwa` (offline/service worker), Dexie
(IndexedDB), ExcelJS (xlsx export), docx (Word export).

## Where things live

- Checklist content: `src/templates/accommodation.ts` (generated 1:1 from the official
  workbook) and `src/templates/welfareAudit.ts` (placeholder).
- Excel workbook layout: `src/export/excel.ts`
- Word report layout: `src/export/word.ts`
- OXAGON logos used on the Word cover: `src/assets/`
- Co-pilot records + write path (activity log): `src/lib/records.ts`, types in `src/types.ts`
- KPI rules: `src/lib/kpi.ts` · dashboard maths: `src/lib/dashboard.ts` · aging: `src/lib/aging.ts`
- History import: `src/import/` (cleaners, header-based readers, contractor matching plan)
- Monthly Excel/Word export: `src/export/monthly.ts`
