import { EditTransaction } from "./EditTransaction.js";
import { RangeOps } from "./RangeOps.js";

function transpose(matrix) {
  if (!matrix.length) {
    return [];
  }
  const rows = matrix.length;
  const cols = matrix[0].length;
  const out = Array.from({ length: cols }, () => Array(rows).fill(""));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out[c][r] = matrix[r][c];
    }
  }
  return out;
}

function microYield() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class PasteApplyService {
  constructor({ templateSchema, valueParser, stateDriver, undoStack, getWorkbook, getState, onCellCommitted, jobQueue, toast }) {
    this.templateSchema = templateSchema;
    this.valueParser = valueParser;
    this.stateDriver = stateDriver;
    this.undoStack = undoStack;
    this.getWorkbook = getWorkbook;
    this.getState = getState;
    this.onCellCommitted = onCellCommitted;
    this.jobQueue = jobQueue;
    this.toast = toast;
  }

  async apply({ targetRange, matrix, options }) {
    const opts = {
      mode: options?.mode || "normal",
      skipBlanks: Boolean(options?.skipBlanks),
      applyTo: options?.applyTo || "top-left",
      fillSelection: options?.fillSelection || "clamp"
    };

    const source = opts.mode === "transpose" ? transpose(matrix) : matrix;
    const state = this.getState();
    const activeSheetId = state.workbook.activeSheetId;
    const activeSheet = this.getWorkbook()?.sheets?.find((item) => item.id === activeSheetId);
    if (!activeSheet || !targetRange) {
      return { applied: 0, skipped: 0, report: "No target" };
    }

    const srcRows = source.length;
    const srcCols = source[0]?.length || 0;
    const total = srcRows * srcCols;

    const run = async (reportProgress = () => null) => {
      const tx = new EditTransaction({ title: "Paste special", stateDriver: this.stateDriver, undoStack: this.undoStack, userAction: "pasteSpecial" });
      let applied = 0;
      let skipped = 0;
      const touched = new Set();

      for (let r = 0; r < srcRows; r += 1) {
        for (let c = 0; c < srcCols; c += 1) {
          const srcValue = source[r][c] ?? "";
          if (opts.skipBlanks && String(srcValue) === "") {
            skipped += 1;
            continue;
          }

          let dr = targetRange.r1 + r;
          let dc = targetRange.c1 + c;
          if (opts.applyTo === "selection" && opts.fillSelection === "repeat") {
            dr = targetRange.r1 + (r % (targetRange.r2 - targetRange.r1 + 1));
            dc = targetRange.c1 + (c % (targetRange.c2 - targetRange.c1 + 1));
          }

          if (dr > targetRange.r2 || dc > targetRange.c2) {
            skipped += 1;
            continue;
          }

          const addressA1 = RangeOps.rcToA1({ r: dr, c: dc });
          if (touched.has(addressA1)) {
            continue;
          }
          touched.add(addressA1);

          const baselineCell = this.getBaselineCell(activeSheet, addressA1);
          if (!this.templateSchema.isCellEditable(activeSheet.name, addressA1, baselineCell)) {
            skipped += 1;
            continue;
          }

          const parsed = this.valueParser.parseInput({ inputString: String(srcValue), baselineCell });
          if (!parsed.ok) {
            skipped += 1;
            continue;
          }

          const prev = state.edits[activeSheetId]?.[addressA1]?.value ?? baselineCell?.value ?? null;
          if (this.stateDriver.valuesEqual(prev, parsed.value)) {
            continue;
          }

          tx.add({
            sheetId: activeSheetId,
            sheetName: activeSheet.name,
            addressA1,
            prevValue: prev,
            nextValue: parsed.value,
            prevType: typeof prev,
            nextType: parsed.type,
            ts: Date.now()
          });
          applied += 1;

          const done = r * srcCols + c + 1;
          reportProgress({ completed: done, total: total || 1, message: "Paste special" });
          if (done % 500 === 0) {
            await microYield();
          }
        }
      }

      tx.commit({
        auditEntry: {
          ts: Date.now(),
          userAction: "pasteSpecial",
          sheetName: activeSheet.name,
          addressA1: `${RangeOps.rcToA1({ r: targetRange.r1, c: targetRange.c1 })}:${RangeOps.rcToA1({ r: targetRange.r2, c: targetRange.c2 })}`,
          before: JSON.stringify(opts),
          after: `applied=${applied}, skipped=${skipped}`
        }
      });

      if (applied) {
        this.onCellCommitted?.({ sheetName: activeSheet.name, addressA1: RangeOps.rcToA1({ r: targetRange.r1, c: targetRange.c1 }), value: null });
      }

      return { applied, skipped, report: `Applied ${applied}, skipped ${skipped}` };
    };

    let result;
    if (total > 2000 && this.jobQueue) {
      const { promise } = this.jobQueue.enqueue({
        type: "PASTE_SPECIAL",
        title: "Paste special",
        run: async (_, signal, progress) => {
          if (signal.aborted) {
            throw new Error("Job aborted");
          }
          return run(progress);
        }
      });
      result = await promise;
    } else {
      result = await run();
    }

    this.toast?.show(result.report, "info");
    return result;
  }

  getBaselineCell(sheet, addressA1) {
    for (const row of sheet.rows || []) {
      for (const cell of row.cells || []) {
        if (cell.address === addressA1) {
          return cell;
        }
      }
    }
    return null;
  }
}
