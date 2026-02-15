export class ProjectFileExcelValueModule {
  constructor({ stateApi }) {
    if (!stateApi) throw new Error("ProjectFileExcelValueModule requires stateApi");
    this._state = stateApi;
  }

  parseHeaderText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\r?\n+/g, " ")
      .replace(/[^\p{L}\p{N}%]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  headerHasAny(text, aliases) {
    return aliases.some((alias) => text.includes(alias));
  }

  isCatalogPriceHeader(text) {
    if (!text.includes("цена")) return false;
    if (text.includes("без скид") || text.includes("нацен") || text.includes("с ндс")) return true;
    return false;
  }

  isBasePriceHeader(text) {
    return text.includes("цена") && text.includes("без ндс") && !text.includes("с ндс");
  }

  detectPositionLayout(ws) {
    const defaults = {
      idx: 1,
      schematic: 2,
      name: 3,
      manufacturer: 4,
      article: 5,
      qty: 6,
      unit: 7,
      basePrice: 8,
      priceCatalog: 9,
      markup: 12,
      discount: 13,
      supplier: 18,
      note: 19,
    };

    const maxRows = Math.min(Math.max(ws.rowCount, 12), 50);
    const maxCols = Math.max(19, ws.actualColumnCount || ws.columnCount || 19);

    let best = null;
    for (let r = 1; r <= maxRows; r += 1) {
      const cols = {};
      let score = 0;

      for (let c = 1; c <= maxCols; c += 1) {
        const txt = this.parseHeaderText(this.excelText(ws.getCell(r, c).value));
        if (!txt) continue;

        if (!cols.idx && (txt.includes("п п") || txt.includes("№") || txt === "n")) {
          cols.idx = c;
          score += 2;
        }
        if (!cols.schematic && this.headerHasAny(txt, ["обознач", "схем", "чертеж"])) {
          cols.schematic = c;
          score += 1;
        }
        if (!cols.name && this.headerHasAny(txt, ["наименование", "марка", "позиция"])) {
          cols.name = c;
          score += 2;
        }
        if (!cols.manufacturer && this.headerHasAny(txt, ["производ", "бренд", "завод"])) {
          cols.manufacturer = c;
          score += 1;
        }
        if (!cols.article && this.headerHasAny(txt, ["артикул", "код", "каталож", "партномер"])) {
          cols.article = c;
          score += 1;
        }
        if (!cols.qty && this.headerHasAny(txt, ["кол во", "колич", "qty"])) {
          cols.qty = c;
          score += 2;
        }
        if (!cols.unit && this.headerHasAny(txt, ["ед изм", "единиц", "unit"])) {
          cols.unit = c;
          score += 1;
        }
        if (!cols.markup && txt.includes("нацен")) {
          cols.markup = c;
          score += 1;
        }
        if (!cols.discount && txt.includes("скид")) {
          cols.discount = c;
          score += 1;
        }
        if (!cols.supplier && txt.includes("поставщ")) cols.supplier = c;
        if (!cols.note && (txt.includes("примеч") || txt.includes("коммент"))) cols.note = c;

        if (!cols.priceCatalog && this.isCatalogPriceHeader(txt)) {
          cols.priceCatalog = c;
          score += 2;
        } else if (!cols.basePrice && this.isBasePriceHeader(txt)) {
          cols.basePrice = c;
          score += 1;
        } else if (!cols.priceCatalog && txt.includes("цена")) {
          cols.priceCatalog = c;
          score += 1;
        }
      }

      if (!best || score > best.score) best = { row: r, cols, score };
    }

    const useDetected = best && best.score >= 4;
    const cols = { ...defaults, ...(useDetected ? best.cols : {}) };
    if (!cols.basePrice) cols.basePrice = defaults.basePrice;
    if (!cols.priceCatalog) cols.priceCatalog = defaults.priceCatalog;

    return {
      headerRow: useDetected ? best.row : 2,
      startRow: (useDetected ? best.row : 2) + 1,
      maxCols,
      cols,
    };
  }

  rowLooseText(ws, row, maxCols) {
    const out = [];
    for (let c = 1; c <= maxCols; c += 1) {
      const text = this.excelText(ws.getCell(row, c).value);
      if (text) out.push(text);
    }
    return this.parseHeaderText(out.join(" "));
  }

  isPositionsStopRow(text, kind) {
    if (!text) return false;
    if (kind === "main" && (text.includes("разработка схем") || text.includes("расходный материал"))) return true;
    return text.includes("итого");
  }

  excelCellText(ws, row, col) {
    if (!Number.isFinite(col) || col <= 0) return "";
    return this.excelText(ws.getCell(row, col).value);
  }

  excelCellNum(ws, row, col) {
    if (!Number.isFinite(col) || col <= 0) return NaN;
    return this.excelNum(ws.getCell(row, col).value);
  }

  findCellByText(ws, pattern, maxRows, maxCols) {
    for (let r = 1; r <= maxRows; r += 1) {
      for (let c = 1; c <= maxCols; c += 1) {
        const txt = this.parseHeaderText(this.excelText(ws.getCell(r, c).value));
        if (txt && pattern.test(txt)) return { row: r, col: c };
      }
    }
    return null;
  }

  rowNumbers(ws, row, fromCol, maxCols) {
    const nums = [];
    for (let c = Math.max(1, fromCol); c <= maxCols; c += 1) {
      const n = this.excelNum(ws.getCell(row, c).value);
      if (Number.isFinite(n)) nums.push(n);
    }
    return nums;
  }

  excelPrimitive(value) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === "object") {
      if (Array.isArray(value.richText)) return value.richText.map((x) => x.text || "").join("");
      if (typeof value.text === "string") return value.text;
      if (value.result !== undefined) return this.excelPrimitive(value.result);
      if (typeof value.hyperlink === "string") return value.hyperlink;
      return null;
    }
    return value;
  }

  excelText(value) {
    const primitive = this.excelPrimitive(value);
    if (primitive === null || primitive === undefined) return "";
    if (primitive instanceof Date) return primitive.toISOString().slice(0, 10);
    return String(primitive).trim();
  }

  excelNum(value) {
    const primitive = this.excelPrimitive(value);
    if (typeof primitive === "number" && Number.isFinite(primitive)) return primitive;
    if (primitive instanceof Date) return NaN;
    const s = String(primitive ?? "").replace(/\s+/g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  excelFormula(value) {
    return value && typeof value === "object" && typeof value.formula === "string" ? value.formula : "";
  }

  normalizeCoeff(value) {
    const n = this._state.num(value, 0);
    return n > 3 && n <= 300 ? n / 100 : n;
  }

  escapeReg(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
