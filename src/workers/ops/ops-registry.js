import { runParseWorkbook } from "./op-parse-workbook.js";
import { runBuildFindIndex } from "./op-build-find-index.js";
import { runQc } from "./op-run-qc.js";
import { runExportXlsx } from "./op-export-xlsx.js";
import { runImportUpdateDiff } from "./op-import-update-diff.js";

export const opsRegistry = {
  PARSE_WORKBOOK: runParseWorkbook,
  BUILD_FIND_INDEX: runBuildFindIndex,
  RUN_QC: runQc,
  EXPORT_XLSX: runExportXlsx,
  IMPORT_UPDATE_DIFF: runImportUpdateDiff,
  BUILD_CALC_MODEL: runBuildFindIndex,
  RECALC_SHEET: runBuildFindIndex
};
