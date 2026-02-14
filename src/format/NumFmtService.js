import SSF from "ssf";

export class NumFmtService {
  constructor() {
    this.warnings = new Map();
  }

  format({ value, numFmt, fallbackType, sheetName, addressA1 }) {
    if (value === null || value === undefined) {
      return { text: "", ok: true, warning: null };
    }

    if (!numFmt) {
      if (typeof value === "number") {
        return { text: String(value), ok: true, warning: null };
      }
      return { text: String(value), ok: true, warning: null };
    }

    if (typeof value !== "number") {
      return { text: String(value), ok: true, warning: null };
    }

    try {
      const text = SSF.format(numFmt, value);
      return { text, ok: true, warning: null };
    } catch {
      const key = `${sheetName || "?"}!${addressA1 || "?"}`;
      if (!this.warnings.has(key)) {
        this.warnings.set(key, `Unsupported numFmt at ${key}: ${numFmt}`);
      }

      return {
        text: String(value),
        ok: false,
        warning: {
          code: "WARN_NUMFMT_UNSUPPORTED",
          message: `Unsupported numFmt '${numFmt}'`,
          fallbackType: fallbackType || typeof value
        }
      };
    }
  }

  takeWarnings() {
    const list = Array.from(this.warnings.values());
    this.warnings.clear();
    return list;
  }
}
