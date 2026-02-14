import { WorkbookExporter } from "../../xlsx/WorkbookExporter.js";

export async function runExportXlsx({ payload, signal, reportProgress }) {
  if (signal.aborted) {
    throw cancelled();
  }

  const warnings = [];
  reportProgress({ completed: 0, total: 4, message: "Load baseline" });

  const exporter = new WorkbookExporter();
  reportProgress({ completed: 1, total: 4, message: "Apply edits" });

  const out = await exporter.export({
    baselineBuffer: payload.baselineBuffer,
    edits: payload.edits,
    sheets: payload.sheets,
    exportMeta: payload.exportMeta,
    reportWarning: (w) => warnings.push(w)
  });

  if (signal.aborted) {
    throw cancelled();
  }

  reportProgress({ completed: 2, total: 4, message: "Serialize" });
  reportProgress({ completed: 3, total: 4, message: "Done" });

  return { outBuffer: out.buffer, fileName: out.fileName, warnings };
}

function cancelled() {
  const err = new Error("Cancelled");
  err.code = "CANCELLED";
  return err;
}
