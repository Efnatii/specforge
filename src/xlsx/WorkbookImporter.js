import ExcelJS from "exceljs/dist/exceljs.min.js";
import { TEMPLATE_TAG } from "./WorkbookExporter.js";

const YIELD_CHUNK = 500;

export class WorkbookImporter {
  constructor({ templateLoader, workbookAdapter, templateFingerprint, templateSchema }) {
    this.templateLoader = templateLoader;
    this.workbookAdapter = workbookAdapter;
    this.templateFingerprint = templateFingerprint;
    this.templateSchema = templateSchema;
  }

  async importReplaceTemplate(file, signal, reportProgress) {
    this.assertNotAborted(signal);
    reportProgress?.({ completed: 0, total: 4, message: "Reading file" });

    const { buffer, meta } = await this.templateLoader.loadFromFile(file);

    this.assertNotAborted(signal);
    reportProgress?.({ completed: 1, total: 4, message: "Parsing workbook" });

    const normalizedWorkbook = await this.workbookAdapter.parse(buffer);
    const structureFingerprint = this.templateFingerprint.buildStructureFingerprint(normalizedWorkbook);
    const bufferHash = await this.templateFingerprint.hashBufferSha256(buffer);

    this.assertNotAborted(signal);
    reportProgress?.({ completed: 2, total: 4, message: "Scanning metadata" });

    const { softTagFound } = await this.inspectWorkbook(buffer);

    this.assertNotAborted(signal);
    reportProgress?.({ completed: 3, total: 4, message: "Ready" });

    return {
      buffer,
      meta,
      normalizedWorkbook,
      structureFingerprint,
      bufferHash,
      softTagFound
    };
  }

  async importAsEdits(file, options, signal, reportProgress) {
    const { baselineBuffer, baselineStructureFingerprint, workbookSheets } = options;
    if (!baselineBuffer) {
      throw new Error("Baseline template buffer is missing");
    }

    this.assertNotAborted(signal);
    reportProgress?.({ completed: 0, total: 100, message: "Reading imported file" });

    const { buffer: importedBuffer } = await this.templateLoader.loadFromFile(file);
    const importedNormalized = await this.workbookAdapter.parse(importedBuffer);
    const importedFingerprint = this.templateFingerprint.buildStructureFingerprint(importedNormalized);
    const compareResult = this.templateFingerprint.compareStructure(baselineStructureFingerprint, importedFingerprint);

    const baselineWb = new ExcelJS.Workbook();
    const importedWb = new ExcelJS.Workbook();
    await baselineWb.xlsx.load(baselineBuffer);
    await importedWb.xlsx.load(importedBuffer);

    const { softTagFound } = await this.inspectWorkbook(importedBuffer);

    if (!compareResult.ok) {
      return {
        compatible: false,
        reason: compareResult.reason,
        softTagFound
      };
    }

    const sheetIdByName = new Map((workbookSheets || []).map((item) => [item.name, item.id]));
    const nextEdits = {};

    const scanPlan = this.buildScanPlan(workbookSheets, baselineWb, importedWb);
    const total = Math.max(1, scanPlan.totalCells);
    let completed = 0;

    for (const plan of scanPlan.items) {
      const sheetId = sheetIdByName.get(plan.sheetName);
      if (!sheetId) {
        completed += plan.cellCount;
        continue;
      }

      const wsBase = baselineWb.getWorksheet(plan.sheetName);
      const wsImp = importedWb.getWorksheet(plan.sheetName);
      if (!wsBase || !wsImp) {
        completed += plan.cellCount;
        continue;
      }

      for (const range of plan.ranges) {
        for (let row = range.top; row <= range.bottom; row += 1) {
          for (let col = range.left; col <= range.right; col += 1) {
            const baseCell = wsBase.getRow(row).getCell(col);
            const importedCell = wsImp.getRow(row).getCell(col);

            if (this.isFormulaCell(baseCell)) {
              completed += 1;
              continue;
            }

            const baseValue = this.normalizeCellValueForCompare(baseCell.value);
            const importedValue = this.normalizeCellValueForCompare(importedCell.value);

            if (!this.valuesEqual(baseValue, importedValue)) {
              const addressA1 = importedCell.address;
              if (!nextEdits[sheetId]) {
                nextEdits[sheetId] = {};
              }

              nextEdits[sheetId][addressA1] = {
                value: this.normalizeCellValueForEdit(importedCell.value),
                type: this.detectType(importedCell.value),
                updatedAtTs: Date.now()
              };
            }

            completed += 1;
            if (completed % YIELD_CHUNK === 0) {
              await this.microYield();
            }

            const progress = Math.min(total, completed);
            reportProgress?.({ completed: progress, total, message: "Scanning editable cells" });
          }
        }
      }
    }

    const changedCells = Object.values(nextEdits).reduce((sum, sheet) => sum + Object.keys(sheet).length, 0);

    return {
      compatible: true,
      nextEdits,
      changedCells,
      softTagFound
    };
  }

  buildScanPlan(workbookSheets, baselineWb, importedWb) {
    let totalCells = 0;
    const items = [];

    for (const sheet of workbookSheets || []) {
      const ranges = this.templateSchema.getEditableRangesForSheet(sheet.name);
      if (ranges.length === 0) {
        continue;
      }

      const wsBase = baselineWb.getWorksheet(sheet.name);
      const wsImp = importedWb.getWorksheet(sheet.name);
      if (!wsBase || !wsImp) {
        continue;
      }

      const maxRow = Math.max(wsBase.rowCount || 1, wsImp.rowCount || 1);
      const maxCol = Math.max(wsBase.columnCount || 1, wsImp.columnCount || 1);

      const boundedRanges = [];
      let cellCount = 0;

      for (const range of ranges) {
        const bounded = {
          top: Math.max(1, Math.min(range.top, maxRow)),
          left: Math.max(1, Math.min(range.left, maxCol)),
          bottom: Math.max(1, Math.min(range.bottom, maxRow)),
          right: Math.max(1, Math.min(range.right, maxCol))
        };

        if (bounded.bottom < bounded.top || bounded.right < bounded.left) {
          continue;
        }

        boundedRanges.push(bounded);
        cellCount += (bounded.bottom - bounded.top + 1) * (bounded.right - bounded.left + 1);
      }

      if (boundedRanges.length === 0) {
        continue;
      }

      totalCells += cellCount;
      items.push({ sheetName: sheet.name, ranges: boundedRanges, cellCount });
    }

    return { totalCells, items };
  }

  async inspectWorkbook(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const marker = `${workbook.subject || ""} ${workbook.keywords || ""}`;
    return {
      softTagFound: marker.includes(TEMPLATE_TAG)
    };
  }

  isFormulaCell(cell) {
    return Boolean(cell?.formula)
      || Boolean(cell?.value && typeof cell.value === "object" && cell.value.formula);
  }

  normalizeCellValueForEdit(rawValue) {
    const normalized = this.normalizeCellValueForCompare(rawValue);
    if (normalized === null) {
      return null;
    }

    if (typeof normalized === "number") {
      return normalized;
    }

    return String(normalized);
  }

  detectType(rawValue) {
    const normalized = this.normalizeCellValueForCompare(rawValue);
    if (normalized === null) {
      return "null";
    }

    if (typeof normalized === "number") {
      return "number";
    }

    return "string";
  }

  normalizeCellValueForCompare(rawValue) {
    if (rawValue === undefined || rawValue === null) {
      return null;
    }

    if (typeof rawValue === "number") {
      return Number.isFinite(rawValue) ? rawValue : null;
    }

    if (typeof rawValue === "string") {
      return rawValue.replace(/\s+$/g, "");
    }

    if (rawValue instanceof Date) {
      return rawValue.toISOString();
    }

    if (typeof rawValue === "object") {
      if (Object.prototype.hasOwnProperty.call(rawValue, "formula")) {
        if (rawValue.result === undefined || rawValue.result === null) {
          return null;
        }
        return this.normalizeCellValueForCompare(rawValue.result);
      }

      if (Array.isArray(rawValue.richText)) {
        return rawValue.richText.map((part) => part.text || "").join("").replace(/\s+$/g, "");
      }

      if (typeof rawValue.text === "string") {
        return rawValue.text.replace(/\s+$/g, "");
      }

      return this.stableStringify(rawValue);
    }

    return String(rawValue);
  }

  stableStringify(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    }

    const keys = Object.keys(value).sort();
    const mapped = keys.map((key) => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`);
    return `{${mapped.join(",")}}`;
  }

  valuesEqual(a, b) {
    return a === b || (Number.isNaN(a) && Number.isNaN(b));
  }

  microYield() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  assertNotAborted(signal) {
    if (signal?.aborted) {
      throw new Error("Job aborted");
    }
  }
}
