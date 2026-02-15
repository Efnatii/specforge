import { ProjectFileExcelValueModule } from "./value.js";
import { ProjectFileExcelSheetParserModule } from "./parser.js";

export class ProjectFileExcelImportModule {
  constructor({ stateApi }) {
    if (!stateApi) throw new Error("ProjectFileExcelImportModule requires stateApi");
    this._state = stateApi;
    this._values = new ProjectFileExcelValueModule({ stateApi });
    this._parser = new ProjectFileExcelSheetParserModule({ stateApi, valueApi: this._values });
  }

  async importExcelState({ arrayBuffer, excelJs }) {
    if (!excelJs) throw new Error("ExcelJS unavailable");

    const wb = new excelJs.Workbook();
    await wb.xlsx.load(arrayBuffer);

    const defaults = this._state.createDefaultState();
    const settings = { ...defaults.settings };
    let titleParsed = false;

    const summaryWs = wb.worksheets.find((ws) => this._parser.isSummarySheetName(ws?.name));
    if (summaryWs) {
      const vat = this._values.excelNum(summaryWs.getCell("F2").value);
      if (Number.isFinite(vat)) settings.vatRate = this._state.normalizePercentDecimal(vat);
      const formula = this._values.excelFormula(summaryWs.getCell("E2").value);
      if (/\!Q\d+/i.test(formula)) settings.totalMode = "withDiscount";
    }

    let projectWs = null;
    const consumablesByAbbr = new Map();
    const mainSheets = [];

    for (const ws of wb.worksheets) {
      const name = String(ws.name || "").trim();
      if (!name) continue;
      if (this._parser.isSummarySheetName(name)) continue;

      if (this._parser.isConsumableAssemblySheetName(name)) {
        const abbr = this._parser.stripConsumablePrefix(name);
        consumablesByAbbr.set(abbr, ws);
        if (!titleParsed) {
          titleParsed = this._parser.applySettingsFromTitle(settings, this._values.excelText(ws.getCell("A1").value));
        }
        continue;
      }

      if (this._parser.isMainAssemblySheetName(name)) {
        const abbr = this._parser.stripMainPrefix(name);
        mainSheets.push({ ws, abbr, separate: true });
        if (!titleParsed) {
          titleParsed = this._parser.applySettingsFromTitle(settings, this._values.excelText(ws.getCell("A1").value));
        }
        continue;
      }

      if (this._parser.isProjectConsumablesSheetName(name)) {
        projectWs = ws;
        if (!titleParsed) {
          titleParsed = this._parser.applySettingsFromTitle(settings, this._values.excelText(ws.getCell("A1").value));
        }
        continue;
      }

      mainSheets.push({ ws, abbr: name, separate: false });
      if (!titleParsed) {
        titleParsed = this._parser.applySettingsFromTitle(settings, this._values.excelText(ws.getCell("A1").value));
      }
    }

    const assemblies = [];
    for (const item of mainSheets) {
      const ws = item.ws;
      const fullName = this._parser.parseAssemblyFullName(this._values.excelText(ws.getCell("A1").value), settings, item.abbr);
      const assembly = this._state.createAssembly(assemblies.length + 1);
      assembly.fullName = fullName;
      assembly.abbreviation = this._state.keepAbbr(item.abbr) || this._state.deriveAbbr(fullName);
      assembly.abbrManual = true;

      const parsedMain = this._parser.parseSheetPositions(ws, settings.vatRate, "main");
      assembly.main = parsedMain;

      const labor = this._parser.parseLabor(ws);
      assembly.labor = {
        ...assembly.labor,
        ...labor,
      };

      const manualConsumables = this._parser.parseManualConsumables(ws);
      if (Number.isFinite(manualConsumables.noDisc)) assembly.manualConsNoDisc = manualConsumables.noDisc;
      if (Number.isFinite(manualConsumables.disc)) assembly.manualConsDisc = manualConsumables.disc;

      const consWs = consumablesByAbbr.get(item.abbr) || consumablesByAbbr.get(assembly.abbreviation);
      if (item.separate || consWs) {
        assembly.separateConsumables = true;
        const parsedCons = this._parser.parseSheetPositions(consWs || ws, settings.vatRate, "consumable");
        assembly.consumable = parsedCons;
      } else {
        assembly.separateConsumables = false;
        assembly.consumable = [];
      }

      assemblies.push(assembly);
    }

    const state = {
      settings,
      assemblies,
      hasProjectConsumables: false,
      projectConsumables: [],
    };

    if (projectWs) {
      const parsed = this._parser.parseSheetPositions(projectWs, settings.vatRate, "consumable");
      state.hasProjectConsumables = true;
      state.projectConsumables = parsed;
    }

    return state;
  }
}
