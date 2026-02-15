export class AgentGridModule {
  constructor({ num, decodeAddr }) {
    if (typeof num !== "function") throw new Error("AgentGridModule requires num()");
    if (typeof decodeAddr !== "function") throw new Error("AgentGridModule requires decodeAddr()");
    this._num = num;
    this._decodeAddr = decodeAddr;
  }

  parseA1Address(addr) {
    const clean = String(addr || "").replaceAll("$", "").trim().toUpperCase();
    if (!/^[A-Z]+[0-9]+$/.test(clean)) return null;
    return this._decodeAddr(clean);
  }

  parseA1Range(range) {
    const txt = String(range || "").trim().toUpperCase();
    if (!txt) return null;
    const [a, b] = txt.split(":");
    const s = this.parseA1Address(a);
    const e = this.parseA1Address(b || a);
    if (!s || !e) return null;
    return {
      r1: Math.min(s.row, e.row),
      c1: Math.min(s.col, e.col),
      r2: Math.max(s.row, e.row),
      c2: Math.max(s.col, e.col),
    };
  }

  colToName(col) {
    let n = Math.max(1, this._num(col, 1));
    let out = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  toA1(row, col) {
    return `${this.colToName(col)}${Math.max(1, this._num(row, 1))}`;
  }

  agentCellValueText(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return "";
    if (typeof cell.value === "number" || typeof cell.value === "boolean") return String(cell.value);
    return String(cell.value);
  }

  compactForTool(value, depth = 0) {
    if (depth > 5) return "[depth-limit]";
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return value.length > 1200 ? `${value.slice(0, 1200)}...[trim]` : value;
    if (typeof value !== "object") return value;
    if (Array.isArray(value)) {
      const limit = 80;
      const arr = value.slice(0, limit).map((v) => this.compactForTool(v, depth + 1));
      if (value.length > limit) arr.push(`[... ${value.length - limit} more]`);
      return arr;
    }
    const out = {};
    let count = 0;
    for (const [k, v] of Object.entries(value)) {
      if (count >= 80) {
        out.__trimmed__ = true;
        break;
      }
      out[k] = this.compactForTool(v, depth + 1);
      count += 1;
    }
    return out;
  }
}
