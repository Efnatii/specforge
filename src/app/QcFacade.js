import { saveAs } from "file-saver";

export class QcFacade {
  constructor({ qcService, qcExporter, stateStore, jobQueue, toast, templateSchema }) {
    this.qcService = qcService;
    this.qcExporter = qcExporter;
    this.stateStore = stateStore;
    this.jobQueue = jobQueue;
    this.toast = toast;
    this.templateSchema = templateSchema;
  }

  async runScan(workbook) {
    if (!workbook) {
      return;
    }

    const state = this.stateStore.getState();

    const { promise } = this.jobQueue.enqueue({
      type: "RUN_QC",
      title: "QC scan",
      workerOp: "RUN_QC",
      workerPayload: {
        normalizedWorkbook: workbook,
        edits: state.edits,
        calcSnapshot: state.calc,
        schema: this.templateSchema?.schema || {},
        bindings: {},
        editorErrors: state.editor.errors || {},
        numFmtWarnings: state.warnings || []
      }
    });

    try {
      const result = await promise;
      const report = result.qcReport || result;
      this.stateStore.update({ qc: { report } });
    } catch (error) {
      const report = this.qcService.run({
        workbook,
        edits: state.edits,
        calcSnapshot: state.calc,
        schema: this.templateSchema,
        editorErrors: state.editor.errors || {},
        numFmtWarnings: state.warnings || []
      });
      this.stateStore.update({ qc: { report } });
      this.toast.show(`QC worker fallback: ${error.message}`, "info");
    }
  }

  runLightForCell(workbook, sheetName, addressA1) {
    if (!workbook) {
      return;
    }

    const state = this.stateStore.getState();
    const full = this.qcService.run({
      workbook,
      edits: state.edits,
      calcSnapshot: state.calc,
      schema: this.templateSchema,
      editorErrors: state.editor.errors || {},
      numFmtWarnings: state.warnings || []
    });

    const filtered = full.items.filter((item) => item.sheetName === sheetName && item.addressA1 === addressA1);
    const previous = state.qc.report?.items || [];
    const keep = previous.filter((item) => !(item.sheetName === sheetName && item.addressA1 === addressA1));
    const merged = [...keep, ...filtered];

    this.stateStore.update({
      qc: {
        report: {
          ts: Date.now(),
          summary: {
            errorsCount: merged.filter((item) => item.level === "error").length,
            warningsCount: merged.filter((item) => item.level === "warning").length
          },
          items: merged
        }
      }
    });
  }

  exportCsv() {
    const report = this.stateStore.getState().qc.report;
    const blob = this.qcExporter.exportCsv(report);
    saveAs(blob, "qc-report.csv");
  }

  async exportXlsx() {
    const report = this.stateStore.getState().qc.report;
    const blob = await this.qcExporter.exportXlsx(report);
    saveAs(blob, "qc-report.xlsx");
  }
}
