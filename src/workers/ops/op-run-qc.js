import { QcService } from "../../qc/QcService.js";
import { TemplateSchema } from "../../editor/TemplateSchema.js";
import { BindingMap } from "../../domain/BindingMap.js";

export async function runQc({ payload, signal, reportProgress }) {
  if (signal.aborted) {
    throw cancelled();
  }

  reportProgress({ completed: 0, total: 1, message: "Run QC" });

  const schema = new TemplateSchema(payload.schema || {});
  const bindings = new BindingMap(payload.bindings || {});
  const qcService = new QcService();
  const qcReport = qcService.run({
    workbook: payload.normalizedWorkbook,
    edits: payload.edits,
    calcSnapshot: payload.calcSnapshot,
    schema,
    bindings,
    editorErrors: payload.editorErrors || {},
    numFmtWarnings: payload.numFmtWarnings || []
  });

  reportProgress({ completed: 1, total: 1, message: "QC done" });
  return { qcReport };
}

function cancelled() {
  const err = new Error("Cancelled");
  err.code = "CANCELLED";
  return err;
}
