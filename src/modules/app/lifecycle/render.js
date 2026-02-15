export class AppRenderModule {
  constructor({
    app,
    workbookApi,
    applyAgentSheetOverrides,
    workbookViewApi,
    sheetCanvasApi,
    projectSheetSelectionApi,
    projectSidebarApi,
    renderAiUi,
  }) {
    if (!app) throw new Error("AppRenderModule requires app");
    if (!workbookApi || typeof workbookApi.buildWorkbook !== "function") throw new Error("AppRenderModule requires workbookApi.buildWorkbook()");
    if (typeof applyAgentSheetOverrides !== "function") throw new Error("AppRenderModule requires applyAgentSheetOverrides()");
    if (!workbookViewApi) throw new Error("AppRenderModule requires workbookViewApi");
    if (typeof workbookViewApi.renderTabs !== "function") throw new Error("AppRenderModule requires workbookViewApi.renderTabs()");
    if (typeof workbookViewApi.activeSheet !== "function") throw new Error("AppRenderModule requires workbookViewApi.activeSheet()");
    if (typeof workbookViewApi.currentZoom !== "function") throw new Error("AppRenderModule requires workbookViewApi.currentZoom()");
    if (!sheetCanvasApi || typeof sheetCanvasApi.renderSheet !== "function") throw new Error("AppRenderModule requires sheetCanvasApi.renderSheet()");
    if (!projectSheetSelectionApi || typeof projectSheetSelectionApi.paintSelection !== "function") throw new Error("AppRenderModule requires projectSheetSelectionApi.paintSelection()");
    if (!projectSidebarApi) throw new Error("AppRenderModule requires projectSidebarApi");
    if (typeof projectSidebarApi.renderTree !== "function") throw new Error("AppRenderModule requires projectSidebarApi.renderTree()");
    if (typeof projectSidebarApi.renderInspector !== "function") throw new Error("AppRenderModule requires projectSidebarApi.renderInspector()");
    if (typeof renderAiUi !== "function") throw new Error("AppRenderModule requires renderAiUi()");

    this._app = app;
    this._workbookApi = workbookApi;
    this._applyAgentSheetOverrides = applyAgentSheetOverrides;
    this._workbookViewApi = workbookViewApi;
    this._sheetCanvasApi = sheetCanvasApi;
    this._projectSheetSelectionApi = projectSheetSelectionApi;
    this._projectSidebarApi = projectSidebarApi;
    this._renderAiUi = renderAiUi;
  }

  renderAll() {
    this._app.workbook = this._workbookApi.buildWorkbook({ state: this._app.state, template: this._app.template });
    this._applyAgentSheetOverrides();
    if (!this._app.workbook.byId[this._app.ui.activeSheetId]) this._app.ui.activeSheetId = "summary";
    this._workbookViewApi.renderTabs();
    this.renderSheet();
    this._projectSidebarApi.renderTree();
    this._projectSidebarApi.renderInspector();
    this._renderAiUi();
  }

  renderSheet() {
    const sheet = this._workbookViewApi.activeSheet();
    if (!sheet) return;
    this._sheetCanvasApi.renderSheet({
      sheet,
      zoom: this._workbookViewApi.currentZoom(sheet),
      templateStyles: this._app.template.styles,
    });
    this._projectSheetSelectionApi.paintSelection();
  }
}
