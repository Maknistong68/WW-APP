# WW App — Worker Welfare Inspections

A mobile-first **PWA** (Progressive Web App) for running worker welfare inspections and audits
from your phone: fill checklists, snap photos as evidence, record observations and corrective
actions, and export a finished **Excel** file and **Word** report — all offline, all stored on
your own device.

## How it works

1. **Home** → choose a checklist type:
   - Accommodation Inspection
   - Workers' Welfare Audit
2. Fill in the inspection details (contractor/camp, location, date, reference).
3. Work through the checklist. For each item: **Compliant / Non-compliant / N/A**,
   plus observation, corrective action, and photos.
4. **Photo-first flow** — tap the floating 📷 button any time: take the picture first,
   then pick which checklist item it belongs to. The app jumps you straight to that item
   to type the observation while it's fresh.
5. Export **Excel** (checklist + embedded photo evidence sheet) or a **Word report**
   (summary, findings tables, photo evidence) — generated entirely on the phone.

Everything is saved locally in the browser (IndexedDB), so it works with no signal at the
camp and nothing leaves your phone.

> **Placeholders:** the current checklist items and the export layouts are generic
> placeholders. They will be replaced 1:1 with the official checklists and the export made to
> match the official template 100% once those documents are provided. The **KPIs** section
> (contractor welfare KPIs) is intentionally empty for now.

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

## Where to plug in the real checklists

- Checklist content: `src/templates/index.ts` — one `InspectionTemplate` per checklist.
- Excel layout: `src/export/excel.ts`
- Word report layout: `src/export/word.ts`
