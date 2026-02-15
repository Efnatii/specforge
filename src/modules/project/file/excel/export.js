export class ProjectFileExcelExportModule {
  constructor({ templateApi }) {
    if (!templateApi) throw new Error("ProjectFileExcelExportModule requires templateApi");
    this._template = templateApi;
  }

  async buildXlsxBuffer({ excelJs, workbook, templateStyles, creator, zoomResolver }) {
    if (!excelJs) throw new Error("ExcelJS unavailable");

    const wb = new excelJs.Workbook();
    wb.creator = creator || "";
    wb.created = new Date();

    for (const sheet of workbook.sheets) {
      const zoom = Math.round((typeof zoomResolver === "function" ? zoomResolver(sheet) : (sheet.zoom || 1)) * 100);
      const ws = wb.addWorksheet(sheet.name, {
        views: [{
          state: "normal",
          zoomScale: zoom,
        }],
      });

      ws.columns = sheet.cols.map((w) => ({ width: this._template.pxToExcelW(w) }));

      for (let r = 0; r < sheet.rows.length; r += 1) {
        const sourceRow = sheet.rows[r];
        const wsRow = ws.getRow(r + 1);
        wsRow.height = this._template.pxToPt(sourceRow.height);

        for (let c = 0; c < sourceRow.cells.length; c += 1) {
          const sourceCellRaw = sourceRow.cells[c];
          const sourceCell = sourceCellRaw && typeof sourceCellRaw === "object"
            ? sourceCellRaw
            : { styleId: 0, value: null, formula: "" };
          const wsCell = wsRow.getCell(c + 1);
          wsCell.value = sourceCell.formula
            ? { formula: sourceCell.formula, result: this._excelValue(sourceCell.value) }
            : this._excelValue(sourceCell.value);

          const style = this._excelStyle(templateStyles[sourceCell.styleId]);
          if (style) wsCell.style = style;
        }
      }

      for (const merge of sheet.merges) ws.mergeCells(merge);
    }

    return wb.xlsx.writeBuffer();
  }

  _excelStyle(styleRaw) {
    if (!styleRaw) return null;

    const style = {
      font: {
        name: styleRaw.font.name,
        size: styleRaw.font.size,
        bold: styleRaw.font.bold,
        italic: styleRaw.font.italic,
        color: { argb: `FF${styleRaw.font.color.slice(1).toUpperCase()}` },
      },
    };

    if (styleRaw.fill.type === "solid" && styleRaw.fill.color) {
      style.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${styleRaw.fill.color.slice(1).toUpperCase()}` },
      };
    }

    const border = {};
    for (const side of ["left", "right", "top", "bottom"]) {
      const borderSide = styleRaw.border[side];
      if (borderSide) {
        border[side] = { style: borderSide.style, color: { argb: `FF${borderSide.color.slice(1).toUpperCase()}` } };
      }
    }
    if (Object.keys(border).length) style.border = border;

    style.alignment = { horizontal: styleRaw.align.h, vertical: styleRaw.align.v, wrapText: styleRaw.align.wrap };

    const fmt = styleRaw.numFmtCode || ({ 2: "0.00", 9: "0%", 10: "0.00%" }[styleRaw.numFmtId] || "");
    if (fmt && fmt !== "General") style.numFmt = fmt;

    return style;
  }

  _excelValue(value) {
    if (value === null || value === undefined || value === "") return null;
    return typeof value === "number" || typeof value === "boolean" ? value : String(value);
  }
}
