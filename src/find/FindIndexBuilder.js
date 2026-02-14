import { DisplayValueService } from "../format/DisplayValueService.js";
import { NumFmtService } from "../format/NumFmtService.js";

function microYield() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class FindIndexBuilder {
  constructor() {
    this.displayValueService = new DisplayValueService();
    this.numFmtService = new NumFmtService();
  }

  async buildIndex({ scope = "sheet", normalizedWorkbook, edits = {}, calcSnapshot = {}, activeSheetName = null, signal = null, reportProgress = () => null }) {
    const entries = [];
    const sheets = scope === "sheet"
      ? (normalizedWorkbook?.sheets || []).filter((s) => s.name === activeSheetName)
      : (normalizedWorkbook?.sheets || []);

    let total = 0;
    for (const sheet of sheets) {
      total += (sheet.rows || []).reduce((acc, row) => acc + (row.cells?.length || 0), 0);
      total += Object.keys(edits[sheet.id] || {}).length;
    }
    total = Math.max(1, total);

    let processed = 0;
    for (const sheet of sheets) {
      const baselineMap = new Map();
      for (const row of sheet.rows || []) {
        for (const cell of row.cells || []) {
          baselineMap.set(cell.address, cell);
        }
      }

      const addresses = new Set([...baselineMap.keys(), ...Object.keys(edits[sheet.id] || {})]);
      const calcSheet = calcSnapshot.perSheet?.[sheet.name] || {};
      for (const addressA1 of addresses) {
        if (signal?.aborted) {
          throw new Error("Задача прервана");
        }

        const baselineCell = baselineMap.get(addressA1) || null;
        const overlayEdit = edits[sheet.id]?.[addressA1] || null;
        const calcResult = calcSheet[addressA1] || null;

        const display = this.displayValueService.getDisplay({
          sheetName: sheet.name,
          addressA1,
          baselineCell,
          overlayEdit,
          calcResult
        });

        const formatted = this.numFmtService.format({
          value: display.raw,
          numFmt: baselineCell?.numFmt || null,
          fallbackType: typeof display.raw,
          sheetName: sheet.name,
          addressA1
        });

        const text = String(formatted.text ?? "");
        if (text) {
          entries.push({ sheetName: sheet.name, addressA1, text });
        }

        processed += 1;
        if (processed % 2000 === 0) {
          reportProgress({ completed: processed, total, message: "Индексация ячеек" });
          await microYield();
        }
      }
    }

    reportProgress({ completed: total, total, message: "Индекс поиска готов" });
    return { ts: Date.now(), scope, activeSheetName, entries };
  }
}


