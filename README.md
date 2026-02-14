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

## Notes
- HyperFormula is used only for formula recalculation; XLSX IO is via ExcelJS.
- `gpl-v3` license key is configured for HyperFormula. Public distribution should respect GPLv3 compatibility.
- Browser print is best-effort; exact pagination/backgrounds depend on browser print settings.
