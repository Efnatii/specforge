import { AddressRangeUtil } from "../editor/TemplateSchema.js";

const DEFAULT_ROW_HEIGHT_PT = 15;
const DEFAULT_COL_WIDTH_CHARS = 8.43;

export class SheetGridModel {
  computeBounds(sheet, sheetEdits) {
    let rowCount = 0;
    let colCount = 0;

    for (const row of sheet.rows || []) {
      rowCount = Math.max(rowCount, row.index);
      for (const cell of row.cells || []) {
        rowCount = Math.max(rowCount, cell.r);
        colCount = Math.max(colCount, cell.c);
      }
    }

    for (const col of sheet.cols || []) {
      colCount = Math.max(colCount, col.index);
    }

    for (const merge of sheet.merges || []) {
      rowCount = Math.max(rowCount, merge.bottom);
      colCount = Math.max(colCount, merge.right);
    }

    for (const addressA1 of Object.keys(sheetEdits || {})) {
      const point = AddressRangeUtil.parseA1(addressA1);
      rowCount = Math.max(rowCount, point.row);
      colCount = Math.max(colCount, point.col);
    }

    return { rowCount, colCount };
  }

  buildRowSizes(sheet, rowCount, zoom, ptToPx) {
    const rowHeights = new Map();
    for (const row of sheet.rows || []) {
      if (typeof row.heightPt === "number") {
        rowHeights.set(row.index, row.heightPt);
      }
    }

    const sizes = [];
    for (let i = 1; i <= rowCount; i += 1) {
      const pt = rowHeights.get(i) ?? DEFAULT_ROW_HEIGHT_PT;
      sizes.push(Math.max(6, Math.round(ptToPx(pt) * zoom)));
    }
    return sizes;
  }

  buildColSizes(sheet, colCount, zoom, charsToPx) {
    const colWidths = new Map();
    for (const col of sheet.cols || []) {
      if (typeof col.widthChars === "number") {
        colWidths.set(col.index, col.widthChars);
      }
    }

    const sizes = [];
    for (let i = 1; i <= colCount; i += 1) {
      const chars = colWidths.get(i) ?? DEFAULT_COL_WIDTH_CHARS;
      sizes.push(Math.max(16, Math.round(charsToPx(chars) * zoom)));
    }
    return sizes;
  }

  createBaselineMap(rows) {
    const map = new Map();
    for (const row of rows || []) {
      for (const cell of row.cells || []) {
        map.set(cell.address, cell);
      }
    }
    return map;
  }

  createMergeMaps(merges) {
    const mergesByMaster = new Map();
    const masterAddressByAddress = new Map();

    for (const merge of merges || []) {
      const master = AddressRangeUtil.toA1(merge.top, merge.left);
      mergesByMaster.set(master, merge);

      for (let row = merge.top; row <= merge.bottom; row += 1) {
        for (let col = merge.left; col <= merge.right; col += 1) {
          masterAddressByAddress.set(AddressRangeUtil.toA1(row, col), master);
        }
      }
    }

    return { mergesByMaster, masterAddressByAddress };
  }
}
