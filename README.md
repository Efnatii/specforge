# SpecForge - Static XLSX Template Editor

Browser-only SPA for TKP workflows on GitHub Pages.

## Core
- Load baseline `.xlsx` from assets or file picker
- Read-only/Editable Excel-like grid (styles, merges, sizes)
- Protected editing by schema + undo/redo + audit
- Baseline buffer + edits overlay persistence in IndexedDB

## Import/Export
- Export `.xlsx` from baseline buffer + overlay edits
- Import update (diff to edits) / import replace template
- Structure fingerprint validation + compatibility checks
- Add assembly sheet pairs (`Расход. мат. <ABBR>` + `<ABBR>`)

## Calc + Format + QC
- Formula recalculation with HyperFormula (`licenseKey: 'gpl-v3'`)
- Display formatting from `numFmt` (best-effort via `ssf`)
- QC panel (errors/warnings), jump-to-cell, CSV/XLSX QC export

## Print + Domain Sync
- Print/Preview dialog with sheet template selection
- pageSetup mapping from XLSX to print CSS (best-effort)
- Domain model for assemblies (`tkpModel`) with right-panel table
- Binding map driven sync (model -> workbook and workbook -> model preview)
- AutoFill always goes through Preview -> Apply (no silent changes)

## Run
```bash
npm i
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## GitHub Pages (Actions)
1. Open repository `Settings -> Pages`.
2. Set `Source` to `GitHub Actions`.
3. Push to `main` or run workflow manually.
4. Workflow file: `.github/workflows/pages.yml`.
5. Build smoke checks verify `dist/index.html` before deploy.

## GitHub Pages Troubleshooting
1. White screen + `index.html` contains `<script src="/src/main.js">` means Pages is serving source files, not `dist`; switch Pages source to `GitHub Actions`.
2. Asset 404 on `/<repo>/assets/*` usually means wrong Vite `base`; use repository base path (for this repo: `/specforge/`).
3. If deep SPA routes fail on reload, keep `dist/404.html` fallback (generated from built `index.html`).
4. Keep `dist/.nojekyll` to avoid Jekyll processing issues in Pages hosting.
5. Run `npm run smoke:pages` after build to validate asset paths and referenced files.

## Recovery + Workers
- Heavy jobs can run via Web Workers (`src/workers/*`) through RPC protocol v1.
- Job leases are stored in IndexedDB and recovered on boot; stale `RUNNING` jobs are re-queued or failed by recovery policy.
- Dev chaos tools can be enabled with `?devtools=1`.

## Manual E2E
- See `docs/TestPlan.md` for end-to-end and chaos scenarios.

## Notes
- HyperFormula is used only for formula recalculation; XLSX IO is via ExcelJS.
- `gpl-v3` license key is configured for HyperFormula. Public distribution should respect GPLv3 compatibility.
- Browser print is best-effort; exact pagination/backgrounds depend on browser print settings.
