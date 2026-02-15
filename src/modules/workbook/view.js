export class WorkbookViewModule {
  constructor({ app, dom, esc }) {
    if (!app) throw new Error("WorkbookViewModule requires app");
    if (!dom) throw new Error("WorkbookViewModule requires dom");
    if (typeof esc !== "function") throw new Error("WorkbookViewModule requires esc()");
    this._app = app;
    this._dom = dom;
    this._esc = esc;
  }

  activeSheet() {
    return this._app.workbook?.byId?.[this._app.ui.activeSheetId] || null;
  }

  currentZoom(sheet) {
    return this._app.ui.zoomBySheet[sheet.id] || sheet.zoom || 1;
  }

  renderTabs() {
    this._dom.tabs.innerHTML = this._app.workbook.sheets
      .map((s) => `<button class="sheet-tab ${s.id === this._app.ui.activeSheetId ? "active" : ""}" data-sheet="${this._esc(s.id)}">${this._esc(s.name)}</button>`)
      .join("");
  }
}
