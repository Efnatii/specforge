import { AddressRangeUtil } from "../editor/TemplateSchema.js";
import { RangeOps } from "../editor/RangeOps.js";
import { DisplayValueService } from "../format/DisplayValueService.js";
import { NumFmtService } from "../format/NumFmtService.js";
import { SheetCellStyler } from "./SheetCellStyler.js";
import { SheetGridModel } from "./SheetGridModel.js";

export class ClassicSheetGridView {
  constructor({ container }) {
    this.container = container;
    this.styler = new SheetCellStyler();
    this.model = new SheetGridModel();
    this.displayValueService = new DisplayValueService();
    this.numFmtService = new NumFmtService();
    this.resetRuntimeMaps();
  }

  render(workbook, activeSheetId, zoom, sheetEdits = {}, editorState = {}, calcSheet = {}, qcWarnings = []) {
    this.container.innerHTML = "";
    this.resetRuntimeMaps();

    if (!workbook?.sheets?.length) {
      this.container.appendChild(this.createPlaceholder("Workbook not loaded"));
      return;
    }

    const sheet = workbook.sheets.find((item) => item.id === activeSheetId) || workbook.sheets[0];
    if (!sheet) {
      this.container.appendChild(this.createPlaceholder("Sheet not found"));
      return;
    }

    this.currentSheetId = sheet.id;
    this.currentSheetName = sheet.name;
    this.currentBounds = this.model.computeBounds(sheet, sheetEdits);

    const rowSizes = this.model.buildRowSizes(sheet, this.currentBounds.rowCount, zoom, (pt) => this.ptToPx(pt));
    const colSizes = this.model.buildColSizes(sheet, this.currentBounds.colCount, zoom, (chars) => this.colWidthCharsToPx(chars));

    const mergeInfo = this.model.createMergeMaps(sheet.merges);
    this.mergesByMaster = mergeInfo.mergesByMaster;
    this.masterAddressByAddress = mergeInfo.masterAddressByAddress;
    this.baselineCellsByAddress = this.model.createBaselineMap(sheet.rows);

    this.sheetGrid = document.createElement("div");
    this.sheetGrid.className = "sheet-grid";
    this.sheetGrid.style.gridTemplateRows = rowSizes.map((size) => `${size}px`).join(" ");
    this.sheetGrid.style.gridTemplateColumns = colSizes.map((size) => `${size}px`).join(" ");

    const warningSet = new Set(qcWarnings.filter((item) => item.code === "WARN_NUMFMT_UNSUPPORTED").map((item) => item.addressA1));
    const fragment = document.createDocumentFragment();

    for (let row = 1; row <= this.currentBounds.rowCount; row += 1) {
      for (let col = 1; col <= this.currentBounds.colCount; col += 1) {
        const addressA1 = AddressRangeUtil.toA1(row, col);
        const masterAddress = this.getMergedMaster(addressA1);
        if (masterAddress !== addressA1) {
          continue;
        }

        const baselineCell = this.baselineCellsByAddress.get(masterAddress) || null;
        const editCell = sheetEdits?.[masterAddress] || null;
        const calcResult = calcSheet?.[masterAddress] || null;

        const display = this.displayValueService.getDisplay({
          sheetName: sheet.name,
          addressA1: masterAddress,
          baselineCell,
          overlayEdit: editCell,
          calcResult
        });

        const numFmt = baselineCell?.numFmt || null;
        const formatted = this.numFmtService.format({
          value: display.raw,
          numFmt,
          fallbackType: typeof display.raw,
          sheetName: sheet.name,
          addressA1: masterAddress
        });

        const element = this.createCellElement({
          addressA1: masterAddress,
          row,
          col,
          merge: this.mergesByMaster.get(masterAddress) || null,
          baselineCell,
          zoom,
          errorAddress: editorState.lastError?.addressA1,
          display,
          text: formatted.text,
          hasNumFmtWarning: warningSet.has(masterAddress),
          formulaError: display.error
        });

        this.cellElementByAddress.set(masterAddress, element);
        fragment.appendChild(element);
      }
    }

    this.sheetGrid.appendChild(fragment);
    this.scrollArea = document.createElement("div");
    this.scrollArea.className = "grid-scroll-area";
    this.scrollArea.appendChild(this.sheetGrid);
    this.container.appendChild(this.scrollArea);

    this.applySelection(editorState.selection);
  }

  hitTest(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    const cell = target.closest(".cell");
    return cell ? { sheetId: cell.dataset.sheetId || this.currentSheetId, addressA1: cell.dataset.address || null } : null;
  }

  getCellRect(addressA1) {
    const element = this.cellElementByAddress.get(this.getMergedMaster(addressA1));
    if (!element) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    const rootRect = this.container.getBoundingClientRect();
    return { x: rect.left - rootRect.left, y: rect.top - rootRect.top, w: rect.width, h: rect.height };
  }

  getRangeRect(range) {
    if (!range) {
      return null;
    }

    const topLeft = this.getCellRect(RangeOps.rcToA1({ r: range.r1, c: range.c1 }));
    const bottomRight = this.getCellRect(RangeOps.rcToA1({ r: range.r2, c: range.c2 }));
    if (!topLeft || !bottomRight) {
      return null;
    }

    return {
      x: topLeft.x,
      y: topLeft.y,
      w: bottomRight.x + bottomRight.w - topLeft.x,
      h: bottomRight.y + bottomRight.h - topLeft.y
    };
  }

  getMergedMaster(addressA1) {
    return this.masterAddressByAddress.get(addressA1) || addressA1;
  }

  getMergeRange(addressA1) {
    const master = this.getMergedMaster(addressA1);
    const merge = this.mergesByMaster.get(master);
    if (!merge) {
      const point = RangeOps.a1ToRc(master);
      return { r1: point.r, c1: point.c, r2: point.r, c2: point.c };
    }

    return { r1: merge.top, c1: merge.left, r2: merge.bottom, c2: merge.right };
  }

  scrollCellIntoView(addressA1) {
    this.cellElementByAddress.get(this.getMergedMaster(addressA1))?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  setSelectionRange(range) {
    this.applySelection(range ? { range } : null);
  }

  setFocusCell(addressA1) {
    this.applySelection({
      focusAddressA1: addressA1,
      range: addressA1 ? (() => { const rc = RangeOps.a1ToRc(addressA1); return { r1: rc.r, c1: rc.c, r2: rc.r, c2: rc.c }; })() : null
    });
  }

  setSelection({ addressA1 }) {
    if (!addressA1) {
      this.applySelection(null);
      return;
    }
    const rc = RangeOps.a1ToRc(addressA1);
    this.applySelection({ focusAddressA1: addressA1, range: { r1: rc.r, c1: rc.c, r2: rc.r, c2: rc.c } });
  }

  setCellError(addressA1, message) {
    for (const [address, element] of this.cellElementByAddress.entries()) {
      element.classList.toggle("cell-error", Boolean(message) && address === addressA1);
    }
  }

  getCellData(addressA1, sheetEdits = {}) {
    const master = this.getMergedMaster(addressA1);
    const baselineCell = this.baselineCellsByAddress.get(master) || null;
    const editCell = sheetEdits?.[master] || null;
    return { addressA1: master, baselineCell, editCell, effectiveValue: editCell ? editCell.value : baselineCell?.value ?? null, style: baselineCell?.style || null };
  }

  getAddressByOffset(fromAddressA1, rowDelta, colDelta, { bounds = null } = {}) {
    const point = AddressRangeUtil.parseA1(this.getMergedMaster(fromAddressA1 || "A1"));
    const maxRow = bounds?.maxRow || this.currentBounds.rowCount || 1;
    const maxCol = bounds?.maxCol || this.currentBounds.colCount || 1;
    const row = Math.min(Math.max(1, point.row + rowDelta), maxRow);
    const col = Math.min(Math.max(1, point.col + colDelta), maxCol);
    return this.getMergedMaster(AddressRangeUtil.toA1(row, col));
  }

  getSheetBounds() {
    return { maxRow: this.currentBounds.rowCount || 1, maxCol: this.currentBounds.colCount || 1 };
  }

  createCellElement({ addressA1, row, col, merge, baselineCell, zoom, errorAddress, display, text, hasNumFmtWarning, formulaError }) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.gridRow = String(row);
    cell.style.gridColumn = String(col);
    cell.dataset.address = addressA1;
    cell.dataset.sheetId = this.currentSheetId || "";

    if (merge) {
      cell.style.gridRow = `${row} / span ${merge.bottom - merge.top + 1}`;
      cell.style.gridColumn = `${col} / span ${merge.right - merge.left + 1}`;
      cell.classList.add("merged-cell");
    }

    if (baselineCell?.style) {
      this.styler.applyCellStyle(cell, baselineCell.style, zoom, (pt) => this.ptToPx(pt));
    }

    cell.textContent = text == null ? "" : String(text);

    if (display.kind === "error") {
      cell.classList.add("cell-formula-error");
      cell.title = formulaError || "Formula error";
    }

    if (hasNumFmtWarning) {
      cell.classList.add("cell-numfmt-warning");
    }

    if (display.kind === "empty") {
      cell.classList.add("empty");
    }

    if (addressA1 === errorAddress) {
      cell.classList.add("cell-error");
    }

    return cell;
  }

  applySelection(selection) {
    this.activeSelection = selection || null;
    for (const element of this.cellElementByAddress.values()) {
      element.classList.remove("cell-selected", "cell-focus");
    }

    if (!selection?.range) {
      return;
    }

    const range = RangeOps.normalizeRange(selection.range);
    for (const { addressA1 } of RangeOps.iterRange(range)) {
      const cell = this.cellElementByAddress.get(this.getMergedMaster(addressA1));
      if (cell) {
        cell.classList.add("cell-selected");
      }
    }

    const focus = selection.focusAddressA1 || selection.addressA1;
    if (focus) {
      const focusCell = this.cellElementByAddress.get(this.getMergedMaster(focus));
      if (focusCell) {
        focusCell.classList.add("cell-focus");
      }
    }
  }

  takeNumFmtWarnings() {
    return this.numFmtService.takeWarnings();
  }

  resetRuntimeMaps() {
    this.scrollArea = null;
    this.sheetGrid = null;
    this.currentSheetId = null;
    this.currentSheetName = null;
    this.currentBounds = { rowCount: 0, colCount: 0 };
    this.baselineCellsByAddress = new Map();
    this.mergesByMaster = new Map();
    this.masterAddressByAddress = new Map();
    this.cellElementByAddress = new Map();
    this.activeSelection = null;
  }

  ptToPx(pt) {
    return (pt * 96) / 72;
  }

  colWidthCharsToPx(widthChars) {
    return Math.floor(widthChars * 7 + 5);
  }

  createPlaceholder(text) {
    const node = document.createElement("div");
    node.className = "grid-placeholder";
    node.textContent = text;
    return node;
  }
}

