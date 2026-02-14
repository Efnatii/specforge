import { AddressRangeUtil } from "../editor/TemplateSchema.js";

export class QcRules {
  collect({ workbook, edits, calcSnapshot, schema, editorErrors = {}, numFmtWarnings = [] }) {
    const items = [];

    this.collectFormulaErrors(workbook, calcSnapshot, items);
    this.collectEditorErrors(editorErrors, workbook, items);
    this.collectExternalWarnings(numFmtWarnings, items);
    this.collectRequired(workbook, edits, calcSnapshot, schema, items);
    this.collectConstraints(workbook, edits, calcSnapshot, schema, items);

    return items;
  }

  collectFormulaErrors(workbook, calcSnapshot, items) {
    const perSheet = calcSnapshot?.perSheet || {};
    for (const sheet of workbook?.sheets || []) {
      const map = perSheet[sheet.name] || {};
      for (const row of sheet.rows || []) {
        for (const cell of row.cells || []) {
          if (!cell.formula) {
            continue;
          }

          const calc = map[cell.address];
          if (calc?.error) {
            items.push({
              level: "error",
              code: "ERR_FORMULA",
              sheetName: sheet.name,
              addressA1: cell.address,
              message: `Ошибка формулы: ${calc.error}`
            });
          }
        }
      }
    }
  }

  collectEditorErrors(editorErrors, workbook, items) {
    const sheetNameById = new Map((workbook?.sheets || []).map((sheet) => [sheet.id, sheet.name]));
    for (const [sheetId, byAddress] of Object.entries(editorErrors || {})) {
      const sheetName = sheetNameById.get(sheetId);
      if (!sheetName) {
        continue;
      }

      for (const [addressA1, message] of Object.entries(byAddress || {})) {
        items.push({
          level: "error",
          code: "ERR_INVALID_INPUT",
          sheetName,
          addressA1,
          message: String(message || "Invalid input")
        });
      }
    }
  }

  collectExternalWarnings(numFmtWarnings, items) {
    for (const warning of numFmtWarnings || []) {
      const parts = String(warning).split("!");
      const isShared = String(warning).toLowerCase().includes("shared formula");
      items.push({
        level: "warning",
        code: isShared ? "WARN_SHARED_FORMULA" : "WARN_NUMFMT_UNSUPPORTED",
        sheetName: parts[0] || "?",
        addressA1: parts[1] || "?",
        message: warning
      });
    }
  }

  collectRequired(workbook, edits, calcSnapshot, schema, items) {
    for (const sheet of workbook?.sheets || []) {
      const required = schema?.getRequiredRulesForSheet?.(sheet.name) || [];
      for (const addressA1 of this.expandRanges(required)) {
        const value = this.resolveEffectiveValue(sheet, addressA1, edits, calcSnapshot);
        if (value === null || value === undefined || String(value).trim() === "") {
          items.push({
            level: "warning",
            code: "WARN_REQUIRED_EMPTY",
            sheetName: sheet.name,
            addressA1,
            message: "Required cell is empty"
          });
        }
      }
    }
  }

  collectConstraints(workbook, edits, calcSnapshot, schema, items) {
    for (const sheet of workbook?.sheets || []) {
      const constraints = schema?.getConstraintsForSheet?.(sheet.name) || [];
      for (const constraint of constraints) {
        const addresses = this.expandRanges([constraint.range]);
        for (const addressA1 of addresses) {
          const value = this.resolveEffectiveValue(sheet, addressA1, edits, calcSnapshot);
          this.checkConstraint(sheet.name, addressA1, value, constraint, items);
        }
      }
    }
  }

  resolveEffectiveValue(sheet, addressA1, edits, calcSnapshot) {
    const sheetEdits = edits?.[sheet.id] || {};
    if (Object.prototype.hasOwnProperty.call(sheetEdits, addressA1)) {
      return sheetEdits[addressA1]?.value ?? null;
    }

    const baselineCell = this.findCell(sheet, addressA1);
    if (baselineCell?.formula) {
      return calcSnapshot?.perSheet?.[sheet.name]?.[addressA1]?.value ?? null;
    }

    return baselineCell?.value ?? null;
  }

  checkConstraint(sheetName, addressA1, value, constraint, items) {
    if (value === null || value === undefined || value === "") {
      return;
    }

    if (constraint.type === "number" || constraint.type === "integer") {
      if (typeof value !== "number" || Number.isNaN(value)) {
        items.push({
          level: "warning",
          code: "WARN_TEXT_IN_NUMBER_CELL",
          sheetName,
          addressA1,
          message: "Text in numeric constrained cell"
        });
        return;
      }

      if (constraint.type === "integer" && !Number.isInteger(value)) {
        items.push({
          level: "warning",
          code: "WARN_TEXT_IN_NUMBER_CELL",
          sheetName,
          addressA1,
          message: "Expected integer value"
        });
      }

      if (typeof constraint.min === "number" && value < constraint.min) {
        items.push({
          level: "warning",
          code: "WARN_NEGATIVE_WHERE_NOT_ALLOWED",
          sheetName,
          addressA1,
          message: `Value ${value} ниже минимума ${constraint.min}`
        });
      }
    }
  }

  expandRanges(entries) {
    const out = [];
    for (const entry of entries || []) {
      if (!entry) {
        continue;
      }

      const rangeText = typeof entry === "string" ? entry : entry.range || entry.a1;
      if (!rangeText) {
        continue;
      }

      const range = AddressRangeUtil.parseRange(rangeText);
      for (let row = range.top; row <= range.bottom; row += 1) {
        for (let col = range.left; col <= range.right; col += 1) {
          out.push(AddressRangeUtil.toA1(row, col));
        }
      }
    }
    return out;
  }

  findCell(sheet, addressA1) {
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

