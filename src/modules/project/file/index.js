import { ProjectFileJsonModule } from "./json.js";
import { ProjectFileExcelImportModule } from "./excel/import.js";
import { ProjectFileExcelExportModule } from "./excel/export.js";

export class ProjectFileModule {
  constructor({ stateApi, templateApi }) {
    if (!stateApi) throw new Error("ProjectFileModule requires stateApi");
    if (!templateApi) throw new Error("ProjectFileModule requires templateApi");

    this._json = new ProjectFileJsonModule();
    this._excelImport = new ProjectFileExcelImportModule({ stateApi });
    this._excelExport = new ProjectFileExcelExportModule({ templateApi });
  }

  buildExportPayload(params) {
    return this._json.buildExportPayload(params || {});
  }

  parseImportedJsonText(text) {
    return this._json.parseImportedJsonText(text);
  }

  buildExportName(settings) {
    return this._json.buildExportName(settings);
  }

  async importExcelState(params) {
    return this._excelImport.importExcelState(params || {});
  }

  async buildXlsxBuffer(params) {
    return this._excelExport.buildXlsxBuffer(params || {});
  }
}
