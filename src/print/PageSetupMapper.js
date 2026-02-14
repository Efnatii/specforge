const PAPER_MAP = {
  9: { name: "A4", widthMm: 210, heightMm: 297 },
  1: { name: "Letter", widthMm: 216, heightMm: 279 }
};

export class PageSetupMapper {
  fromWorksheet(worksheet) {
    const page = worksheet?.pageSetup || {};
    const paper = PAPER_MAP[Number(page.paperSize)] || PAPER_MAP[9];

    const marginsIn = page.margins || {};
    const margins = {
      topMm: this.inchesToMm(marginsIn.top ?? 0.39),
      rightMm: this.inchesToMm(marginsIn.right ?? 0.39),
      bottomMm: this.inchesToMm(marginsIn.bottom ?? 0.39),
      leftMm: this.inchesToMm(marginsIn.left ?? 0.39)
    };

    const fitToPage = Boolean(page.fitToPage);
    const fitToWidth = Number.isFinite(page.fitToWidth) ? page.fitToWidth : null;
    const fitToHeight = Number.isFinite(page.fitToHeight) ? page.fitToHeight : null;
    const scalePercent = Number.isFinite(page.scale) ? page.scale : 100;

    const scale = fitToPage && (fitToWidth || fitToHeight)
      ? { mode: "fit", fitToWidth: fitToWidth || 1, fitToHeight: fitToHeight || 1, scalePercent: null }
      : { mode: "scale", fitToWidth: null, fitToHeight: null, scalePercent };

    return {
      paper,
      orientation: page.orientation === "landscape" ? "landscape" : "portrait",
      margins,
      scale,
      printArea: page.printArea || null,
      showGridLines: Boolean(page.showGridLines),
      showHeadings: Boolean(page.showRowColHeaders)
    };
  }

  inchesToMm(value) {
    return Number((Number(value) * 25.4).toFixed(2));
  }
}
