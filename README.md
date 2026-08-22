# WW App — Worker Welfare Inspections

A mobile-first **PWA** (Progressive Web App) for running worker welfare inspections and audits
from your phone: fill checklists, snap photos as evidence, record observations and corrective
actions, and export a finished **Excel** file and **Word** report — all offline, all stored on
your own device.

## How it works

1. **Home** → choose a checklist type:
   - **Labour Accommodation Audit** — the official NEOM Worker Welfare assessment
     questionnaire (Sections A–X, 160 questions), copied 1:1 from the official workbook.
   - Workers' Welfare Audit (placeholder until the official checklist is provided).
2. Fill in the general information (region, facility, occupancy, contractor, work order…).
3. Work through the questionnaire. Each question gets **Yes / No / N-A**, a
   **compliance assessment** (Full / Partial / No compliance / N-A), an observation,
   an action plan, and photos.
4. **Photo-first flow** — tap the floating 📷 button any time: take the picture first,
   then pick which question it belongs to. The app jumps straight there so you can type
   the observation while it's fresh, and pre-selects "No compliance" for you.
5. Export:
   - **Excel** — the full *Workers Camp Welfare Inspection Report* workbook (Cover,
     Table of Contents, General Information with site photos, Assessment Scale,
     Assessment Questionnaire with live scoring formulas and dropdowns, Summary of
     observations, Photo Evidence). Same layout, styling, and formulas as the official
     template.
   - **Word** — the *Non-Compliance findings report* (NEOM/OXAGON cover, Objective,
     Methodology, Reference, general info table, observations table with photos,
     Conclusion), matching the official report layout.

Everything is saved locally in the browser (IndexedDB), so it works with no signal at the
camp and nothing leaves your phone.

> The **KPIs** section (contractor welfare KPIs) is intentionally empty for now, and the
> Workers' Welfare Audit checklist is still a placeholder awaiting the official document.

## Deploy to Vercel (recommended)

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the **WW-APP** repository.
2. Select the branch to deploy (`claude/welfare-inspection-app-vvl8of` until it's merged to main).
3. Click **Deploy** — Vercel auto-detects Vite; `vercel.json` in the repo handles caching/service-worker headers.

Every push to the branch redeploys automatically.

## Cloud sync with Supabase (optional)

The app is fully usable offline with no account. To sync inspections + photos to your own
free Supabase database (survives phone loss, works across devices):

1. Create a project at [supabase.com](https://supabase.com) (free tier is plenty).
2. In the project: **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the
   `inspections` and `photos` tables (with row-level security so only you can read your
   data) and a private storage bucket for photo files.
3. In the app: **⚙ Settings → Cloud sync** → paste your **Project URL** and **anon public
   key** (from Supabase → Settings → API), then create your account / sign in.
4. Tap **Sync now** — the app also syncs automatically whenever it opens with internet.

Sync is offline-first with last-write-wins per inspection; deletions propagate across
devices.

## Install on your phone

Host the built app anywhere static (Vercel, Netlify, GitHub Pages), open the URL in
Chrome/Safari on your phone, then **Add to Home Screen**. It installs like a native app and
works offline afterwards.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run icons     # regenerate PWA icons (already committed)
```

Stack: Vite + React + TypeScript, `vite-plugin-pwa` (offline/service worker), Dexie
(IndexedDB), ExcelJS (xlsx export), docx (Word export).

## Where things live

- Checklist content: `src/templates/accommodation.ts` (generated 1:1 from the official
  workbook) and `src/templates/welfareAudit.ts` (placeholder).
- Excel workbook layout: `src/export/excel.ts`
- Word report layout: `src/export/word.ts`
- NEOM / OXAGON logos used on the Word cover: `src/assets/`
