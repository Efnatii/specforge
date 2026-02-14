import { AddressRangeUtil } from "../editor/TemplateSchema.js";
import { RangeOps } from "../editor/RangeOps.js";
import { DisplayValueService } from "../format/DisplayValueService.js";
import { NumFmtService } from "../format/NumFmtService.js";
import { VirtualWindowModel } from "../perf/VirtualWindowModel.js";
import { CellDomPool } from "../perf/CellDomPool.js";
import { SheetCellStyler } from "./SheetCellStyler.js";
import { SheetGridModel } from "./SheetGridModel.js";
import { RenderScheduler } from "./RenderScheduler.js";
import { ViewportMeasure } from "./ViewportMeasure.js";

export class VirtualSheetGridView {
  constructor({ container }) {
    this.container = container;
    this.styler = new SheetCellStyler();
    this.model = new SheetGridModel();
    this.displayValueService = new DisplayValueService();
    this.numFmtService = new NumFmtService();
    this.viewportMeasure = new ViewportMeasure();
    this.renderScheduler = new RenderScheduler(() => this.redrawVisible());
    this.cellPool = new CellDomPool({ create: () => this.createCellNode() });

    this.visibleNodes = new Map();
    this.errorAddress = null;
    this.selection = null;
    this.resetRuntime();
  }

  render(workbook, activeSheetId, zoom, sheetEdits = {}, editorState = {}, calcSheet = {}, qcWarnings = []) {
    this.workbook = workbook;
    this.zoom = zoom;
    this.sheetEdits = sheetEdits || {};
    this.editorState = editorState || {};
    this.calcSheet = calcSheet || {};
    this.warningSet = new Set((qcWarnings || []).filter((item) => item.code === "WARN_NUMFMT_UNSUPPORTED").map((item) => item.addressA1));

    if (!workbook?.sheets?.length) {
      this.container.innerHTML = "";
      this.container.appendChild(this.createPlaceholder("Workbook not loaded"));
      return;
    }

    const sheet = workbook.sheets.find((item) => item.id === activeSheetId) || workbook.sheets[0];
    if (!sheet) {
      this.container.innerHTML = "";
      this.container.appendChild(this.createPlaceholder("Sheet not found"));
      return;
    }

    this.currentSheetId = sheet.id;
    this.currentSheetName = sheet.name;
    this.currentBounds = this.model.computeBounds(sheet, this.sheetEdits);

    this.rowSizes = this.model.buildRowSizes(sheet, this.currentBounds.rowCount, zoom, (pt) => this.ptToPx(pt));
    this.colSizes = this.model.buildColSizes(sheet, this.currentBounds.colCount, zoom, (chars) => this.colWidthCharsToPx(chars));

    const mergeInfo = this.model.createMergeMaps(sheet.merges);
    this.mergesByMaster = mergeInfo.mergesByMaster;
    this.masterAddressByAddress = mergeInfo.masterAddressByAddress;
    this.baselineCellsByAddress = this.model.createBaselineMap(sheet.rows);

    this.ensureDom();
    this.windowModel = new VirtualWindowModel({
      rowHeightsPx: this.rowSizes,
      colWidthsPx: this.colSizes,
      viewportWidthPx: this.scrollArea.clientWidth,
      viewportHeightPx: this.scrollArea.clientHeight,
      overscanPx: 320
    });

    this.spacer.style.width = `${this.windowModel.totalWidthPx}px`;
    this.spacer.style.height = `${this.windowModel.totalHeightPx}px`;

    this.selection = this.editorState.selection || null;
    this.errorAddress = this.editorState.lastError?.addressA1 || null;
    this.redrawVisible();
  }

  ensureDom() {
    if (this.scrollArea) {
      return;
    }

    this.container.innerHTML = "";

    this.scrollArea = document.createElement("div");
    this.scrollArea.className = "grid-scroll-area virtual-scroll-area";
    this.scrollArea.style.padding = "0";
    this.scrollArea.style.position = "relative";

    this.spacer = document.createElement("div");
    this.spacer.style.position = "relative";

    this.cellLayer = document.createElement("div");
    this.cellLayer.className = "virtual-cell-layer";
    this.cellLayer.style.position = "absolute";
    this.cellLayer.style.inset = "0";

    this.selectionLayer = document.createElement("div");
    this.selectionLayer.style.position = "absolute";
    this.selectionLayer.style.inset = "0";
    this.selectionLayer.style.pointerEvents = "none";

    this.rangeBox = document.createElement("div");
    this.rangeBox.className = "range-box";
    this.rangeBox.style.position = "absolute";
    this.rangeBox.style.border = "1px solid #2f7ae5";
    this.rangeBox.style.background = "rgba(47, 122, 229, 0.10)";
    this.rangeBox.style.display = "none";

    this.focusBox = document.createElement("div");
    this.focusBox.className = "focus-box";
    this.focusBox.style.position = "absolute";
    this.focusBox.style.border = "2px solid #2f7ae5";
    this.focusBox.style.display = "none";

    this.selectionLayer.append(this.rangeBox, this.focusBox);
    this.spacer.append(this.cellLayer, this.selectionLayer);
    this.scrollArea.appendChild(this.spacer);
    this.container.appendChild(this.scrollArea);

    this.scrollArea.addEventListener("scroll", () => {
      this.windowModel?.updateScroll(this.scrollArea.scrollLeft, this.scrollArea.scrollTop);
      this.renderScheduler.requestRender("scroll");
    });

    this.viewportMeasure.bind(this.scrollArea, (w, h) => {
      this.windowModel?.updateViewportSize(w, h);
      this.renderScheduler.requestRender("resize");
    });
  }

  redrawVisible() {
    if (!this.windowModel || !this.currentBounds) {
      return;
    }

    this.windowModel.updateScroll(this.scrollArea.scrollLeft, this.scrollArea.scrollTop);
    const visible = this.windowModel.getVisibleRange();
    const nextKeys = new Set();

    for (let row = visible.r1; row <= visible.r2; row += 1) {
      for (let col = visible.c1; col <= visible.c2; col += 1) {
        const addressA1 = AddressRangeUtil.toA1(row, col);
        const masterAddress = this.getMergedMaster(addressA1);
        if (masterAddress !== addressA1) {
          continue;
        }

        const key = masterAddress;
        nextKeys.add(key);
        const merge = this.mergesByMaster.get(masterAddress) || null;

        const node = this.visibleNodes.get(key) || this.cellPool.acquire();
        this.visibleNodes.set(key, node);

        const range = merge
          ? { r1: merge.top, c1: merge.left, r2: merge.bottom, c2: merge.right }
          : { r1: row, c1: col, r2: row, c2: col };
        const rect = this.windowModel.rectForRange(range);

        node.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
        node.style.width = `${rect.w}px`;
        node.style.height = `${rect.h}px`;
        node.dataset.address = masterAddress;
        node.dataset.sheetId = this.currentSheetId;

        const baselineCell = this.baselineCellsByAddress.get(masterAddress) || null;
        const editCell = this.sheetEdits[masterAddress] || null;
        const calcResult = this.calcSheet[masterAddress] || null;
        const display = this.displayValueService.getDisplay({
          sheetName: this.currentSheetName,
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
          sheetName: this.currentSheetName,
          addressA1: masterAddress
        });

        node.textContent = formatted.text == null ? "" : String(formatted.text);
        node.classList.toggle("merged-cell", Boolean(merge));
        node.classList.toggle("cell-formula-error", display.kind === "error");
        node.classList.toggle("cell-numfmt-warning", this.warningSet.has(masterAddress));
        node.classList.toggle("cell-error", this.errorAddress === masterAddress);

        if (baselineCell?.style) {
          this.styler.applyCellStyle(node, baselineCell.style, this.zoom, (pt) => this.ptToPx(pt));
        } else {
          node.style.cssText += "";
        }

        if (!node.parentElement) {
          this.cellLayer.appendChild(node);
        }
      }
    }

    for (const [key, node] of [...this.visibleNodes.entries()]) {
      if (!nextKeys.has(key)) {
        this.visibleNodes.delete(key);
        this.cellPool.release(node);
      }
    }

    this.applySelection(this.selection);
  }

  hitTest(event) {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const cell = target.closest(".cell");
      if (cell?.dataset.address) {
        return { sheetId: this.currentSheetId, addressA1: cell.dataset.address };
      }
    }

    const rect = this.scrollArea.getBoundingClientRect();
    const x = event.clientX - rect.left + this.scrollArea.scrollLeft;
    const y = event.clientY - rect.top + this.scrollArea.scrollTop;
    const { row, col } = this.windowModel.rowColFromPoint(x, y);
    const addressA1 = this.getMergedMaster(AddressRangeUtil.toA1(row, col));
    return { sheetId: this.currentSheetId, addressA1 };
  }

  getCellRect(addressA1) {
    const merge = this.getMergeRange(addressA1);
    const rect = this.windowModel.rectForRange(merge);
    return {
      x: rect.x - this.scrollArea.scrollLeft,
      y: rect.y - this.scrollArea.scrollTop,
      w: rect.w,
      h: rect.h
    };
  }

  getRangeRect(range) {
    const rect = this.windowModel.rectForRange(range);
    return { x: rect.x - this.scrollArea.scrollLeft, y: rect.y - this.scrollArea.scrollTop, w: rect.w, h: rect.h };
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
    const rect = this.windowModel.rectForRange(this.getMergeRange(addressA1));
    const left = this.scrollArea.scrollLeft;
    const top = this.scrollArea.scrollTop;
    const right = left + this.scrollArea.clientWidth;
    const bottom = top + this.scrollArea.clientHeight;

    if (rect.x < left) {
      this.scrollArea.scrollLeft = rect.x;
    } else if (rect.x + rect.w > right) {
      this.scrollArea.scrollLeft = Math.max(0, rect.x + rect.w - this.scrollArea.clientWidth);
    }

    if (rect.y < top) {
      this.scrollArea.scrollTop = rect.y;
    } else if (rect.y + rect.h > bottom) {
      this.scrollArea.scrollTop = Math.max(0, rect.y + rect.h - this.scrollArea.clientHeight);
    }
  }

  setSelectionRange(range) {
    this.selection = { ...(this.selection || {}), range };
    this.applySelection(this.selection);
  }

  setFocusCell(addressA1) {
    this.selection = { ...(this.selection || {}), focusAddressA1: addressA1 };
    this.applySelection(this.selection);
  }

  setSelection({ addressA1 }) {
    if (!addressA1) {
      this.selection = null;
      this.applySelection(null);
      return;
    }
    const rc = RangeOps.a1ToRc(addressA1);
    this.selection = { focusAddressA1: addressA1, range: { r1: rc.r, c1: rc.c, r2: rc.r, c2: rc.c } };
    this.applySelection(this.selection);
  }

  setCellError(addressA1, message) {
    this.errorAddress = message ? addressA1 : null;
    this.renderScheduler.requestRender("error");
  }

  getCellData(addressA1, sheetEdits = {}) {
    const master = this.getMergedMaster(addressA1);
    const baselineCell = this.baselineCellsByAddress.get(master) || null;
    const editCell = sheetEdits[master] || null;
    return {
      addressA1: master,
      baselineCell,
      editCell,
      effectiveValue: editCell ? editCell.value : baselineCell?.value ?? null,
      style: baselineCell?.style || null
    };
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

  takeNumFmtWarnings() {
    return this.numFmtService.takeWarnings();
  }

  applySelection(selection) {
    if (!this.rangeBox || !this.focusBox) {
      return;
    }

    if (!selection?.range) {
      this.rangeBox.style.display = "none";
      this.focusBox.style.display = "none";
      return;
    }

    const rangeRect = this.windowModel.rectForRange(selection.range);
    this.rangeBox.style.display = "block";
    this.rangeBox.style.transform = `translate(${rangeRect.x}px, ${rangeRect.y}px)`;
    this.rangeBox.style.width = `${rangeRect.w}px`;
    this.rangeBox.style.height = `${rangeRect.h}px`;

    const focusAddress = selection.focusAddressA1 || selection.addressA1;
    if (!focusAddress) {
      this.focusBox.style.display = "none";
      return;
    }

    const focusRect = this.windowModel.rectForRange(this.getMergeRange(focusAddress));
    this.focusBox.style.display = "block";
    this.focusBox.style.transform = `translate(${focusRect.x}px, ${focusRect.y}px)`;
    this.focusBox.style.width = `${focusRect.w}px`;
    this.focusBox.style.height = `${focusRect.h}px`;
  }

  createCellNode() {
    const node = document.createElement("div");
    node.className = "cell";
    node.style.position = "absolute";
    node.style.margin = "0";
    return node;
  }

  resetRuntime() {
    this.scrollArea = null;
    this.spacer = null;
    this.cellLayer = null;
    this.selectionLayer = null;
    this.rangeBox = null;
    this.focusBox = null;

    this.workbook = null;
    this.currentSheetId = null;
    this.currentSheetName = null;
    this.currentBounds = { rowCount: 0, colCount: 0 };
    this.rowSizes = [];
    this.colSizes = [];
    this.baselineCellsByAddress = new Map();
    this.mergesByMaster = new Map();
    this.masterAddressByAddress = new Map();
    this.windowModel = null;
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
