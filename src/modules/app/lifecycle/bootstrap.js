export class AppBootstrapModule {
  constructor({
    app,
    templateApi,
    projectStateApi,
    loadAiSettings,
    applySidebarWidth,
    bindEvents,
    renderAll,
    renderAiUi,
    toast,
  }) {
    if (!app) throw new Error("AppBootstrapModule requires app");
    if (!templateApi || typeof templateApi.loadTemplate !== "function") throw new Error("AppBootstrapModule requires templateApi.loadTemplate()");
    if (!projectStateApi || typeof projectStateApi.createDefaultState !== "function") throw new Error("AppBootstrapModule requires projectStateApi.createDefaultState()");
    if (typeof loadAiSettings !== "function") throw new Error("AppBootstrapModule requires loadAiSettings()");
    if (typeof applySidebarWidth !== "function") throw new Error("AppBootstrapModule requires applySidebarWidth()");
    if (typeof bindEvents !== "function") throw new Error("AppBootstrapModule requires bindEvents()");
    if (typeof renderAll !== "function") throw new Error("AppBootstrapModule requires renderAll()");
    if (typeof renderAiUi !== "function") throw new Error("AppBootstrapModule requires renderAiUi()");
    if (typeof toast !== "function") throw new Error("AppBootstrapModule requires toast()");

    this._app = app;
    this._templateApi = templateApi;
    this._projectStateApi = projectStateApi;
    this._loadAiSettings = loadAiSettings;
    this._applySidebarWidth = applySidebarWidth;
    this._bindEvents = bindEvents;
    this._renderAll = renderAll;
    this._renderAiUi = renderAiUi;
    this._toast = toast;
  }

  async start({ templatePath, stylePath }) {
    this._app.template = await this._templateApi.loadTemplate(templatePath, stylePath);
    this._app.state = this._projectStateApi.createDefaultState();
    this._loadAiSettings();
    this._applySidebarWidth(this._app.ui.sidebarWidth, false);
    this._bindEvents();
    this._renderAll();
    this._renderAiUi();
    this._toast("Шаблон КП готов");
  }
}
