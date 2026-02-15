export class ProjectSheetSelectionModule {
  constructor({ app, dom, documentRef, activeSheet, cellText }) {
    if (!app) throw new Error("ProjectSheetSelectionModule requires app");
    if (!dom) throw new Error("ProjectSheetSelectionModule requires dom");
    if (!documentRef) throw new Error("ProjectSheetSelectionModule requires documentRef");
    if (typeof activeSheet !== "function") throw new Error("ProjectSheetSelectionModule requires activeSheet()");
    if (typeof cellText !== "function") throw new Error("ProjectSheetSelectionModule requires cellText()");

    this._app = app;
    this._dom = dom;
    this._document = documentRef;
    this._activeSheet = activeSheet;
    this._cellText = cellText;
  }

  onViewportMouseDown(e) {
    this._dom.viewport.focus();

    if (e.button === 2) {
      this._app.ui.panning = true;
      this._app.ui.pan = {
        x: e.clientX,
        y: e.clientY,
        left: this._dom.viewport.scrollLeft,
        top: this._dom.viewport.scrollTop,
      };
      this._dom.viewport.classList.add("is-panning");
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;
    const td = e.target.closest("td[data-row][data-col]");
    if (!td) return;

    const sheet = this._activeSheet();
    if (!sheet) return;

    this._app.ui.selecting = true;
    this._app.ui.selection = {
      sheet: sheet.id,
      sr: Number(td.dataset.row),
      sc: Number(td.dataset.col),
      er: Number(td.dataset.row),
      ec: Number(td.dataset.col),
    };

    this.paintSelection();
    e.preventDefault();
  }

  onViewportMouseMove(e) {
    if (this._app.ui.panning && this._app.ui.pan) {
      this._dom.viewport.scrollLeft = this._app.ui.pan.left - (e.clientX - this._app.ui.pan.x);
      this._dom.viewport.scrollTop = this._app.ui.pan.top - (e.clientY - this._app.ui.pan.y);
      return;
    }

    if (!this._app.ui.selecting || !this._app.ui.selection) return;
    const target = this._document.elementFromPoint(e.clientX, e.clientY);
    const td = target && target.closest ? target.closest("td[data-row][data-col]") : null;
    if (!td) return;

    this._app.ui.selection.er = Number(td.dataset.row);
    this._app.ui.selection.ec = Number(td.dataset.col);
    this.paintSelection();
  }

  onViewportMouseUp(e) {
    if (e.button === 2) {
      this._app.ui.panning = false;
      this._app.ui.pan = null;
      this._dom.viewport.classList.remove("is-panning");
      return;
    }
    if (e.button === 0) this._app.ui.selecting = false;
  }

  onDocumentMouseDown(e) {
    if (e.button !== 0) return;
    const inCell = e.target.closest && e.target.closest("#sheetCanvas td[data-row][data-col]");
    const inToolbar = e.target.closest && e.target.closest(".toolbar");
    const inSidebar = e.target.closest && e.target.closest(".sidebar");
    const inAgent = e.target.closest && e.target.closest("#agentOverlay");
    if (!inCell && !inToolbar && !inSidebar && !inAgent) this.clearSelection();
  }

  clearSelection() {
    if (!this._app.ui.selection) return;
    this._app.ui.selection = null;
    this.paintSelection();
  }

  editableFocus() {
    const el = this._document.activeElement;
    if (!el) return false;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    return Boolean(el.isContentEditable);
  }

  paintSelection() {
    this._dom.canvas.querySelectorAll("td.selected").forEach((cell) => cell.classList.remove("selected"));
    const sheet = this._activeSheet();
    const sel = this._app.ui.selection;
    if (!sheet || !sel || sel.sheet !== sheet.id) return;

    const r1 = Math.min(sel.sr, sel.er);
    const r2 = Math.max(sel.sr, sel.er);
    const c1 = Math.min(sel.sc, sel.ec);
    const c2 = Math.max(sel.sc, sel.ec);

    for (let r = r1; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) {
        const td = this._dom.canvas.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
        if (td) td.classList.add("selected");
      }
    }
  }

  selectionText(sheet, sel) {
    const r1 = Math.min(sel.sr, sel.er);
    const r2 = Math.max(sel.sr, sel.er);
    const c1 = Math.min(sel.sc, sel.ec);
    const c2 = Math.max(sel.sc, sel.ec);
    const lines = [];

    for (let r = r1; r <= r2; r += 1) {
      const vals = [];
      for (let c = c1; c <= c2; c += 1) {
        const cell = sheet.rows[r - 1]?.cells[c - 1];
        const style = cell ? this._app.template.styles[cell.styleId] : null;
        vals.push(cell ? this._cellText(cell, style) : "");
      }
      lines.push(vals.join("\t"));
    }

    return lines.join("\n");
  }
}
