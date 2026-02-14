import ExcelJS from "exceljs/dist/exceljs.min.js";

export class QcExporter {
  exportCsv(report) {
    const headers = ["level", "code", "sheetName", "addressA1", "message"];
    const lines = [headers.join(",")];

    for (const item of report?.items || []) {
      const row = [item.level, item.code, item.sheetName, item.addressA1, item.message]
        .map((value) => this.escapeCsv(value));
      lines.push(row.join(","));
    }

    return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  }

  async exportXlsx(report) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("QC");

    worksheet.addRow(["Уровень", "Код", "Лист", "Ячейка", "Сообщение"]);
    for (const item of report?.items || []) {
      worksheet.addRow([item.level, item.code, item.sheetName, item.addressA1, item.message]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  escapeCsv(value) {
    const text = String(value ?? "");
    if (!/[",\n]/.test(text)) {
      return text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }
}

