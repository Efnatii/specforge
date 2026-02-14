import { SelectionModel } from "./SelectionModel.js";
import { RangeOps } from "./RangeOps.js";
import { EditTransaction } from "./EditTransaction.js";

function microYield() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class EditorController {
  constructor({
    eventBus,
    stateStore,
    templateSchema,
    gridView,
    cellEditorOverlay,
    undoStack,
    valueParser,
    toast,
    getWorkbook,
    stateDriver,
    onCellCommitted,
    jobQueue,
    clipboardService,
    tableRangeManager,
    rowShiftService
  }) {
    this.eventBus = eventBus;
    this.stateStore = stateStore;
    this.templateSchema = templateSchema;
    this.gridView = gridView;
    this.cellEditorOverlay = cellEditorOverlay;
    this.undoStack = undoStack;
    this.valueParser = valueParser;
    this.toast = toast;
    this.getWorkbook = getWorkbook;
    this.stateDriver = stateDriver;
    this.onCellCommitted = onCellCommitted;
    this.jobQueue = jobQueue;
    this.clipboardService = clipboardService;
    this.tableRangeManager = tableRangeManager;
    this.rowShiftService = rowShiftService;
    this.selectionModel = new SelectionModel();
    this.drag = null;
    this.lastSheetId = null;
  }

  start() {
    this.gridView.container.addEventListener("click", (event) => this.onGridClick(event));
    this.gridView.container.addEventListener("dblclick", (event) => this.onGridDoubleClick(event));
    this.gridView.container.addEventListener("keydown", (event) => this.onGridKeyDown(event));
    this.gridView.container.addEventListener("mousedown", (event) => this.onMouseDown(event));
    document.addEventListener("mousemove", (event) => this.onMouseMove(event));
    document.addEventListener("mouseup", () => this.onMouseUp());

    this.eventBus.on("STATE_CHANGED", (state) => {
      this.syncOverlay(state);
      this.syncSheetSelection(state);
    });

    this.eventBus.on("EDITOR_SELECT_ADDRESS", ({ addressA1 }) => {
      if (addressA1) {
        this.selectAddress(addressA1);
      }
    });

    this.clipboardService?.setProvider({
      getSelectionMatrix: () => this.getSelectionMatrix(),
      applyMatrixAtTarget: (matrix) => this.applyMatrixAtTarget(matrix),
      clearSelectionValues: () => this.clearSelectionValues()
    });

    this.clipboardService?.bindToRoot(this.gridView.container);
  }

  onGridClick(event) {
    this.gridView.container.focus();
    if (this.cellEditorOverlay.isEventInside(event.target)) {
      return;
    }

    const hit = this.gridView.hitTest(event);
    if (!hit?.addressA1) {
      return;
    }

    this.selectAddress(hit.addressA1, { extend: event.shiftKey });
  }

  onMouseDown(event) {
    if (event.button !== 0) {
      return;
    }

    const hit = this.gridView.hitTest(event);
    if (!hit?.addressA1) {
      return;
    }

    this.gridView.container.focus();
    this.drag = { start: hit.addressA1 };
    this.selectAddress(hit.addressA1, { extend: event.shiftKey });
  }

  onMouseMove(event) {
    if (!this.drag) {
      return;
    }

    const hit = this.gridView.hitTest(event);
    if (!hit?.addressA1) {
      return;
    }

    this.selectRange(this.drag.start, hit.addressA1);
  }

  onMouseUp() {
    this.drag = null;
  }

  onGridDoubleClick(event) {
    this.gridView.container.focus();
    const hit = this.gridView.hitTest(event);
    if (!hit?.addressA1) {
      return;
    }
    this.selectAddress(hit.addressA1);
    this.openEditor();
  }

  onGridKeyDown(event) {
    if (!this.getWorkbook()) {
      return;
    }

    if (this.cellEditorOverlay.isOpen() && event.key === "Escape") {
      event.preventDefault();
      this.cancelEditing();
      return;
    }

    if (this.cellEditorOverlay.isOpen()) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.commitEditor();
      } else if (event.key === "Tab") {
        event.preventDefault();
        this.commitEditor();
        this.navigateBy(0, event.shiftKey ? -1 : 1);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.openEditor();
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.clearSelectionValues();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      this.navigateBy(0, event.shiftKey ? -1 : 1, { extend: false });
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.navigateBy(0, -1, { extend: event.shiftKey });
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      this.navigateBy(0, 1, { extend: event.shiftKey });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.navigateBy(-1, 0, { extend: event.shiftKey });
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.navigateBy(1, 0, { extend: event.shiftKey });
    }
  }

  syncOverlay(state) {
    if (!state.editor.editMode) {
      this.cellEditorOverlay.close();
      return;
    }
    const address = state.editor.selection?.addressA1;
    if (!address) {
      this.cancelEditing();
      return;
    }
    const rect = this.gridView.getCellRect(address);
    if (!rect) {
      return;
    }
    const sheetEdits = state.edits[state.workbook.activeSheetId] || {};
    const cellData = this.gridView.getCellData(address, sheetEdits);
    const multiline = Boolean(cellData.style?.alignment?.wrapText);
    const value = cellData.effectiveValue ?? "";
    this.cellEditorOverlay.open(rect, String(value), { multiline });
    this.cellEditorOverlay.focus();
  }

  syncSheetSelection(state) {
    const activeSheetId = state.workbook.activeSheetId;
    if (!activeSheetId || activeSheetId === this.lastSheetId) {
      return;
    }
    this.lastSheetId = activeSheetId;
    const sheet = this.getWorkbook()?.sheets?.find((item) => item.id === activeSheetId);
    const candidate = this.templateSchema.findFirstEditableAddress(sheet?.name || "", "A1");
    this.selectAddress(candidate);
  }

  selectAddress(addressA1, { extend = false } = {}) {
    const state = this.stateStore.getState();
    const activeSheetId = state.workbook.activeSheetId;
    if (!activeSheetId) {
      return;
    }

    const master = this.gridView.getMergedMaster(addressA1);
    this.selectionModel.setFocus(activeSheetId, master, { extend });
    this.syncSelectionToState();
    this.gridView.scrollCellIntoView(master);
    this.gridView.setCellError(master, null);
  }

  selectRange(startAddressA1, endAddressA1) {
    const sheetId = this.stateStore.getState().workbook.activeSheetId;
    if (!sheetId) {
      return;
    }

    const start = this.gridView.getMergedMaster(startAddressA1);
    const end = this.gridView.getMergedMaster(endAddressA1);
    this.selectionModel.setRangeByDrag(sheetId, start, end);
    this.syncSelectionToState();
  }

  syncSelectionToState() {
    if (!this.selectionModel.focus || !this.selectionModel.anchor || !this.selectionModel.range) {
      return;
    }

    const range = this.expandRangeForMerged(this.selectionModel.range);
    const focusAddressA1 = this.selectionModel.focus.addressA1;

    this.stateDriver.setSelectionRange({
      sheetId: this.selectionModel.focus.sheetId,
      anchorAddressA1: this.selectionModel.anchor.addressA1,
      focusAddressA1,
      range,
      mode: this.selectionModel.isSingleCell() ? "cell" : "range"
    });

    this.gridView.setSelectionRange(range);
    this.gridView.setFocusCell(focusAddressA1);
  }

  expandRangeForMerged(range) {
    let expanded = RangeOps.normalizeRange(range);
    let changed = true;

    while (changed) {
      changed = false;
      for (const item of RangeOps.iterRange(expanded)) {
        const merge = this.gridView.getMergeRange(item.addressA1);
        const next = {
          r1: Math.min(expanded.r1, merge.r1),
          c1: Math.min(expanded.c1, merge.c1),
          r2: Math.max(expanded.r2, merge.r2),
          c2: Math.max(expanded.c2, merge.c2)
        };
        if (next.r1 !== expanded.r1 || next.c1 !== expanded.c1 || next.r2 !== expanded.r2 || next.c2 !== expanded.c2) {
          expanded = next;
          changed = true;
        }
      }
    }

    return expanded;
  }

  navigateBy(rowDelta, colDelta, { extend = false } = {}) {
    const sheetId = this.stateStore.getState().workbook.activeSheetId;
    const bounds = this.gridView.getSheetBounds();
    this.selectionModel.moveFocus(sheetId, rowDelta, colDelta, { extend, bounds });
    this.syncSelectionToState();
    this.gridView.scrollCellIntoView(this.selectionModel.focus.addressA1);
  }

  openEditor() {
    const context = this.getSelectionContext();
    if (!context || !context.isSingleCell) {
      return;
    }
    if (!this.isEditable(context)) {
      this.showProtected(context.addressA1);
      return;
    }
    this.stateDriver.setEditMode(true);
  }

  cancelEditing() {
    this.cellEditorOverlay.close();
    this.stateDriver.setEditMode(false);
  }

  commitEditor() {
    this.applyInputValue(this.cellEditorOverlay.getValue());
  }

  applyInputValue(inputValue) {
    const context = this.getSelectionContext();
    if (!context || !context.isSingleCell) {
      return;
    }
    if (!this.isEditable(context)) {
      this.showProtected(context.addressA1);
      return;
    }
    const parsed = this.valueParser.parseInput({
      inputString: inputValue,
      baselineCell: context.cellData.baselineCell
    });
    if (!parsed.ok) {
      this.toast.show(parsed.error, "error");
      this.gridView.setCellError(context.addressA1, parsed.error);
      this.stateDriver.setError(context.sheetId, context.addressA1, parsed.error);
      return;
    }
    const prevValue = context.cellData.editCell
      ? context.cellData.editCell.value
      : context.cellData.baselineCell?.value ?? null;
    if (this.stateDriver.valuesEqual(prevValue, parsed.value)) {
      this.cancelEditing();
      return;
    }
    const command = {
      sheetId: context.sheetId,
      sheetName: context.sheetName,
      addressA1: context.addressA1,
      prevValue,
      nextValue: parsed.value,
      prevType: context.cellData.editCell?.type || typeof prevValue,
      nextType: parsed.type,
      ts: Date.now()
    };
    this.stateDriver.applyCommand(command, "next", "edit");
    this.undoStack.push(command);
    this.onCellCommitted?.({ sheetName: context.sheetName, addressA1: context.addressA1, value: parsed.value });
    this.cancelEditing();
  }

  async applyMatrixAtTarget(matrix) {
    const context = this.getSelectionContext();
    if (!context) {
      return;
    }

    const range = context.selectionRange;
    const target = range ? { r: range.r1, c: range.c1 } : RangeOps.a1ToRc(context.addressA1);
    const totalCells = matrix.length * (matrix[0]?.length || 0);
    if (totalCells <= 0) {
      return;
    }

    const applyWork = async (reportProgress = () => null) => {
      const commands = [];
      const touched = new Set();
      let applied = 0;
      let skippedReadOnly = 0;
      let skippedOutOfBounds = 0;
      let skippedInvalid = 0;
      const bounds = this.gridView.getSheetBounds();

      reportProgress({ completed: 0, total: totalCells, message: "Применение вставки" });

      for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < matrix[r].length; c += 1) {
          const row = target.r + r;
          const col = target.c + c;
          const step = r * matrix[r].length + c + 1;

          if (row > bounds.maxRow || col > bounds.maxCol) {
            skippedOutOfBounds += 1;
            reportProgress({ completed: step, total: totalCells, message: "Применение вставки" });
            continue;
          }

          const address = this.gridView.getMergedMaster(RangeOps.rcToA1({ r: row, c: col }));
          if (touched.has(address)) {
            reportProgress({ completed: step, total: totalCells, message: "Применение вставки" });
            continue;
          }
          touched.add(address);
          const cellData = this.gridView.getCellData(address, this.getSheetEdits());
          if (!this.templateSchema.isCellEditable(context.sheetName, address, cellData.baselineCell)) {
            skippedReadOnly += 1;
            reportProgress({ completed: step, total: totalCells, message: "Применение вставки" });
            continue;
          }

          const parsed = this.valueParser.parseInput({ inputString: matrix[r][c] ?? "", baselineCell: cellData.baselineCell });
          if (!parsed.ok) {
            skippedInvalid += 1;
            continue;
          }

          const prevValue = cellData.editCell ? cellData.editCell.value : cellData.baselineCell?.value ?? null;
          if (this.stateDriver.valuesEqual(prevValue, parsed.value)) {
            reportProgress({ completed: step, total: totalCells, message: "Применение вставки" });
            continue;
          }

          commands.push({
            sheetId: context.sheetId,
            sheetName: context.sheetName,
            addressA1: address,
            prevValue,
            nextValue: parsed.value,
            prevType: cellData.editCell?.type || typeof prevValue,
            nextType: parsed.type,
            ts: Date.now()
          });
          applied += 1;
          reportProgress({ completed: step, total: totalCells, message: "Применение вставки" });

          if (step % 500 === 0) {
            await microYield();
          }
        }
      }

      const tx = new EditTransaction({ title: "Вставка", stateDriver: this.stateDriver, undoStack: this.undoStack, userAction: "paste" });
      for (const command of commands) {
        tx.add(command);
      }
      tx.commit({
        auditEntry: {
          ts: Date.now(),
          userAction: "paste",
          sheetName: context.sheetName,
          addressA1: `${RangeOps.rcToA1(target)}:${RangeOps.rcToA1({ r: target.r + matrix.length - 1, c: target.c + matrix[0].length - 1 })}`,
          before: `applied=${applied}`,
          after: `skippedReadOnly=${skippedReadOnly}, skippedOutOfBounds=${skippedOutOfBounds}, skippedInvalid=${skippedInvalid}`
        }
      });

      if (commands.length) {
        this.onCellCommitted?.({ sheetName: context.sheetName, addressA1: commands[0].addressA1, value: commands[0].nextValue });
      }

      this.toast.show(`Вставка: применено ${applied}, защищено ${skippedReadOnly}, вне границ ${skippedOutOfBounds}`, applied ? "success" : "info");
      this.selectRange(RangeOps.rcToA1(target), RangeOps.rcToA1({ r: target.r + matrix.length - 1, c: target.c + matrix[0].length - 1 }));
    };

    if (totalCells > 2000 && this.jobQueue) {
      const { promise } = this.jobQueue.enqueue({
        type: "PASTE_RANGE",
        title: "Вставка диапазона",
        run: async (_, signal, progress) => {
          if (signal.aborted) {
            throw new Error("Задача прервана");
          }
          await applyWork(progress);
        }
      });
      await promise;
      return;
    }

    await applyWork();
  }

  clearSelectionValues() {
    const context = this.getSelectionContext();
    if (!context?.selectionRange) {
      return;
    }

    const commands = [];
    const touched = new Set();
    let skipped = 0;
    for (const item of RangeOps.iterRange(context.selectionRange)) {
      const address = this.gridView.getMergedMaster(item.addressA1);
      if (touched.has(address)) {
        continue;
      }
      touched.add(address);
      const cellData = this.gridView.getCellData(address, this.getSheetEdits());
      if (!this.templateSchema.isCellEditable(context.sheetName, address, cellData.baselineCell)) {
        skipped += 1;
        continue;
      }

      const prevValue = cellData.editCell ? cellData.editCell.value : cellData.baselineCell?.value ?? null;
      if (this.stateDriver.valuesEqual(prevValue, null)) {
        continue;
      }

      commands.push({
        sheetId: context.sheetId,
        sheetName: context.sheetName,
        addressA1: address,
        prevValue,
        nextValue: null,
        prevType: cellData.editCell?.type || typeof prevValue,
        nextType: "null",
        ts: Date.now()
      });
    }

    const tx = new EditTransaction({ title: "Очистка", stateDriver: this.stateDriver, undoStack: this.undoStack, userAction: "cut" });
    for (const command of commands) {
      tx.add(command);
    }
    tx.commit({
      auditEntry: {
        ts: Date.now(),
        userAction: "cut",
        sheetName: context.sheetName,
        addressA1: this.selectionModel.getRangeA1(),
        before: `applied=${commands.length}`,
        after: `skippedReadOnly=${skipped}`
      }
    });

    if (commands.length) {
      this.onCellCommitted?.({ sheetName: context.sheetName, addressA1: commands[0].addressA1, value: null });
    }
  }

  getSelectionMatrix() {
    const context = this.getSelectionContext();
    if (!context?.selectionRange) {
      return [];
    }

    const state = this.stateStore.getState();
    const calcSheet = state.calc.perSheet?.[context.sheetName] || {};
    const out = [];

    for (let row = context.selectionRange.r1; row <= context.selectionRange.r2; row += 1) {
      const line = [];
      for (let col = context.selectionRange.c1; col <= context.selectionRange.c2; col += 1) {
        const address = this.gridView.getMergedMaster(RangeOps.rcToA1({ r: row, c: col }));
        const cellData = this.gridView.getCellData(address, this.getSheetEdits());
        if (cellData.baselineCell?.formula) {
          line.push(calcSheet[address]?.value ?? "");
        } else if (cellData.editCell) {
          line.push(cellData.editCell.value ?? "");
        } else {
          line.push(cellData.baselineCell?.value ?? "");
        }
      }
      out.push(line);
    }

    return out;
  }

  async insertRowInTable() {
    const ctx = this.getSelectionContext();
    if (!ctx) {
      return;
    }

    const table = this.tableRangeManager?.resolveTableAtSelection({ sheetName: ctx.sheetName, addressA1: ctx.addressA1 });
    if (!table) {
      this.toast.show("Выделение вне поддерживаемого диапазона таблицы", "error");
      return;
    }

    const row = RangeOps.a1ToRc(ctx.addressA1).r;
    const shift = this.rowShiftService.insertRow({ sheetId: ctx.sheetId, sheetName: ctx.sheetName, table, atRowIndexWithinTable: row - table.startRow, count: 1 });
    await this.applyShiftCommands("insertRow", table, row, shift.commands);
  }

  async deleteRowInTable() {
    const ctx = this.getSelectionContext();
    if (!ctx) {
      return;
    }

    const table = this.tableRangeManager?.resolveTableAtSelection({ sheetName: ctx.sheetName, addressA1: ctx.addressA1 });
    if (!table) {
      this.toast.show("Выделение вне поддерживаемого диапазона таблицы", "error");
      return;
    }

    const row = RangeOps.a1ToRc(ctx.addressA1).r;
    const shift = this.rowShiftService.deleteRow({ sheetId: ctx.sheetId, sheetName: ctx.sheetName, table, atRowIndexWithinTable: row - table.startRow, count: 1 });
    await this.applyShiftCommands("deleteRow", table, row, shift.commands);
  }

  async applyShiftCommands(action, table, row, commands) {
    const apply = async (progress = () => null) => {
      const tx = new EditTransaction({ title: action, stateDriver: this.stateDriver, undoStack: this.undoStack, userAction: action });
      for (let i = 0; i < commands.length; i += 1) {
        tx.add(commands[i]);
        progress({ completed: i + 1, total: commands.length || 1, message: "Shifting rows" });
        if ((i + 1) % 500 === 0) {
          await microYield();
        }
      }
      tx.commit({
        auditEntry: {
          ts: Date.now(),
          userAction: action,
          sheetName: table.sheetName,
          addressA1: `${table.tableId}@${row}`,
          before: `${commands.length} cells`,
          after: "shift"
        }
      });
    };

    if (commands.length > 2000 && this.jobQueue) {
      const { promise } = this.jobQueue.enqueue({
        type: action === "insertRow" ? "INSERT_TABLE_ROW" : "DELETE_TABLE_ROW",
        title: action === "insertRow" ? "Вставка строки" : "Удаление строки",
        run: async (_, signal, progress) => {
          if (signal.aborted) {
            throw new Error("Задача прервана");
          }
          await apply(progress);
        }
      });
      await promise;
    } else {
      await apply();
    }

    if (commands.length) {
      this.onCellCommitted?.({ sheetName: table.sheetName, addressA1: commands[0].addressA1, value: commands[0].nextValue });
      this.toast.show(`${action}: ${commands.length} cells updated`, "success");
    }
  }

  undo() {
    const item = this.undoStack.undo();
    if (!item) {
      return;
    }

    const commands = item.kind === "batch" ? [...item.commands].reverse() : [item];
    this.stateDriver.applyCommands(commands, "prev", "undo");

    const first = commands[0];
    if (first) {
      this.onCellCommitted?.({ sheetName: first.sheetName, addressA1: first.addressA1, value: first.prevValue });
      this.selectAddress(first.addressA1);
    }
  }

  redo() {
    const item = this.undoStack.redo();
    if (!item) {
      return;
    }

    const commands = item.kind === "batch" ? item.commands : [item];
    this.stateDriver.applyCommands(commands, "next", "redo");

    const first = commands[0];
    if (first) {
      this.onCellCommitted?.({ sheetName: first.sheetName, addressA1: first.addressA1, value: first.nextValue });
      this.selectAddress(first.addressA1);
    }
  }

  getSelectionContext() {
    const state = this.stateStore.getState();
    const sheetId = state.workbook.activeSheetId;
    const sheet = this.getWorkbook()?.sheets?.find((item) => item.id === sheetId);
    const selection = state.editor.selection;
    const addressA1 = selection?.focusAddressA1 || selection?.addressA1;
    if (!sheetId || !addressA1 || !sheet) {
      return null;
    }

    const sheetEdits = state.edits[sheetId] || {};
    const cellData = this.gridView.getCellData(addressA1, sheetEdits);
    const selectionRange = selection?.range || (() => { const rc = RangeOps.a1ToRc(addressA1); return { r1: rc.r, c1: rc.c, r2: rc.r, c2: rc.c }; })();

    return {
      sheetId,
      sheetName: sheet.name,
      addressA1,
      cellData,
      selectionRange,
      isSingleCell: selectionRange.r1 === selectionRange.r2 && selectionRange.c1 === selectionRange.c2
    };
  }

  getSheetEdits() {
    const state = this.stateStore.getState();
    return state.edits[state.workbook.activeSheetId] || {};
  }

  isEditable(context) {
    return this.templateSchema.isCellEditable(
      context.sheetName,
      context.addressA1,
      context.cellData.baselineCell
    );
  }

  showProtected(addressA1) {
    this.toast.show("Ячейка защищена", "error");
    this.gridView.setCellError(addressA1, "Защищено");
    const sheetId = this.stateStore.getState().workbook.activeSheetId;
    if (sheetId) {
      this.stateDriver.setError(sheetId, addressA1, "Ячейка защищена");
    }
  }
}




