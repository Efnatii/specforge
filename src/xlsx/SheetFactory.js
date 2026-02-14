import ExcelJS from "exceljs/dist/exceljs.min.js";

export class SheetFactory {
  constructor(workbookAdapter) {
    this.workbookAdapter = workbookAdapter;
  }

  sanitizeAbbr(input) {
    const normalized = String(input || "").trim().replace(/\s+/g, "_");
    const cleaned = normalized.replace(/[^A-Za-zА-Яа-я0-9_-]/g, "");
    if (!cleaned) {
      throw new Error("Invalid assembly abbreviation");
    }
    return cleaned;
  }

  async addAssemblyPair({ baselineBuffer, abbr }) {
    const safeAbbr = this.sanitizeAbbr(abbr);
    const consumablesName = `Расход. мат. ${safeAbbr}`;
    const assemblyName = safeAbbr;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(baselineBuffer);

    if (workbook.getWorksheet(consumablesName) || workbook.getWorksheet(assemblyName)) {
      throw new Error("Assembly sheets already exist");
    }

    const prototypes = this.findPrototypePair(workbook);
    const consumablesClone = this.cloneSheet(workbook, prototypes.consumablesSheet, consumablesName);
    const assemblyClone = this.cloneSheet(workbook, prototypes.assemblySheet, assemblyName);

    const mapOldToNew = new Map([
      [prototypes.assemblySheet.name, assemblyName],
      [prototypes.consumablesSheet.name, consumablesName]
    ]);

    this.rewriteFormulas(consumablesClone, mapOldToNew);
    this.rewriteFormulas(assemblyClone, mapOldToNew);

    const newBaselineBuffer = await workbook.xlsx.writeBuffer();
    const normalizedWorkbook = await this.workbookAdapter.parse(newBaselineBuffer);

    return {
      newBaselineBuffer,
      normalizedWorkbook,
      addedSheets: [consumablesName, assemblyName]
    };
  }

  findPrototypePair(workbook) {
    const worksheets = workbook.worksheets;

    const assemblySheet = worksheets.find((sheet) => {
      return sheet.name !== "Общее" && !sheet.name.startsWith("Расход. мат. ");
    });

    if (!assemblySheet) {
      throw new Error("Assembly prototype sheet not found");
    }

    const directConsumables = workbook.getWorksheet(`Расход. мат. ${assemblySheet.name}`);
    const consumablesSheet = directConsumables
      || worksheets.find((sheet) => sheet.name.startsWith("Расход. мат. "));

    if (!consumablesSheet) {
      throw new Error("Consumables prototype sheet not found");
    }

    return {
      assemblySheet,
      consumablesSheet
    };
  }

  cloneSheet(workbook, sourceSheet, targetName) {
    const clone = workbook.addWorksheet(`${targetName}_temp`);
    clone.model = JSON.parse(JSON.stringify(sourceSheet.model));
    clone.name = targetName;
    return clone;
  }

  rewriteFormulas(worksheet, mapOldToNew) {
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const current = cell.value;

        if (current && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, "formula")) {
          cell.value = {
            ...current,
            formula: this.rewriteFormulaSheetRefs(current.formula, mapOldToNew)
          };
          return;
        }

        if (typeof cell.formula === "string") {
          cell.value = {
            formula: this.rewriteFormulaSheetRefs(cell.formula, mapOldToNew)
          };
        }
      });
    });
  }

  rewriteFormulaSheetRefs(formula, mapOldToNew) {
    let next = String(formula || "");

    for (const [oldName, newName] of mapOldToNew.entries()) {
      const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      next = next.replace(new RegExp(`'${escapedOld}'!`, "g"), `'${newName}'!`);
      next = next.replace(new RegExp(`\\b${escapedOld}!`, "g"), `${newName}!`);
    }

    return next;
  }
}
