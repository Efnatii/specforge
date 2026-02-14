import { WorkbookAdapter } from "../../xlsx/WorkbookAdapter.js";
import { TemplateFingerprint } from "../../xlsx/TemplateFingerprint.js";

export async function runParseWorkbook({ payload, signal, reportProgress }) {
  if (signal.aborted) {
    throw cancelled();
  }

  reportProgress({ completed: 0, total: 3, message: "Load workbook" });
  const adapter = new WorkbookAdapter();
  const normalizedWorkbook = await adapter.parse(payload.xlsxBuffer);

  if (signal.aborted) {
    throw cancelled();
  }

  reportProgress({ completed: 1, total: 3, message: "Normalize" });
  const fp = new TemplateFingerprint();
  const structureFingerprint = fp.buildStructureFingerprint(normalizedWorkbook);
  const bufferHash = await fp.hashBufferSha256(payload.xlsxBuffer);

  if (signal.aborted) {
    throw cancelled();
  }

  reportProgress({ completed: 2, total: 3, message: "Finalize" });

  return {
    normalizedWorkbook,
    structureFingerprint,
    bufferHash,
    templateMeta: payload.templateMeta || null
  };
}

function cancelled() {
  const err = new Error("Cancelled");
  err.code = "CANCELLED";
  return err;
}
