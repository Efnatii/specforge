import { WorkbookSheetLayoutModule } from "./sheet-layout.js";

export class WorkbookSheetBuilderModule {
  constructor({ sheetNames, math, calcApi }) {
    if (!sheetNames) throw new Error("WorkbookSheetBuilderModule requires sheetNames");
    if (!math) throw new Error("WorkbookSheetBuilderModule requires math helpers");
    if (!calcApi) throw new Error("WorkbookSheetBuilderModule requires calcApi");
    if (typeof calcApi.calcAssemblyMetrics !== "function") throw new Error("WorkbookSheetBuilderModule requires calcApi.calcAssemblyMetrics()");

    this._sheetNames = sheetNames;
    this._math = math;
    this._calcApi = calcApi;
    this._layoutModule = new WorkbookSheetLayoutModule({
      sheetNames,
      math,
      calcApi,
    });
  }

  buildWorkbook({ state, template }) {
    const names = this._buildNamePlan(state);
    const sheets = [];
    const summaryEntries = [];

    for (const assembly of state.assemblies) {
      const metrics = this._calcApi.calcAssemblyMetrics(assembly, state.settings.vatRate);
      const namePlan = names[assembly.id];

      let consSheet = null;
      let consRef = null;

      if (assembly.separateConsumables) {
        consSheet = this._layoutModule.buildConsumableSheet(
          `assembly:${assembly.id}:cons`,
          namePlan.consName,
          assembly.consumable,
          template.sheets.consumable,
          this._consumableTitle(state, assembly),
          state.settings.vatRate,
        );
        consRef = { sheetName: consSheet.name, totalRow: consSheet.meta.totalRow };
      }

      const mainSheet = this._layoutModule.buildMainSheet(
        `assembly:${assembly.id}:main`,
        namePlan.mainName,
        assembly,
        metrics,
        template.sheets.main,
        consRef,
        this._mainTitle(state, assembly),
        state.settings.vatRate,
      );

      sheets.push(mainSheet);
      if (consSheet) sheets.push(consSheet);

      summaryEntries.push({
        label: assembly.fullName || "<Полное название cборки>",
        sheetName: mainSheet.name,
        totalRow: mainSheet.meta.totalRow,
        noDisc: metrics.totalNoDisc,
        disc: metrics.totalDisc,
      });
    }

    if (state.hasProjectConsumables) {
      const projectSheet = this._layoutModule.buildConsumableSheet(
        "project-consumables",
        names.project,
        state.projectConsumables,
        template.sheets.projectConsumable,
        this._projectConsumableTitle(state),
        state.settings.vatRate,
      );
      sheets.push(projectSheet);
      summaryEntries.push({
        label: "Расходники",
        sheetName: projectSheet.name,
        totalRow: projectSheet.meta.totalRow,
        noDisc: this._layoutModule.readCellNum(projectSheet, projectSheet.meta.totalRow, 11),
        disc: this._layoutModule.readCellNum(projectSheet, projectSheet.meta.totalRow, 17),
      });
    }

    const summary = this._layoutModule.buildSummarySheet(summaryEntries, template.sheets.summary, state);
    const all = [summary, ...sheets];
    return { sheets: all, byId: Object.fromEntries(all.map((sheet) => [sheet.id, sheet])) };
  }

  _buildNamePlan(state) {
    const used = new Set([this._sheetNames.summary]);
    const plan = {};

    for (const assembly of state.assemblies) {
      const abbr = this._keepAbbr(assembly.abbreviation) || this._deriveAbbr(assembly.fullName);
      if (assembly.separateConsumables) {
        plan[assembly.id] = {
          mainName: this._uniqueSheetName(`Осн. мат. ${abbr}`, used),
          consName: this._uniqueSheetName(`Расх. мат. ${abbr}`, used),
        };
      } else {
        plan[assembly.id] = {
          mainName: this._uniqueSheetName(abbr || "Сборка", used),
          consName: null,
        };
      }
    }

    plan.project = state.hasProjectConsumables ? this._uniqueSheetName("Расходники", used) : null;
    return plan;
  }

  _uniqueSheetName(base, used) {
    const normalizedBase = String(base || "")
      .replace(/[\\/*?:\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || "Sheet";

    let candidate = normalizedBase;
    let idx = 2;
    while (used.has(candidate)) {
      const suffix = ` (${idx})`;
      candidate = `${normalizedBase.slice(0, 31 - suffix.length)}${suffix}`;
      idx += 1;
    }

    used.add(candidate);
    return candidate;
  }

  _changeLabel(state) {
    if (String(state.settings.version || "").trim()) return `вер. ${String(state.settings.version).trim()}`;
    const date = new Date(state.settings.changeDate);
    if (Number.isNaN(date.getTime())) return "изм.";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `изм. ${day}.${month}.${date.getFullYear()}`;
  }

  _mainTitle(state, assembly) {
    const settings = state.settings;
    const tag = assembly.separateConsumables ? "СП основной материал" : "СП";
    return `${settings.orderNumber} ${assembly.fullName || "<Полное название cборки>"} (${settings.requestNumber}) ${tag} ${this._changeLabel(state)}`;
  }

  _consumableTitle(state, assembly) {
    const settings = state.settings;
    return `${settings.orderNumber} ${assembly.fullName || "<Полное название cборки>"} (${settings.requestNumber}) СП расходный материал ${this._changeLabel(state)}`;
  }

  _projectConsumableTitle(state) {
    const settings = state.settings;
    return `${settings.orderNumber} Расходники (${settings.requestNumber}) СП расходный материал ${this._changeLabel(state)}`;
  }

  _deriveAbbr(name) {
    return this._math.deriveAbbr(name);
  }

  _keepAbbr(value) {
    return this._math.keepAbbr(value);
  }
}
