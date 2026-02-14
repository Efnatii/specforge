export class ValueParser {
  parseInput({ inputString, baselineCell }) {
    const raw = String(inputString ?? "");
    const trimmed = raw.trim();

    if (trimmed === "") {
      return {
        ok: true,
        value: null,
        displayValue: "",
        error: null,
        type: "null"
      };
    }

    const expectNumeric = this.expectNumericBaseline(baselineCell);
    const normalizedNumber = this.tryParseNumber(trimmed);

    if (expectNumeric && normalizedNumber === null) {
      return {
        ok: false,
        value: null,
        displayValue: raw,
        error: "Ожидается числовое значение",
        type: "error"
      };
    }

    if (normalizedNumber !== null) {
      return {
        ok: true,
        value: normalizedNumber,
        displayValue: String(normalizedNumber),
        error: null,
        type: "number"
      };
    }

    return {
      ok: true,
      value: raw,
      displayValue: raw,
      error: null,
      type: "string"
    };
  }

  expectNumericBaseline(baselineCell) {
    if (!baselineCell) {
      return false;
    }

    if (typeof baselineCell.value === "number") {
      return true;
    }

    const numFmt = String(baselineCell.numFmt || "").toLowerCase();
    if (!numFmt) {
      return false;
    }

    return numFmt.includes("0") || numFmt.includes("#") || numFmt.includes("%") || numFmt.includes("$");
  }

  tryParseNumber(value) {
    const normalized = value.replace(/\s+/g, "").replace(",", ".");
    if (!/^[-+]?\d*(\.\d+)?$/.test(normalized)) {
      return null;
    }

    if (normalized === "" || normalized === "." || normalized === "+" || normalized === "-") {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
}

