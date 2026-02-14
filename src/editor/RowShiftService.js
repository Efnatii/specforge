import { RangeOps } from "./RangeOps.js";

export class RowShiftService {
  constructor({ templateSchema, getWorkbook, getEdits }) {
    this.templateSchema = templateSchema;
    this.getWorkbook = getWorkbook;
    this.getEdits = getEdits;
  }

  insertRow({ sheetId, sheetName, table, atRowIndexWithinTable, count = 1 }) {
    return this.shift({ direction: "insert", sheetId, sheetName, table, atRowIndexWithinTable, count });
  }

  deleteRow({ sheetId, sheetName, table, atRowIndexWithinTable, count = 1 }) {
    return this.shift({ direction: "delete", sheetId, sheetName, table, atRowIndexWithinTable, count });
  }

  shift({ direction, sheetId, sheetName, table, atRowIndexWithinTable, count }) {
    const start = table.startRow;
    const end = table.endRow;
    const atRow = start + atRowIndexWithinTable;

    if (atRow < start || atRow > end) {
      throw new Error("Selected row is outside table bounds");
    }

    if (count < 1 || count > table.maxRows) {
      throw new Error("Invalid row shift count");
    }

    const commands = [];
    const clearedRows = [];

    if (direction === "insert") {
      for (let row = end; row >= atRow; row -= 1) {
        const srcRow = row - count;
        for (const col of table.colIndexes) {
          const addressA1 = RangeOps.rcToA1({ r: row, c: col });
          if (!this.canEdit(sheetName, addressA1)) {
            continue;
          }

          const next = srcRow >= atRow ? this.getEffectiveValue(sheetId, srcRow, col) : null;
          const prev = this.getEffectiveValue(sheetId, row, col);
          if (!this.valuesEqual(prev, next)) {
            commands.push(this.toCommand(sheetId, sheetName, addressA1, prev, next));
          }
        }
      }

      for (let row = atRow; row <= Math.min(end, atRow + count - 1); row += 1) {
        clearedRows.push(row);
      }
    } else {
      for (let row = atRow; row <= end; row += 1) {
        const srcRow = row + count;
        for (const col of table.colIndexes) {
          const addressA1 = RangeOps.rcToA1({ r: row, c: col });
          if (!this.canEdit(sheetName, addressA1)) {
            continue;
          }

          const next = srcRow <= end ? this.getEffectiveValue(sheetId, srcRow, col) : null;
          const prev = this.getEffectiveValue(sheetId, row, col);
          if (!this.valuesEqual(prev, next)) {
            commands.push(this.toCommand(sheetId, sheetName, addressA1, prev, next));
          }
        }
      }

      for (let row = Math.max(atRow, end - count + 1); row <= end; row += 1) {
        clearedRows.push(row);
      }
    }

    return { commands, clearedRows };
  }

  getEffectiveValue(sheetId, row, col) {
    const addressA1 = RangeOps.rcToA1({ r: row, c: col });
    const edit = this.getEdits()?.[sheetId]?.[addressA1];
    if (edit) {
      return edit.value;
    }

    const sheet = this.getWorkbook()?.sheets?.find((item) => item.id === sheetId);
    for (const r of sheet?.rows || []) {
      for (const cell of r.cells || []) {
        if (cell.address === addressA1) {
          return cell.value ?? null;
        }
      }
    }

    return null;
  }

  canEdit(sheetName, addressA1) {
    const cell = this.getBaselineCell(sheetName, addressA1);
    return this.templateSchema.isCellEditable(sheetName, addressA1, cell);
  }

  getBaselineCell(sheetName, addressA1) {
    const workbook = this.getWorkbook();
    const sheet = workbook?.sheets?.find((item) => item.name === sheetName);
    for (const row of sheet?.rows || []) {
      for (const cell of row.cells || []) {
        if (cell.address === addressA1) {
          return cell;
        }
      }
    }
    return null;
  }

  toCommand(sheetId, sheetName, addressA1, prevValue, nextValue) {
    return {
      sheetId,
      sheetName,
      addressA1,
      prevValue,
      nextValue,
      prevType: prevValue === null ? "null" : typeof prevValue,
      nextType: nextValue === null ? "null" : typeof nextValue,
      ts: Date.now()
    };
  }

  valuesEqual(a, b) {
    if (a === b) {
      return true;
    }
    return Number.isNaN(a) && Number.isNaN(b);
  }
}
