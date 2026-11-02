# WW Co-pilot — Worker Welfare in one app

A mobile-first **PWA** for the whole Worker Welfare routine: tickets, contractor KPIs,
manpower counts, camp audits, a live dashboard and an automatic activity log. Works offline,
stores everything on the phone first, and syncs to your own Supabase.

Design spec: [`docs/superpowers/specs/2026-10-31-ww-copilot-design.md`](docs/superpowers/specs/2026-10-31-ww-copilot-design.md)

## How it is organised

| Place | What it's for |
|---|---|
| **Home** | Start here (late and this-week jobs), All areas (Tickets, Submission, KPIs, Accommodation, Audits, Tasks), Watch, Month progress. Each person orders it with Edit Home. |
| **Tickets** | D&C tickets (WWCMPL…) and, on the Cases tab, the team's own cases (CASE-0001…, not counted in the KPIs). Swipe left to close; hold a row for more. Only the Admin removes a ticket, with a reason. |
| **Dashboard** | Focus cards, Explore chips and Over time for Tickets, Accommodation and KPIs; hold a number to drill in; KPI pack, Excel and Word exports. |
| **Library** | Contractors and work orders, camps, inspections, close-outs, compare grid, activity log, users (Admin), settings. |
| **+ button** | The one way to add: ticket, case, monthly KPIs, inspection, camp, task. |

### KPI rules (all in `src/lib/kpi.ts`)
- Monthly submission: WPS + manpower + salary declarations — all received = 100%, none = 0%, else 50%.
  The 11 monthly documents are tracked per work order (Monthly documents sheet); one marked **Not provided** or
  **N/A** is not chased and is left out of the score.
- **Grievance (auto from tickets):** average days to close of tickets closed in the month —
  ≤10 → 100%, ≤15 → 90%, ≤20 → 80%, ≤30 → 70%, over 30 → 0%.
- **Ticket closure (auto):** closed in the month ÷ open at any point in the month. A month still running
  with nothing closed yet is blank, not 0%.
- **Formal vs illegal (auto):** from the manpower counts.
- Accommodation uses the month's **completed** audit score when not typed in (drafts never count).
- Overall = average of the 8 scored KPIs (quarterly audit shown, not averaged).
  🟢 ≥90% on track · 🟡 ≥70% at risk · 🔴 below 70% critical.
- Tickets logged without a work order count for the contractor's only (active) work order; with two or
  more active work orders a new ticket must name one.

### Privacy
No worker names, Iqama, passport or phone numbers are stored: manpower is counts only, and every
free-text field says so. Settings › Remove data from this phone clears a shared or handed-over phone.
Deleted records keep only a tombstone; their contents are emptied on the server after 180 days and
deleted photo files are removed from storage.

## Deploy to Vercel (recommended)

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the **WW-APP** repository.
2. Select the production branch `claude/welfare-inspection-app-vvl8of`.
3. Click **Deploy** — Vercel auto-detects Vite; `vercel.json` in the repo handles caching/service-worker headers.

Every push to the branch redeploys automatically.

## Cloud sync with Supabase

The app opens on Sign in. New accounts wait until the Admin approves them (Users page), or the Admin
invites people by email with their role. Approved people share **one team data set**; row-level
security (`private.is_approved()`, `private.can_edit()`, `private.is_admin()`) decides who reads and who
writes: Admin (everything + users), Editor (add and change), Viewer (read only). Everything is stored on
the phone first and syncs when online, last write wins per record; the activity log is append-only and
stamped by the server with who sent each entry.

**Built-in project.** `.env.production` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public by
design: the key alone reads nothing). Schema, policies and functions: [`supabase/schema.sql`](supabase/schema.sql)
(safe to re-run); Edge Functions in `supabase/functions` (`sign-in`, `invite-user`).

**Supabase settings to keep** (Dashboard › Authentication): a custom SMTP sender (the built-in one only
reaches the project's own team), Site URL and redirect URL `https://ww-app-omega.vercel.app/`,
leaked-password protection on, minimum password length 8.

## Install on your phone

Host the built app anywhere static (Vercel, Netlify, GitHub Pages), open the URL in
Chrome/Safari on your phone, then **Add to Home Screen**. It installs like a native app and
works offline afterwards.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm test          # unit tests (KPI rules, sync rules, tickets, dashboard…)
npm run icons     # regenerate PWA icons (already committed)
```

Stack: Vite + React + TypeScript, `vite-plugin-pwa` (offline/service worker), Dexie
(IndexedDB), ExcelJS (xlsx export), docx (Word export).

## Where things live

- Checklist content: `src/templates/accommodation.ts` (generated 1:1 from the official
  workbook) and `src/templates/welfareAudit.ts` (placeholder).
- Excel workbook layout: `src/export/excel.ts`
- Word report layout: `src/export/word.ts`
- OXAGON logo used on the Word cover: `src/assets/`
- Co-pilot records + write path (activity log): `src/lib/records.ts`, types in `src/types.ts`
- KPI rules: `src/lib/kpi.ts` · dashboard maths: `src/lib/dashboard.ts` · aging: `src/lib/aging.ts`
- Monthly Excel/Word export: `src/export/monthly.ts`
