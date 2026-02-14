import ExcelJS from "exceljs/dist/exceljs.min.js";
import { PageSetupMapper } from "./PageSetupMapper.js";
import { PrintTemplates } from "./PrintTemplates.js";
import { PrintPreviewRenderer } from "./PrintPreviewRenderer.js";

export class PrintService {
  constructor({ printPreviewDialog }) {
    this.mapper = new PageSetupMapper();
    this.templates = PrintTemplates;
    this.renderer = new PrintPreviewRenderer();
    this.dialog = printPreviewDialog;
  }

  openDialog(payload) {
    return this.dialog.open(payload);
  }

  async buildPrintDoc({ baselineBuffer, workbookSnapshot, edits, calcSnapshot, templateId, selectedAbbr, useSheetPageSetup, signal, reportProgress }) {
    this.assertNotAborted(signal);
    reportProgress?.({ completed: 0, total: 4, message: "Load baseline workbook" });

    const baselineWb = new ExcelJS.Workbook();
    await baselineWb.xlsx.load(baselineBuffer);

    this.assertNotAborted(signal);
    reportProgress?.({ completed: 1, total: 4, message: "Resolve print template" });

    const resolved = this.templates.resolve({
      templateId,
      workbookSnapshot,
      selectedAbbr
    });

    const sheetsHtml = [];
    for (const name of resolved.sheetNames) {
      const snapshotSheet = workbookSnapshot.sheets.find((sheet) => sheet.name === name);
      const worksheet = baselineWb.getWorksheet(name);
      if (!snapshotSheet || !worksheet) {
        continue;
      }

      const sheetEdits = edits[snapshotSheet.id] || {};
      const calcSheet = calcSnapshot?.perSheet?.[name] || {};
      const pageSetup = this.mapper.fromWorksheet(worksheet);
      const rendered = this.renderer.renderSheet({
        sheetSnapshot: snapshotSheet,
        sheetEdits,
        calcSheet,
        pageSetup
      });
      sheetsHtml.push({ name, html: rendered.html, pageSetup });
    }

    this.assertNotAborted(signal);
    reportProgress?.({ completed: 2, total: 4, message: "Render printable HTML" });

    const setup = sheetsHtml[0]?.pageSetup || {
      paper: { widthMm: 210, heightMm: 297 },
      orientation: "portrait",
      margins: { topMm: 10, rightMm: 10, bottomMm: 10, leftMm: 10 },
      scale: { mode: "scale", scalePercent: 100 }
    };

    const cssText = this.renderer.buildPrintCss(setup, useSheetPageSetup !== false);
    const htmlString = this.renderer.renderDocument({ sheets: sheetsHtml, cssText });

    this.assertNotAborted(signal);
    reportProgress?.({ completed: 3, total: 4, message: "Document ready" });

    return {
      htmlString,
      sheetNames: resolved.sheetNames,
      pageSetup: setup
    };
  }

  preview(root, htmlString) {
    this.dialog.showHtmlPreview(root, htmlString);
  }

  print(htmlString) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "-10000px";
    iframe.style.bottom = "-10000px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);

    const onLoad = () => {
      const win = iframe.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }

      setTimeout(() => iframe.remove(), 1500);
    };

    iframe.onload = onLoad;
    iframe.srcdoc = htmlString;
  }

  assertNotAborted(signal) {
    if (signal?.aborted) {
      throw new Error("Job aborted");
    }
  }
}
