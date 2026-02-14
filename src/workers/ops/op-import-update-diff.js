import ExcelJS from "exceljs/dist/exceljs.min.js";
import { TemplateFingerprint } from "../../xlsx/TemplateFingerprint.js";
import { TemplateSchema } from "../../editor/TemplateSchema.js";

function valueForCompare(cell) {
  const raw = cell?.value;
  if (raw === null || raw === undefined) { return null; }
  if (typeof raw === "number") { return raw; }
  if (typeof raw === "string") { return raw.trimEnd(); }
  if (raw && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "result")) {
    const v = raw.result;
    if (v === null || v === undefined) { return null; }
    return typeof v === "string" ? v.trimEnd() : v;
  }
  try { return JSON.stringify(raw); } catch { return String(raw); }
}

function normalizedEditValue(cell) {
  const raw = cell?.value;
  if (raw === null || raw === undefined) { return null; }
  if (typeof raw === "number") { return raw; }
  if (typeof raw === "string") { return raw; }
  if (raw && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "result")) {
    return raw.result ?? null;
  }
  return String(raw);
}

export async function runImportUpdateDiff({ payload, signal, reportProgress }) {
  if (signal.aborted) {
    throw cancelled();
  }

  const fp = new TemplateFingerprint();
  const schema = new TemplateSchema(payload.schema || {});

  const wbBase = new ExcelJS.Workbook();
  const wbImp = new ExcelJS.Workbook();
  await wbBase.xlsx.load(payload.baselineBuffer);
  await wbImp.xlsx.load(payload.importedBuffer);

  const adapter = await import("../../xlsx/WorkbookAdapter.js");
  const ad = new adapter.WorkbookAdapter();
  const normalizedImported = await ad.parse(payload.importedBuffer);
  const importedFp = fp.buildStructureFingerprint(normalizedImported);
  const compare = fp.compareStructure(payload.structureFingerprintBaseline, importedFp);
  if (!compare.ok) {
    const err = new Error(compare.reason || "Incompatible template");
    err.code = "INCOMPATIBLE_TEMPLATE";
    throw err;
  }

  const nextEdits = {};
  let changed = 0;
  let skippedReadOnly = 0;
  let skippedFormula = 0;
  let scanned = 0;
  let total = 1;

  const wbSheets = payload.workbookSheets || [];
  for (const sheetMeta of wbSheets) {
    const wsBase = wbBase.getWorksheet(sheetMeta.name);
    const wsImp = wbImp.getWorksheet(sheetMeta.name);
    if (!wsBase || !wsImp) { continue; }
    const ranges = schema.getEditableRangesForSheet(sheetMeta.name);
    for (const range of ranges) {
      total += (range.bottom - range.top + 1) * (range.right - range.left + 1);
    }
  }

  for (const sheetMeta of wbSheets) {
    const wsBase = wbBase.getWorksheet(sheetMeta.name);
    const wsImp = wbImp.getWorksheet(sheetMeta.name);
    if (!wsBase || !wsImp) { continue; }

    const ranges = schema.getEditableRangesForSheet(sheetMeta.name);
    const edits = {};

    for (const range of ranges) {
      for (let r = range.top; r <= range.bottom; r += 1) {
        for (let c = range.left; c <= range.right; c += 1) {
          if (signal.aborted) {
            throw cancelled();
          }

          const address = `${toCol(c)}${r}`;
          const baseCell = wsBase.getCell(address);
          const impCell = wsImp.getCell(address);

          if (baseCell?.formula || (baseCell?.value && typeof baseCell.value === "object" && baseCell.value.formula)) {
            skippedFormula += 1;
          } else if (!schema.isCellEditable(sheetMeta.name, address, { formula: null })) {
            skippedReadOnly += 1;
          } else {
            const b = valueForCompare(baseCell);
            const i = valueForCompare(impCell);
            if (!equalsValue(b, i)) {
              edits[address] = { value: normalizedEditValue(impCell), type: typeof normalizedEditValue(impCell), updatedAtTs: Date.now() };
              changed += 1;
            }
          }

          scanned += 1;
          if (scanned % 1000 === 0) {
            reportProgress({ completed: scanned, total, message: "Scanning diff" });
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
      }
    }

    if (Object.keys(edits).length) {
      nextEdits[sheetMeta.id] = edits;
    }
  }

  reportProgress({ completed: total, total, message: "Diff ready" });

  return {
    nextEdits,
    stats: { changed, skippedReadOnly, skippedFormula, skippedOutOfBounds: 0 },
    warnings: []
  };
}

function toCol(col) {
  let value = col;
  let letters = "";
  while (value > 0) {
    const rem = (value - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function equalsValue(a, b) {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

function cancelled() {
  const err = new Error("Cancelled");
  err.code = "CANCELLED";
  return err;
}
