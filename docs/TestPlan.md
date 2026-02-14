# Test Plan

## Preconditions
- Run `npm i && npm run dev`.
- Load baseline workbook and ensure at least one editable sheet.
- Open browser DevTools for network/console checks.

## A. Edit -> Export -> Excel reopen
1. Edit several editable cells.
2. Export `.xlsx`.
3. Open in Excel and verify values/styles/merges.
4. Expected: formatting preserved; edited values applied; no stuck `RUNNING` jobs.

## B. Import Update -> QC -> Export
1. Open exported file in Excel and modify editable fields.
2. Save and run `Import (Update)`.
3. Run `QC Scan`.
4. Export again.
5. Expected: diff converted to overlay edits; QC report generated; export works.

## C. Add Assembly -> Export -> Reopen
1. Click `+ Assembly`, add new ABBR.
2. Verify paired sheets exist.
3. Export and reopen in Excel.
4. Expected: new pair included in workbook and layout intact.

## D. Reload mid-job recovery
1. Open `?devtools=1` and trigger `Start long job`.
2. Trigger `Reload in 2s` while job is running.
3. After reload, inspect jobs panel.
4. Expected: no stale `RUNNING`; jobs are re-queued or failed by recovery policy.

## E. Cancel job
1. Start long job.
2. Click `Cancel` in jobs panel.
3. Expected: terminal `CANCELLED`, no background progress afterward.

## F. Offline recovery
1. Load workbook, then set DevTools network to `Offline`.
2. Reload page.
3. Expected: workbook and edits restore from IndexedDB; asset network loads fail with clear message but UI remains usable.
4. Return network to `Online` and verify normal behavior resumes.

## G. Chaos fail-next and throttle
1. In Chaos panel, set throttle delay.
2. Click `Fail next attempt`.
3. Start long job.
4. Expected: first attempt fails, retry policy applies (if attempts remain), final status done/failed without hanging.

## H. Find/Replace smoke
1. Build find index on workbook.
2. Use `Replace all` for an editable text token.
3. Expected: protected/formula cells skipped and reported; undo restores changes.
