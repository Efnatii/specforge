import { FindIndexBuilder } from "../../find/FindIndexBuilder.js";

export async function runBuildFindIndex({ payload, signal, reportProgress }) {
  const builder = new FindIndexBuilder();
  const result = await builder.buildIndex({
    scope: payload.scope,
    normalizedWorkbook: payload.normalizedWorkbook,
    edits: payload.edits,
    calcSnapshot: payload.calcSnapshot,
    activeSheetName: payload.sheetName || null,
    signal,
    reportProgress
  });

  if ((result.entries || []).length > 300000) {
    return {
      index: { ...result, entries: result.entries.slice(0, 300000) },
      stats: { truncated: true, total: result.entries.length },
      warnings: ["Find index truncated to 300000 entries"]
    };
  }

  return {
    index: result,
    stats: { truncated: false, total: result.entries.length },
    warnings: []
  };
}
