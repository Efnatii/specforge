export class CalcFacade {
  constructor({ calcEngine, stateStore, jobQueue, toast, templateSchema, eventBus }) {
    this.calcEngine = calcEngine;
    this.stateStore = stateStore;
    this.jobQueue = jobQueue;
    this.toast = toast;
    this.templateSchema = templateSchema;
    this.eventBus = eventBus;
  }

  async buildCalcModel(workbook, edits) {
    if (!workbook) {
      return;
    }

    const { promise } = this.jobQueue.enqueue({
      type: "BUILD_CALC_MODEL",
      title: "Build calc model",
      run: async (_, signal, reportProgress) => this.calcEngine.buildFromBaseline({
        normalizedWorkbook: workbook,
        edits,
        templateSchema: this.templateSchema,
        reportProgress,
        reportWarning: () => null,
        signal
      })
    });

    try {
      const result = await promise;
      this.stateStore.update({
        calc: result.calcSnapshot,
        warnings: [...this.stateStore.getState().warnings, ...(result.warnings || [])].slice(-50)
      });
    } catch (error) {
      this.toast.show(`Calc model build failed: ${error.message}`, "error");
    }
  }

  onCellCommitted({ sheetName, addressA1, value }) {
    const changed = this.calcEngine.setCellValue({ sheetName, addressA1, value });
    if (!changed.length) {
      return;
    }

    const state = this.stateStore.getState();
    const calc = structuredClone(state.calc || { perSheet: {} });
    for (const item of changed) {
      if (!calc.perSheet[item.sheetName]) {
        calc.perSheet[item.sheetName] = {};
      }
      calc.perSheet[item.sheetName][item.addressA1] = { value: item.value, error: item.error, type: item.error ? "error" : typeof item.value };
    }

    this.stateStore.update({ calc });
    this.eventBus.emit("CALC_CHANGED", { changed });
  }

  async recalcAfterMassEdit(workbook, edits) {
    const { promise } = this.jobQueue.enqueue({
      type: "RECALC_SHEET",
      title: "Recalculate",
      run: async (_, signal, progress) => this.calcEngine.buildFromBaseline({
        normalizedWorkbook: workbook,
        edits,
        templateSchema: this.templateSchema,
        reportProgress: progress,
        reportWarning: () => null,
        signal
      })
    });

    const result = await promise;
    this.stateStore.update({ calc: result.calcSnapshot });
  }
}
