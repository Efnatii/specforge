import { WorkbookExporter } from "../../xlsx/WorkbookExporter.js";

export async function runExportXlsx({ payload, signal, reportProgress }) {
  if (signal.aborted) {
    throw cancelled();
  }

  const warnings = [];
  reportProgress({ completed: 0, total: 4, message: "Загрузка baseline" });

  const exporter = new WorkbookExporter();
  reportProgress({ completed: 1, total: 4, message: "Применение правок" });

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

  reportProgress({ completed: 2, total: 4, message: "Сериализация" });
  reportProgress({ completed: 3, total: 4, message: "Готово" });

  return { outBuffer: out.buffer, fileName: out.fileName, warnings };
}

function cancelled() {
  const err = new Error("Cancelled");
  err.code = "CANCELLED";
  return err;
}

