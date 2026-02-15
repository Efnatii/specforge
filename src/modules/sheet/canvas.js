export class SheetCanvasModule {
  constructor({ dom, documentRef, decodeAddr }) {
    if (!dom) throw new Error("SheetCanvasModule requires dom");
    if (!documentRef) throw new Error("SheetCanvasModule requires documentRef");
    if (typeof decodeAddr !== "function") throw new Error("SheetCanvasModule requires decodeAddr()");
    this._dom = dom;
    this._document = documentRef;
    this._decodeAddr = decodeAddr;
  }

  renderSheet({ sheet, zoom, templateStyles }) {
    if (!sheet) return false;
    if (!this._dom.canvas) return false;

    this._dom.canvas.style.setProperty("--sheet-zoom", String(zoom || 1));

    const h = this._document.createElement("h2");
    h.className = "sheet-title";
    h.textContent = sheet.name;

    const t = this._document.createElement("table");
    t.className = "sheet-table";

    const cg = this._document.createElement("colgroup");
    for (const w of sheet.cols) {
      const c = this._document.createElement("col");
      c.style.width = `${w}px`;
      cg.appendChild(c);
    }
    t.appendChild(cg);

    const merge = this._buildMergeMeta(sheet.merges);
    const body = this._document.createElement("tbody");

    for (let ri = 1; ri <= sheet.rows.length; ri += 1) {
      const row = sheet.rows[ri - 1];
      const tr = this._document.createElement("tr");
      tr.style.height = `${row.height}px`;

      for (let ci = 1; ci <= sheet.cols.length; ci += 1) {
        const key = `${ri}:${ci}`;
        if (merge.skip.has(key)) continue;

        const cell = row.cells[ci - 1];
        const td = this._document.createElement("td");
        td.className = `cell s-${cell.styleId}`;
        td.dataset.row = String(ri);
        td.dataset.col = String(ci);

        const style = templateStyles[cell.styleId];
        if (style?.align?.wrap) td.classList.add("wrap");

        const merged = merge.start.get(key);
        if (merged) {
          td.rowSpan = merged.rs;
          td.colSpan = merged.cs;
        }

        td.textContent = this.cellText(cell, style);
        if (cell.formula) td.title = cell.formula;
        tr.appendChild(td);
      }

      body.appendChild(tr);
    }

    t.appendChild(body);
    this._dom.canvas.innerHTML = "";
    this._dom.canvas.appendChild(h);
    this._dom.canvas.appendChild(t);
    return true;
  }

  cellText(cell, style) {
    if (cell.value === null || cell.value === undefined || cell.value === "") return "";
    if (typeof cell.value !== "number") return String(cell.value);

    const id = style?.numFmtId || 0;
    const code = style?.numFmtCode || "";

    if (id === 9 || id === 10 || code.includes("%")) {
      const d = id === 9 ? 0 : 2;
      return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).format(cell.value * 100)}%`;
    }

    if (id === 2) return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cell.value);

    if (code.includes("₽") || code.includes("р.") || id === 165 || id === 166 || id === 164) {
      const d = id === 164 ? 0 : 2;
      return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).format(cell.value)} ₽`;
    }

    if (Number.isInteger(cell.value)) return new Intl.NumberFormat("ru-RU").format(cell.value);
    return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cell.value);
  }

  _buildMergeMeta(merges) {
    const start = new Map();
    const skip = new Set();
    for (const r of merges || []) {
      const [a, b] = r.split(":");
      if (!a || !b) continue;
      const s = this._decodeAddr(a);
      const e = this._decodeAddr(b);
      start.set(`${s.row}:${s.col}`, { rs: e.row - s.row + 1, cs: e.col - s.col + 1 });
      for (let i = s.row; i <= e.row; i += 1) {
        for (let j = s.col; j <= e.col; j += 1) {
          if (i === s.row && j === s.col) continue;
          skip.add(`${i}:${j}`);
        }
      }
    }
    return { start, skip };
  }
}
