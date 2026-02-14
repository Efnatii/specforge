import { ClassicSheetGridView } from "./ClassicSheetGridView.js";
import { VirtualSheetGridView } from "./VirtualSheetGridView.js";

const VIRTUAL_THRESHOLD = 50000;

export class SheetGridView {
  constructor({ container }) {
    this.container = container;
    this.classic = new ClassicSheetGridView({ container });
    this.virtual = new VirtualSheetGridView({ container });
    this.active = this.classic;
    this.lastRenderArgs = null;
  }

  render(workbook, activeSheetId, zoom, sheetEdits = {}, editorState = {}, calcSheet = {}, qcWarnings = []) {
    this.lastRenderArgs = [workbook, activeSheetId, zoom, sheetEdits, editorState, calcSheet, qcWarnings];
    const next = this.chooseRenderer(workbook, activeSheetId, sheetEdits);
    if (next !== this.active) {
      this.active = next;
    }
    this.active.render(...this.lastRenderArgs);
  }

  chooseRenderer(workbook, activeSheetId, sheetEdits) {
    if (!workbook?.sheets?.length) {
      return this.classic;
    }

    const sheet = workbook.sheets.find((item) => item.id === activeSheetId) || workbook.sheets[0];
    if (!sheet) {
      return this.classic;
    }

    let maxRow = 0;
    let maxCol = 0;
    for (const row of sheet.rows || []) {
      maxRow = Math.max(maxRow, row.index);
      for (const cell of row.cells || []) {
        maxCol = Math.max(maxCol, cell.c);
      }
    }
    for (const col of sheet.cols || []) {
      maxCol = Math.max(maxCol, col.index);
    }
    for (const merge of sheet.merges || []) {
      maxRow = Math.max(maxRow, merge.bottom);
      maxCol = Math.max(maxCol, merge.right);
    }
    for (const address of Object.keys(sheetEdits || {})) {
      const m = /^([A-Z]+)(\d+)$/i.exec(address);
      if (m) {
        maxRow = Math.max(maxRow, Number(m[2]));
      }
    }

    return maxRow * maxCol > VIRTUAL_THRESHOLD ? this.virtual : this.classic;
  }

  hitTest(event) { return this.active.hitTest(event); }
  getCellRect(addressA1) { return this.active.getCellRect(addressA1); }
  getRangeRect(range) { return this.active.getRangeRect(range); }
  getMergedMaster(addressA1) { return this.active.getMergedMaster(addressA1); }
  getMergeRange(addressA1) { return this.active.getMergeRange(addressA1); }
  scrollCellIntoView(addressA1) { return this.active.scrollCellIntoView(addressA1); }
  setSelectionRange(range) { return this.active.setSelectionRange(range); }
  setFocusCell(addressA1) { return this.active.setFocusCell(addressA1); }
  setSelection(payload) { return this.active.setSelection(payload); }
  setCellError(addressA1, message) { return this.active.setCellError(addressA1, message); }
  getCellData(addressA1, sheetEdits = {}) { return this.active.getCellData(addressA1, sheetEdits); }
  getAddressByOffset(fromAddressA1, rowDelta, colDelta, options) { return this.active.getAddressByOffset(fromAddressA1, rowDelta, colDelta, options); }
  getSheetBounds() { return this.active.getSheetBounds(); }
  takeNumFmtWarnings() { return this.active.takeNumFmtWarnings(); }
}
