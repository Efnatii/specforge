export class AgentStateAccessModule {
  constructor({ getState, getWorkbook, getSheetOverrides, setSheetOverrides }) {
    if (typeof getState !== "function") throw new Error("AgentStateAccessModule requires getState()");
    if (typeof getWorkbook !== "function") throw new Error("AgentStateAccessModule requires getWorkbook()");
    if (typeof getSheetOverrides !== "function") throw new Error("AgentStateAccessModule requires getSheetOverrides()");
    if (typeof setSheetOverrides !== "function") throw new Error("AgentStateAccessModule requires setSheetOverrides()");

    this._getState = getState;
    this._getWorkbook = getWorkbook;
    this._getSheetOverrides = getSheetOverrides;
    this._setSheetOverrides = setSheetOverrides;
  }

  normalizeAgentValue(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" || typeof value === "boolean") return value;
    return String(value);
  }

  getStatePath(path) {
    const tokens = this.parseStatePath(path);
    if (!tokens.length) return this._getState();
    let ref = this._getState();
    for (const token of tokens) {
      if (ref === null || ref === undefined) return undefined;
      ref = ref[token];
    }
    return ref;
  }

  statePathExists(path) {
    const tokens = this.parseStatePath(path);
    if (!tokens.length) return false;

    let ref = this._getState();
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const token = tokens[i];
      if (ref === null || ref === undefined || typeof ref !== "object") return false;
      if (!(token in ref)) return false;
      ref = ref[token];
    }

    if (ref === null || ref === undefined || typeof ref !== "object") return false;
    const last = tokens[tokens.length - 1];
    if (Array.isArray(ref) && typeof last === "number") {
      return Number.isInteger(last) && last >= 0 && last < ref.length;
    }
    return Object.prototype.hasOwnProperty.call(ref, last);
  }

  setStatePath(path, value) {
    const tokens = this.parseStatePath(path);
    if (!tokens.length) throw new Error("bad path");

    let ref = this._getState();
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const t = tokens[i];
      const next = tokens[i + 1];
      if (ref[t] === undefined || ref[t] === null) ref[t] = typeof next === "number" ? [] : {};
      if (typeof ref[t] !== "object") throw new Error(`path blocked at ${String(t)}`);
      ref = ref[t];
    }

    ref[tokens[tokens.length - 1]] = value;
  }

  parseStatePath(path) {
    const src = String(path || "").trim();
    if (!src) return [];
    const tokens = [];
    const re = /([^[.\]]+)|\[(\d+)\]/g;
    let m;
    while ((m = re.exec(src))) {
      if (m[1] !== undefined) tokens.push(m[1]);
      else tokens.push(Number(m[2]));
    }
    return tokens;
  }

  setAgentSheetCell(sheetId, row, col, value, formula = "") {
    let map = this._getSheetOverrides();
    if (!map || typeof map !== "object") {
      map = {};
      this._setSheetOverrides(map);
    }
    if (!map[sheetId]) map[sheetId] = {};
    map[sheetId][`${row}:${col}`] = {
      value: this.normalizeAgentValue(value),
      formula: String(formula || ""),
    };
  }

  applyAgentSheetOverrides() {
    const workbook = this._getWorkbook();
    if (!workbook || !workbook.byId) return;

    for (const [sheetId, map] of Object.entries(this._getSheetOverrides() || {})) {
      const sheet = workbook.byId[sheetId];
      if (!sheet || !map || typeof map !== "object") continue;

      for (const [cellKey, patch] of Object.entries(map)) {
        const [rRaw, cRaw] = cellKey.split(":");
        const row = Number(rRaw);
        const col = Number(cRaw);
        if (!Number.isFinite(row) || !Number.isFinite(col) || row < 1 || col < 1) continue;
        this._writeSheetCell(sheet, row, col, patch?.value ?? null, patch?.formula || "");
      }
    }
  }

  _writeSheetCell(sheet, row, col, value, formula = "") {
    this._ensureSheetBounds(sheet, row, col);
    const cell = sheet.rows[row - 1].cells[col - 1];
    cell.value = this.normalizeAgentValue(value);
    cell.formula = String(formula || "");
  }

  _ensureSheetBounds(sheet, row, col) {
    while (sheet.cols.length < col) {
      sheet.cols.push(64);
      for (const r of sheet.rows) r.cells.push({ styleId: 0, value: null, formula: "" });
    }

    while (sheet.rows.length < row) {
      const height = sheet.rows[sheet.rows.length - 1]?.height || 20;
      const cells = new Array(sheet.cols.length).fill(0).map(() => ({ styleId: 0, value: null, formula: "" }));
      sheet.rows.push({ height, cells });
    }

    for (const r of sheet.rows) {
      while (r.cells.length < sheet.cols.length) r.cells.push({ styleId: 0, value: null, formula: "" });
    }
  }
}
