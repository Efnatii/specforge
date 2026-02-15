import { WorkbookCalculationModule } from "./calculation.js";
import { WorkbookSheetBuilderModule } from "./sheet-builder.js";

export class WorkbookModule {
  constructor({ sheetNames, math }) {
    if (!sheetNames) throw new Error("WorkbookModule requires sheetNames");
    if (!math) throw new Error("WorkbookModule requires math helpers");

    this._calcModule = new WorkbookCalculationModule({ math });
    this._sheetBuilderModule = new WorkbookSheetBuilderModule({
      sheetNames,
      math,
      calcApi: this._calcModule,
    });
  }

  calcItem(raw, vat) {
    return this._calcModule.calcItem(raw, vat);
  }

  calcAssemblyMetrics(assembly, vat) {
    return this._calcModule.calcAssemblyMetrics(assembly, vat);
  }

  buildWorkbook({ state, template }) {
    return this._sheetBuilderModule.buildWorkbook({ state, template });
  }
}
