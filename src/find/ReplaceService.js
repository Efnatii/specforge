import { EditTransaction } from "../editor/EditTransaction.js";

function microYield() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class ReplaceService {
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

  async replaceOne({ result, needle, replacement, matchCase, wholeCell, useRegex }) {
    if (!result) {
      return { replaced: 0, skippedReadOnly: 0, skippedFormula: 0, skippedInvalid: 0 };
    }
    return this.replaceAll({ results: [result], needle, replacement, matchCase, wholeCell, useRegex, scope: "single" });
  }

  async replaceAll({ results = [], needle, replacement = "", matchCase = false, wholeCell = false, useRegex = false, scope = "sheet" }) {
    if (!results.length || !needle) {
      return { replaced: 0, skippedReadOnly: 0, skippedFormula: 0, skippedInvalid: 0 };
    }

    const runReplace = async (reportProgress = () => null) => {
      const workbook = this.getWorkbook();
      const state = this.getState();
      const sheetByName = new Map((workbook?.sheets || []).map((sheet) => [sheet.name, sheet]));
      const sheetIdByName = new Map((state.workbook.sheets || []).map((sheet) => [sheet.name, sheet.id]));

      const tx = new EditTransaction({ title: "Заменить всё", stateDriver: this.stateDriver, undoStack: this.undoStack, userAction: "replaceAll" });
      const summary = { replaced: 0, skippedReadOnly: 0, skippedFormula: 0, skippedInvalid: 0 };

      const regex = useRegex ? new RegExp(needle, matchCase ? "g" : "gi") : null;
      const cmpNeedle = matchCase ? needle : needle.toLowerCase();

      for (let i = 0; i < results.length; i += 1) {
        const item = results[i];
        const sheet = sheetByName.get(item.sheetName);
        const sheetId = sheetIdByName.get(item.sheetName);
        if (!sheet || !sheetId) {
          continue;
        }

        const baselineCell = this.getBaselineCell(sheet, item.addressA1);
        if (baselineCell?.formula) {
          summary.skippedFormula += 1;
          continue;
        }

        if (!this.templateSchema.isCellEditable(item.sheetName, item.addressA1, baselineCell)) {
          summary.skippedReadOnly += 1;
          continue;
        }

        const currentEdit = state.edits[sheetId]?.[item.addressA1] || null;
        const currentValue = currentEdit ? currentEdit.value : baselineCell?.value ?? "";
        const currentText = String(currentValue ?? "");

        let nextText = currentText;
        if (regex) {
          nextText = currentText.replace(regex, replacement);
        } else if (wholeCell) {
          const cmp = matchCase ? currentText : currentText.toLowerCase();
          if (cmp === cmpNeedle) {
            nextText = replacement;
          }
        } else {
          const source = matchCase ? currentText : currentText.toLowerCase();
          const idx = source.indexOf(cmpNeedle);
          if (idx >= 0) {
            nextText = `${currentText.slice(0, idx)}${replacement}${currentText.slice(idx + needle.length)}`;
          }
        }

        if (nextText === currentText) {
          continue;
        }

        const parsed = this.valueParser.parseInput({ inputString: nextText, baselineCell });
        if (!parsed.ok) {
          summary.skippedInvalid += 1;
          continue;
        }

        tx.add({
          sheetId,
          sheetName: item.sheetName,
          addressA1: item.addressA1,
          prevValue: currentValue,
          nextValue: parsed.value,
          prevType: typeof currentValue,
          nextType: parsed.type,
          ts: Date.now()
        });

        summary.replaced += 1;
        reportProgress({ completed: i + 1, total: results.length, message: "Замена" });
        if ((i + 1) % 500 === 0) {
          await microYield();
        }
      }

      tx.commit({
        auditEntry: {
          ts: Date.now(),
          userAction: "replaceAll",
          sheetName: scope,
          addressA1: needle,
          before: `replaced=${summary.replaced}`,
          after: `readonly=${summary.skippedReadOnly}, formula=${summary.skippedFormula}, invalid=${summary.skippedInvalid}`
        }
      });

      return summary;
    };

    let summary;
    if (results.length > 2000 && this.jobQueue) {
      const { promise } = this.jobQueue.enqueue({
        type: "REPLACE_ALL",
        title: "Заменить всё",
        run: async (_, signal, progress) => {
          if (signal.aborted) {
            throw new Error("Задача прервана");
          }
          return runReplace(progress);
        }
      });
      summary = await promise;
    } else {
      summary = await runReplace();
    }

    if (summary.replaced > 0) {
      this.onCellCommitted?.({ sheetName: results[0].sheetName, addressA1: results[0].addressA1, value: null });
    }

    this.toast?.show(`Замена: ${summary.replaced} обновлено, ${summary.skippedReadOnly} защищённых пропущено`, "info");
    return summary;
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


