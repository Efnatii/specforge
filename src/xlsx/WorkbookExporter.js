import ExcelJS from "exceljs/dist/exceljs.min.js";

const TEMPLATE_TAG = "SPEC_FORGE_TEMPLATE_V1";

export class WorkbookExporter {
  async export({ baselineBuffer, edits, sheets, exportMeta, reportWarning }) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(baselineBuffer);

    const sheetNameById = new Map((sheets || []).map((item) => [item.id, item.name]));

    for (const [sheetId, sheetEdits] of Object.entries(edits || {})) {
      const sheetName = sheetNameById.get(sheetId);
      if (!sheetName) {
        continue;
      }

      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        continue;
      }

      for (const [addressA1, payload] of Object.entries(sheetEdits || {})) {
        const cell = worksheet.getCell(addressA1);
        if (cell.formula || (cell.value && typeof cell.value === "object" && cell.value.formula)) {
          reportWarning?.(`Formula cell skipped: ${sheetName}!${addressA1}`);
          continue;
        }

        cell.value = this.normalizeExportValue(payload?.value);
      }
    }

    workbook.creator = "SpecForge";
    workbook.subject = this.appendTag(workbook.subject);
    workbook.keywords = this.appendTag(workbook.keywords);
    workbook.lastModifiedBy = "SpecForge";

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer,
      fileName: WorkbookExporter.buildFileName(exportMeta)
    };
  }

  normalizeExportValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    return String(value);
  }

  appendTag(text) {
    const raw = String(text || "").trim();
    if (!raw) {
      return TEMPLATE_TAG;
    }

    if (raw.includes(TEMPLATE_TAG)) {
      return raw;
    }

    return `${raw};${TEMPLATE_TAG}`;
  }

  static buildFileName(meta) {
    const orderNo = String(meta?.orderNo || "0000-0000").trim();
    const requestNo = String(meta?.requestNo || "0000").trim();
    const title = String(meta?.title || "КП Общая").trim();
    const modifiedDate = String(meta?.modifiedDate || WorkbookExporter.today()).trim();
    return `${orderNo} ${title} (${requestNo}) изм. ${modifiedDate}.xlsx`;
  }

  static today() {
    const date = new Date();
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }
}

export { TEMPLATE_TAG };
