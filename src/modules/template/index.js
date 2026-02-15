export class TemplateModule {
  constructor({ fetchFn, documentRef, sheetNames, math }) {
    if (typeof fetchFn !== "function") throw new Error("TemplateModule requires fetchFn()");
    if (!documentRef) throw new Error("TemplateModule requires documentRef");
    if (!sheetNames) throw new Error("TemplateModule requires sheetNames");
    if (!math) throw new Error("TemplateModule requires math helpers");

    this._fetch = fetchFn;
    this._document = documentRef;
    this._sheetNames = sheetNames;
    this._math = math;
  }

  async loadTemplate(reportUrl, stylesUrl) {
    const [reportRes, stylesRes] = await Promise.all([
      this._fetch(reportUrl),
      this._fetch(stylesUrl),
    ]);

    if (!reportRes.ok || !stylesRes.ok) throw new Error("template load failed");

    const [report, stylesRaw] = await Promise.all([reportRes.json(), stylesRes.json()]);
    const template = this.parseTemplate(report, stylesRaw);
    this.injectStyles(template.styles);
    return template;
  }

  parseTemplate(report, stylesRaw) {
    const styles = {};
    for (const style of stylesRaw.styles) styles[style.id] = this._normalizeStyle(style);

    const sheets = {
      summary: this._normalizeSheet(report[this._sheetNames.summary]),
      main: this._normalizeSheet(report[this._sheetNames.main]),
      consumable: this._normalizeSheet(report[this._sheetNames.consumable]),
      projectConsumable: this._normalizeSheet(report[this._sheetNames.projectConsumable]),
    };

    return { styles, sheets };
  }

  injectStyles(styles) {
    const el = this._document.createElement("style");
    el.id = "sheet-style-map";

    const lines = [];
    for (const [id, style] of Object.entries(styles)) {
      const css = [];
      css.push(`font-family:'${String(style.font.name).replaceAll("'", "\\'")}', 'Times New Roman', serif`);
      css.push(`font-size:${style.font.size}px`);
      css.push(`font-weight:${style.font.bold ? 700 : 400}`);
      css.push(`font-style:${style.font.italic ? "italic" : "normal"}`);
      css.push(`color:${style.font.color}`);
      css.push(`text-align:${style.align.h}`);
      css.push(`vertical-align:${style.align.v}`);
      css.push(`white-space:${style.align.wrap ? "pre-line" : "nowrap"}`);
      css.push(`background:${style.fill.type === "solid" ? style.fill.color : "transparent"}`);

      for (const side of ["left", "right", "top", "bottom"]) {
        const border = style.border[side];
        css.push(`border-${side}:${border ? `1px solid ${border.color}` : "none"}`);
      }

      lines.push(`.cell.s-${id}{${css.join(";")}}`);
    }

    el.textContent = lines.join("\n");
    this._document.head.appendChild(el);
  }

  decodeAddr(addr) {
    const match = /^([A-Z]+)(\d+)$/i.exec(addr);
    if (!match) return { row: 1, col: 1 };

    let col = 0;
    for (const ch of match[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
    return { row: Number(match[2]), col };
  }

  expandCols(meta, maxCol) {
    const arr = new Array(maxCol).fill(8.43);
    for (const colMeta of meta || []) {
      const min = Number(colMeta.min || 1);
      const max = Number(colMeta.max || min);
      const width = this._math.num(colMeta.width, 8.43);
      for (let idx = min; idx <= max; idx += 1) arr[idx - 1] = width;
    }
    return arr;
  }

  excelWToPx(width) {
    return Math.max(20, Math.floor(this._math.num(width, 8.43) * 7 + 5));
  }

  pxToExcelW(px) {
    return Math.max(1, (this._math.num(px, 64) - 5) / 7);
  }

  ptToPx(pt) {
    return Math.round(this._math.num(pt, 14.4) * (96 / 72));
  }

  pxToPt(px) {
    return this._math.num(px, 19) * (72 / 96);
  }

  _normalizeSheet(raw) {
    const maxCol = raw.maxCol;
    const cols = this.expandCols(raw.cols, maxCol).map((w) => this.excelWToPx(w));
    const rowStyles = {};
    const rowValues = {};

    for (const cell of raw.cells) {
      const { row, col } = this.decodeAddr(cell.a);
      if (!rowStyles[row]) rowStyles[row] = new Array(maxCol).fill(0);
      if (!rowValues[row]) rowValues[row] = {};
      rowStyles[row][col - 1] = Number(cell.s || 0);
      if (cell.v !== null && cell.v !== undefined) rowValues[row][col] = this._math.normalizeCellValue(cell.v);
    }

    const rowHeights = {};
    for (const [rowId, pt] of Object.entries(raw.rowHeights || {})) {
      rowHeights[Number(rowId)] = this.ptToPx(Number(pt));
    }

    return {
      maxCol,
      cols,
      merges: raw.merges || [],
      rowStyles,
      rowValues,
      rowHeights,
      defaultRowHeight: this.ptToPx(Number(raw.defaultRowHeight || 14.4)),
      view: {
        xSplit: raw.view?.xSplit || 0,
        ySplit: raw.view?.ySplit || 0,
        zoom: (raw.view?.zoomScale || 100) / 100,
      },
    };
  }

  _normalizeStyle(styleRaw) {
    const font = styleRaw.font || {};
    const fill = styleRaw.fill || {};
    const align = styleRaw.alignment || {};
    const border = styleRaw.border || {};

    return {
      id: styleRaw.id,
      numFmtId: Number(styleRaw.numFmtId || 0),
      numFmtCode: styleRaw.numFmtCode ? String(styleRaw.numFmtCode).replaceAll("\\\\", "\\") : "",
      font: {
        name: font.name || "Times New Roman",
        size: Number(font.size || 8),
        bold: Boolean(font.bold),
        italic: Boolean(font.italic),
        color: this._colorRef(font.color) || "#000000",
      },
      fill: {
        type: fill.patternType || "none",
        color: fill.patternType === "solid" ? (this._colorRef(fill.fgColor || fill.bgColor) || "#ffffff") : null,
      },
      align: {
        h: align.horizontal || "left",
        v: align.vertical || "middle",
        wrap: align.wrapText === "1",
      },
      border: {
        left: this._normBorder(border.left),
        right: this._normBorder(border.right),
        top: this._normBorder(border.top),
        bottom: this._normBorder(border.bottom),
      },
    };
  }

  _normBorder(side) {
    if (!side || !side.style) return null;
    return { style: side.style, color: this._colorRef(side.color) || "#000" };
  }

  _colorRef(color) {
    if (!color) return null;
    if (color.rgb) return `#${String(color.rgb).slice(-6).toLowerCase()}`;
    if (color.theme !== undefined) {
      const theme = Number(color.theme);
      return ({ 0: "#ffffff", 1: "#000000", 2: "#eeece1", 3: "#1f497d" })[theme] || "#000000";
    }
    if (color.indexed !== undefined) return Number(color.indexed) === 65 ? "#d9d9d9" : "#000000";
    return "#000000";
  }
}
