import { AddressRangeUtil } from "../editor/TemplateSchema.js";

export class CalcModelBuilder {
  build({ normalizedWorkbook, edits = {}, reportWarning }) {
    const sheets = {};
    const sheetMeta = new Map();
    const warnings = [];

    for (const sheet of normalizedWorkbook?.sheets || []) {
      const rowCount = this.getMaxRow(sheet, edits[sheet.id]);
      const colCount = this.getMaxCol(sheet, edits[sheet.id]);
      const matrix = this.createMatrix(rowCount, colCount);

      const baselineCells = new Map();
      for (const row of sheet.rows || []) {
        for (const cell of row.cells || []) {
          baselineCells.set(cell.address, cell);
        }
      }

      for (const [addressA1, cell] of baselineCells.entries()) {
        const point = AddressRangeUtil.parseA1(addressA1);
        matrix[point.row - 1][point.col - 1] = this.toCalcValue(cell, warnings, reportWarning, sheet.name, addressA1);
      }

      for (const [addressA1, edit] of Object.entries(edits[sheet.id] || {})) {
        const baselineCell = baselineCells.get(addressA1);
        if (baselineCell?.formula) {
          continue;
        }

        const point = AddressRangeUtil.parseA1(addressA1);
        matrix[point.row - 1][point.col - 1] = edit?.value ?? null;
      }

      sheets[sheet.name] = matrix;
      sheetMeta.set(sheet.name, {
        rowCount,
        colCount,
        sheetId: sheet.id
      });
    }

    return {
      sheets,
      sheetMeta,
      warnings
    };
  }

  toCalcValue(cell, warnings, reportWarning, sheetName, addressA1) {
    if (cell?.sharedFormula && !cell.formula) {
      const warning = `Shared formula not expanded: ${sheetName}!${addressA1}`;
      warnings.push(warning);
      reportWarning?.(warning);
      return cell.value ?? null;
    }

    if (cell?.formula) {
      return String(cell.formula).startsWith("=") ? cell.formula : `=${cell.formula}`;
    }

    return cell?.value ?? null;
  }

  createMatrix(rows, cols) {
    const matrix = [];
    for (let r = 0; r < rows; r += 1) {
      matrix.push(new Array(cols).fill(null));
    }
    return matrix;
  }

  getMaxRow(sheet, sheetEdits) {
    let rowCount = 1;
    for (const row of sheet.rows || []) {
      rowCount = Math.max(rowCount, row.index);
    }

    for (const merge of sheet.merges || []) {
      rowCount = Math.max(rowCount, merge.bottom);
    }

    for (const addressA1 of Object.keys(sheetEdits || {})) {
      rowCount = Math.max(rowCount, AddressRangeUtil.parseA1(addressA1).row);
    }

    return rowCount;
  }

  getMaxCol(sheet, sheetEdits) {
    let colCount = 1;

    for (const col of sheet.cols || []) {
      colCount = Math.max(colCount, col.index);
    }

    for (const row of sheet.rows || []) {
      for (const cell of row.cells || []) {
        colCount = Math.max(colCount, cell.c || AddressRangeUtil.parseA1(cell.address).col);
      }
    }

    for (const merge of sheet.merges || []) {
      colCount = Math.max(colCount, merge.right);
    }

    for (const addressA1 of Object.keys(sheetEdits || {})) {
      colCount = Math.max(colCount, AddressRangeUtil.parseA1(addressA1).col);
    }

    return colCount;
  }
}
