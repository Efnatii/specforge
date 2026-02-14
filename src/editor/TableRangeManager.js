import { AddressRangeUtil } from "./TemplateSchema.js";

function colToIndex(col) {
  let out = 0;
  const text = String(col || "").toUpperCase();
  for (let i = 0; i < text.length; i += 1) {
    out = out * 26 + (text.charCodeAt(i) - 64);
  }
  return out;
}

export class TableRangeManager {
  constructor({ bindingMap }) {
    this.bindingMap = bindingMap;
  }

  resolveTableAtSelection({ sheetName, addressA1 }) {
    const map = this.bindingMap?.get?.();
    if (!map) {
      return null;
    }

    const point = AddressRangeUtil.parseA1(addressA1);

    const common = this.resolveCommonTable(map, sheetName, point);
    if (common) {
      return common;
    }

    const assembly = this.resolveAssemblyTable(map, sheetName, point);
    if (assembly) {
      return assembly;
    }

    const consumables = this.resolveConsumablesTable(map, sheetName, point);
    return consumables || null;
  }

  resolveCommonTable(map, sheetName, point) {
    if (sheetName !== map.commonSheet?.name) {
      return null;
    }

    const table = map.commonSheet?.assembliesTable;
    if (!table) {
      return null;
    }

    return this.toTableMeta("common.assemblies", sheetName, table, point);
  }

  resolveAssemblyTable(map, sheetName, point) {
    if (sheetName === map.commonSheet?.name || sheetName.startsWith("Расход. мат.")) {
      return null;
    }

    const table = map.assemblySheet?.itemsTable;
    if (!table) {
      return null;
    }

    return this.toTableMeta("assembly.items", sheetName, table, point);
  }

  resolveConsumablesTable(map, sheetName, point) {
    if (!sheetName.startsWith("Расход. мат.")) {
      return null;
    }

    const table = map.consumablesSheet?.itemsTable;
    if (!table) {
      return null;
    }

    return this.toTableMeta("consumables.items", sheetName, table, point);
  }

  toTableMeta(tableId, sheetName, table, point) {
    const startRow = Number(table.startRow || 1);
    const maxRows = Number(table.maxRows || 1);
    const endRow = startRow + maxRows - 1;

    const columnEntries = Object.entries(table.cols || {}).map(([key, col]) => ({
      key,
      letter: String(col || "A").toUpperCase(),
      index: colToIndex(col)
    }));

    if (!columnEntries.length) {
      return null;
    }

    const colIndexes = columnEntries.map((item) => item.index);
    const left = Math.min(...colIndexes);
    const right = Math.max(...colIndexes);

    if (point.row < startRow || point.row > endRow || point.col < left || point.col > right) {
      return null;
    }

    return {
      tableId,
      sheetName,
      startRow,
      maxRows,
      endRow,
      cols: Object.fromEntries(columnEntries.map((item) => [item.key, item.letter])),
      colIndexes,
      rangeBounds: { r1: startRow, c1: left, r2: endRow, c2: right }
    };
  }
}
