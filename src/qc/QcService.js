import { QcRules } from "./QcRules.js";

export class QcService {
  constructor() {
    this.rules = new QcRules();
  }

  run({ workbook, edits, calcSnapshot, schema, editorErrors, numFmtWarnings }) {
    const items = this.rules.collect({ workbook, edits, calcSnapshot, schema, editorErrors, numFmtWarnings });

    const errorsCount = items.filter((item) => item.level === "error").length;
    const warningsCount = items.filter((item) => item.level === "warning").length;

    return {
      ts: Date.now(),
      summary: {
        errorsCount,
        warningsCount
      },
      items
    };
  }
}
