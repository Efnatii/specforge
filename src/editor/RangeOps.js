export class RangeOps {
  static a1ToRc(addressA1) {
    const match = /^([A-Z]+)(\d+)$/i.exec(String(addressA1 || "").trim());
    if (!match) {
      throw new Error(`Invalid address: ${addressA1}`);
    }

    const letters = match[1].toUpperCase();
    let c = 0;
    for (let i = 0; i < letters.length; i += 1) {
      c = c * 26 + (letters.charCodeAt(i) - 64);
    }

    return { r: Number(match[2]), c };
  }

  static rcToA1({ r, c }) {
    if (r < 1 || c < 1) {
      throw new Error(`Invalid rc: r=${r}, c=${c}`);
    }

    let value = c;
    let letters = "";
    while (value > 0) {
      const rem = (value - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      value = Math.floor((value - 1) / 26);
    }

    return `${letters}${r}`;
  }

  static parseRangeA1(rangeA1) {
    const parts = String(rangeA1 || "").split(":");
    if (parts.length === 1) {
      const p = RangeOps.a1ToRc(parts[0]);
      return { r1: p.r, c1: p.c, r2: p.r, c2: p.c };
    }

    if (parts.length !== 2) {
      throw new Error(`Invalid range: ${rangeA1}`);
    }

    const a = RangeOps.a1ToRc(parts[0]);
    const b = RangeOps.a1ToRc(parts[1]);

    return {
      r1: Math.min(a.r, b.r),
      c1: Math.min(a.c, b.c),
      r2: Math.max(a.r, b.r),
      c2: Math.max(a.c, b.c)
    };
  }

  static normalizeRange(range) {
    return {
      r1: Math.min(range.r1, range.r2),
      c1: Math.min(range.c1, range.c2),
      r2: Math.max(range.r1, range.r2),
      c2: Math.max(range.c1, range.c2)
    };
  }

  static clampRange(range, bounds) {
    const normalized = RangeOps.normalizeRange(range);
    return {
      r1: Math.min(Math.max(1, normalized.r1), bounds.maxRow),
      c1: Math.min(Math.max(1, normalized.c1), bounds.maxCol),
      r2: Math.min(Math.max(1, normalized.r2), bounds.maxRow),
      c2: Math.min(Math.max(1, normalized.c2), bounds.maxCol)
    };
  }

  static *iterRange(range) {
    const n = RangeOps.normalizeRange(range);
    for (let r = n.r1; r <= n.r2; r += 1) {
      for (let c = n.c1; c <= n.c2; c += 1) {
        yield { r, c, addressA1: RangeOps.rcToA1({ r, c }) };
      }
    }
  }

  static tsvEncode(matrix) {
    return (matrix || []).map((row) => (row || []).map((v) => String(v ?? "")).join("\t")).join("\r\n");
  }

  static tsvDecode(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    return lines.map((line) => line.split("\t"));
  }
}
