import { HyperFormula } from "hyperformula";
import { AddressRangeUtil } from "../editor/TemplateSchema.js";
import { CalcModelBuilder } from "./CalcModelBuilder.js";

export class CalcEngine {
  constructor({ eventBus, stateStore }) {
    this.eventBus = eventBus;
    this.stateStore = stateStore;
    this.builder = new CalcModelBuilder();
    this.hf = null;
    this.sheetMeta = new Map();
    this.sheetIdByName = new Map();
    this.sheetNameById = new Map();
  }

  destroy() {
    this.hf?.destroy();
    this.hf = null;
    this.sheetMeta = new Map();
    this.sheetIdByName = new Map();
    this.sheetNameById = new Map();
  }

  async buildFromBaseline({ normalizedWorkbook, edits = {}, reportProgress, reportWarning }) {
    this.destroy();

    reportProgress?.({ completed: 0, total: 3, message: "Build calc arrays" });
    const built = this.builder.build({ normalizedWorkbook, edits, reportWarning });

    for (const sheet of normalizedWorkbook?.sheets || []) {
      this.sheetNameById.set(sheet.id, sheet.name);
      this.sheetIdByName.set(sheet.name, sheet.id);
    }

    reportProgress?.({ completed: 1, total: 3, message: "Create HyperFormula" });

    this.hf = HyperFormula.buildFromSheets(built.sheets, {
      licenseKey: "gpl-v3",
      useArrayArithmetic: false
    });

    this.sheetMeta = built.sheetMeta;
    reportProgress?.({ completed: 2, total: 3, message: "Collect snapshot" });

    return {
      warnings: built.warnings,
      calcSnapshot: this.buildSnapshot()
    };
  }

  applyEditsOverlay(edits) {
    if (!this.hf) {
      return [];
    }

    const changes = [];
    for (const [sheetId, sheetEdits] of Object.entries(edits || {})) {
      const sheetName = this.sheetNameById.get(sheetId);
      if (!sheetName) {
        continue;
      }

      for (const [addressA1, payload] of Object.entries(sheetEdits || {})) {
        changes.push(...this.setCellValue({ sheetName, addressA1, value: payload?.value }));
      }
    }

    return changes;
  }

  setCellValue({ sheetName, addressA1, value }) {
    if (!this.hf) {
      return [];
    }

    const sheetId = this.hf.getSheetId(sheetName);
    if (sheetId === undefined || sheetId === null) {
      return [];
    }

    const cellAddress = this.hf.simpleCellAddressFromString(addressA1, sheetId);
    if (!cellAddress) {
      return [];
    }

    const results = this.hf.setCellContents(cellAddress, [[value ?? null]]) || [];
    return results.map((item) => {
      const nextSheetName = this.hf.getSheetName(item.address.sheet);
      const a1 = AddressRangeUtil.toA1(item.address.row + 1, item.address.col + 1);
      return {
        sheetName: nextSheetName,
        addressA1: a1,
        value: this.normalizeResultValue(item.value),
        error: this.extractError(item.value)
      };
    });
  }

  getCellResult({ sheetName, addressA1 }) {
    if (!this.hf) {
      return { value: null, error: null, type: "empty" };
    }

    const sheetId = this.hf.getSheetId(sheetName);
    const cellAddress = this.hf.simpleCellAddressFromString(addressA1, sheetId);
    if (!cellAddress) {
      return { value: null, error: null, type: "empty" };
    }

    const value = this.hf.getCellValue(cellAddress);
    return {
      value: this.normalizeResultValue(value),
      error: this.extractError(value),
      type: this.extractError(value) ? "error" : typeof this.normalizeResultValue(value)
    };
  }

  getSheetValuesForRender(sheetName) {
    const map = new Map();
    const meta = this.sheetMeta.get(sheetName);
    if (!meta) {
      return map;
    }

    for (let row = 1; row <= meta.rowCount; row += 1) {
      for (let col = 1; col <= meta.colCount; col += 1) {
        const addressA1 = AddressRangeUtil.toA1(row, col);
        const result = this.getCellResult({ sheetName, addressA1 });
        map.set(addressA1, result);
      }
    }

    return map;
  }

  buildSnapshot() {
    const perSheet = {};
    for (const [sheetName] of this.sheetMeta.entries()) {
      perSheet[sheetName] = {};
      const values = this.getSheetValuesForRender(sheetName);
      for (const [addressA1, payload] of values.entries()) {
        perSheet[sheetName][addressA1] = payload;
      }
    }
    return { perSheet };
  }

  normalizeResultValue(value) {
    if (this.extractError(value)) {
      return null;
    }
    return value ?? null;
  }

  extractError(value) {
    if (value && typeof value === "object") {
      if ("value" in value && "type" in value) {
        return String(value.value || value.type || "#ERROR");
      }
      if ("message" in value && "type" in value) {
        return String(value.message || value.type || "#ERROR");
      }
      if (value.constructor?.name === "CellError") {
        return String(value);
      }
    }
    return null;
  }
}
