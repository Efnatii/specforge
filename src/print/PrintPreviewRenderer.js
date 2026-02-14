import { DisplayValueService } from "../format/DisplayValueService.js";
import { NumFmtService } from "../format/NumFmtService.js";

export class PrintPreviewRenderer {
  constructor() {
    this.display = new DisplayValueService();
    this.numFmt = new NumFmtService();
  }

  renderDocument({ sheets, cssText }) {
    const body = sheets.map((sheet) => sheet.html).join("\n");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>${cssText}</style>
</head>
<body>${body}</body>
</html>`;
  }

  renderSheet({ sheetSnapshot, sheetEdits, calcSheet, pageSetup }) {
    const cells = new Map();
    let maxRow = 1;
    let maxCol = 1;

    for (const row of sheetSnapshot.rows || []) {
      maxRow = Math.max(maxRow, row.index);
      for (const cell of row.cells || []) {
        cells.set(cell.address, cell);
        maxCol = Math.max(maxCol, cell.c);
      }
    }

    for (const col of sheetSnapshot.cols || []) {
      maxCol = Math.max(maxCol, col.index);
    }

    const rowsHtml = [];
    for (let r = 1; r <= maxRow; r += 1) {
      const cols = [];
      for (let c = 1; c <= maxCol; c += 1) {
        const address = this.toA1(r, c);
        const baselineCell = cells.get(address) || null;
        const overlayEdit = sheetEdits?.[address] || null;
        const calcResult = calcSheet?.[address] || null;

        const display = this.display.getDisplay({
          sheetName: sheetSnapshot.name,
          addressA1: address,
          baselineCell,
          overlayEdit,
          calcResult
        });

        const formatted = this.numFmt.format({
          value: display.raw,
          numFmt: baselineCell?.numFmt,
          fallbackType: typeof display.raw,
          sheetName: sheetSnapshot.name,
          addressA1: address
        });

        cols.push(`<td>${this.escape(formatted.text)}</td>`);
      }
      rowsHtml.push(`<tr>${cols.join("")}</tr>`);
    }

    const pageClass = `sheet page-${pageSetup.orientation}`;
    return {
      html: `<section class="${pageClass}"><h2>${this.escape(sheetSnapshot.name)}</h2><table>${rowsHtml.join("")}</table><div class="page-break"></div></section>`
    };
  }

  buildPrintCss(pageSetup, useSheetPageSetup) {
    const size = `${pageSetup.paper.widthMm}mm ${pageSetup.paper.heightMm}mm`;
    const orientation = pageSetup.orientation;
    const margins = pageSetup.margins;
    const scale = useSheetPageSetup && pageSetup.scale.mode === "scale"
      ? `transform: scale(${(pageSetup.scale.scalePercent || 100) / 100}); transform-origin: top left;`
      : "";

    return `
@page { size: ${size} ${orientation}; margin: ${margins.topMm}mm ${margins.rightMm}mm ${margins.bottomMm}mm ${margins.leftMm}mm; }
body { font-family: Arial, sans-serif; color:#222; }
.sheet { break-after: page; }
table { border-collapse: collapse; width: 100%; ${scale} }
td { border: 1px solid #cfcfcf; font-size: 11px; padding: 2px 4px; white-space: pre-wrap; }
h2 { font-size: 14px; margin: 0 0 6px 0; }
.page-break { break-after: page; }
`;
  }

  toA1(row, col) {
    let c = col;
    let letters = "";
    while (c > 0) {
      const rem = (c - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      c = Math.floor((c - 1) / 26);
    }
    return `${letters}${row}`;
  }

  escape(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
