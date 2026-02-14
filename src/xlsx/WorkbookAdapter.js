import ExcelJS from "exceljs/dist/exceljs.min.js";

export class WorkbookAdapter {
  async parse(arrayBuffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheets = workbook.worksheets.map((worksheet) => this.normalizeWorksheet(worksheet));
    return {
      sheets,
      warnings: this.detectWarnings(workbook)
    };
  }

  normalizeWorksheet(worksheet) {
    const merges = this.extractMerges(worksheet);
    const rows = this.extractRows(worksheet);
    const cols = this.extractColumns(worksheet, rows, merges);

    return {
      id: String(worksheet.id),
      name: worksheet.name,
      rows,
      cols,
      merges
    };
  }

  extractRows(worksheet) {
    const rows = [];
    const maxRow = Math.max(worksheet.rowCount || 0, worksheet.actualRowCount || 0);

    for (let rowIndex = 1; rowIndex <= maxRow; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      const hasHeight = typeof row.height === "number";
      const cells = [];

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const extracted = this.extractCell(cell, rowIndex, colNumber);
        if (extracted) {
          cells.push(extracted);
        }
      });

      if (!hasHeight && cells.length === 0) {
        continue;
      }

      rows.push({
        index: rowIndex,
        heightPt: hasHeight ? row.height : null,
        cells
      });
    }

    return rows;
  }

  extractColumns(worksheet, rows, merges) {
    let maxCol = worksheet.columnCount || 0;

    for (const row of rows) {
      for (const cell of row.cells) {
        maxCol = Math.max(maxCol, cell.c);
      }
    }

    for (const merge of merges) {
      maxCol = Math.max(maxCol, merge.right);
    }

    const cols = [];
    for (let colIndex = 1; colIndex <= maxCol; colIndex += 1) {
      const column = worksheet.getColumn(colIndex);
      cols.push({
        index: colIndex,
        widthChars: typeof column.width === "number" ? column.width : null
      });
    }

    return cols;
  }

  extractMerges(worksheet) {
    const modelMerges = worksheet.model?.merges || [];
    const merges = [];

    for (const range of modelMerges) {
      const parsed = this.parseRange(range);
      if (parsed) {
        merges.push(parsed);
      }
    }

    return merges;
  }

  parseRange(range) {
    const [start, end] = String(range).split(":");
    if (!start || !end) {
      return null;
    }

    const topLeft = this.parseAddress(start);
    const bottomRight = this.parseAddress(end);
    if (!topLeft || !bottomRight) {
      return null;
    }

    return {
      top: Math.min(topLeft.r, bottomRight.r),
      left: Math.min(topLeft.c, bottomRight.c),
      bottom: Math.max(topLeft.r, bottomRight.r),
      right: Math.max(topLeft.c, bottomRight.c)
    };
  }

  parseAddress(address) {
    const match = /^([A-Z]+)(\d+)$/i.exec(String(address));
    if (!match) {
      return null;
    }

    const colLetters = match[1].toUpperCase();
    const row = Number(match[2]);

    let col = 0;
    for (let i = 0; i < colLetters.length; i += 1) {
      col = col * 26 + (colLetters.charCodeAt(i) - 64);
    }

    return { c: col, r: row };
  }

  extractCell(cell, rowIndex, colIndex) {
    const valueInfo = this.normalizeValue(cell.value);
    const style = this.normalizeStyle(cell.style);
    const numFmt = cell.numFmt || cell.style?.numFmt || null;

    const hasPayload = valueInfo.value !== null || valueInfo.formula || valueInfo.sharedFormula || numFmt || style;
    if (!hasPayload) {
      return null;
    }

    return {
      address: cell.address,
      c: colIndex,
      r: rowIndex,
      value: valueInfo.value,
      formula: valueInfo.formula,
      sharedFormula: valueInfo.sharedFormula || null,
      numFmt,
      style
    };
  }

  normalizeValue(rawValue) {
    if (rawValue === null || rawValue === undefined) {
      return { value: null, formula: null, sharedFormula: null };
    }

    if (rawValue instanceof Date) {
      return { value: rawValue.toISOString(), formula: null, sharedFormula: null };
    }

    if (typeof rawValue === "object") {
      if (Object.prototype.hasOwnProperty.call(rawValue, "formula")) {
        const formula = rawValue.formula ? `=${rawValue.formula}` : null;
        const value = rawValue.result ?? null;
        return {
          value,
          formula,
          sharedFormula: rawValue.sharedFormula || null
        };
      }

      if (Array.isArray(rawValue.richText)) {
        return {
          value: rawValue.richText.map((part) => part.text || "").join(""),
          formula: null,
          sharedFormula: null
        };
      }

      if (typeof rawValue.text === "string") {
        return { value: rawValue.text, formula: null, sharedFormula: null };
      }

      if (typeof rawValue.hyperlink === "string") {
        return {
          value: rawValue.text || rawValue.hyperlink,
          formula: null,
          sharedFormula: null
        };
      }

      return {
        value: JSON.stringify(rawValue),
        formula: null,
        sharedFormula: null
      };
    }

    return {
      value: rawValue,
      formula: null,
      sharedFormula: null
    };
  }

  normalizeStyle(style) {
    if (!style || typeof style !== "object") {
      return null;
    }

    const normalized = {};

    if (style.font) {
      normalized.font = {
        name: style.font.name || null,
        sizePt: style.font.size || null,
        bold: Boolean(style.font.bold),
        italic: Boolean(style.font.italic),
        underline: Boolean(style.font.underline),
        color: this.normalizeColor(style.font.color)
      };
    }

    if (style.alignment) {
      normalized.alignment = {
        horizontal: style.alignment.horizontal || null,
        vertical: style.alignment.vertical || null,
        wrapText: Boolean(style.alignment.wrapText)
      };
    }

    if (style.fill) {
      normalized.fill = {
        type: style.fill.type || null,
        fgColor: this.normalizeColor(style.fill.fgColor)
      };
    }

    if (style.border) {
      normalized.border = {
        top: this.normalizeBorderSide(style.border.top),
        left: this.normalizeBorderSide(style.border.left),
        right: this.normalizeBorderSide(style.border.right),
        bottom: this.normalizeBorderSide(style.border.bottom)
      };
    }

    if (Object.keys(normalized).length === 0) {
      return null;
    }

    return normalized;
  }

  normalizeBorderSide(side) {
    if (!side) {
      return null;
    }

    return {
      style: side.style || null,
      color: this.normalizeColor(side.color)
    };
  }

  normalizeColor(color) {
    if (!color) {
      return null;
    }

    return {
      argb: color.argb || null,
      theme: Number.isFinite(color.theme) ? color.theme : null,
      indexed: Number.isFinite(color.indexed) ? color.indexed : null,
      tint: Number.isFinite(color.tint) ? color.tint : null
    };
  }

  detectWarnings(workbook) {
    const warnings = [];

    try {
      const modelDump = JSON.stringify(workbook.model || {}).toLowerCase();
      if (modelDump.includes("pivot")) {
        warnings.push("Workbook may contain pivot objects; export might not preserve them 1:1.");
      }
      if (modelDump.includes("chart") || modelDump.includes("drawing")) {
        warnings.push("Workbook may contain charts/drawings; export might not preserve them 1:1.");
      }
    } catch {
      // best-effort warning detection only
    }

    return warnings;
  }
}
