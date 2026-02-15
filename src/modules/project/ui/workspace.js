export class ProjectWorkspaceModule {
  constructor({
    app,
    dom,
    projectStateApi,
    projectFileApi,
    addChangesJournal,
    toast,
    renderAll,
    currentZoom,
    clampSidebarWidth,
    applySidebarWidth,
    saveSidebarWidth,
    normalizeSheetValue,
    devLabel,
    windowRef,
    documentRef,
  }) {
    if (!app) throw new Error("ProjectWorkspaceModule requires app");
    if (!dom) throw new Error("ProjectWorkspaceModule requires dom");
    if (!projectStateApi) throw new Error("ProjectWorkspaceModule requires projectStateApi");
    if (!projectFileApi) throw new Error("ProjectWorkspaceModule requires projectFileApi");
    if (typeof addChangesJournal !== "function") throw new Error("ProjectWorkspaceModule requires addChangesJournal()");
    if (typeof toast !== "function") throw new Error("ProjectWorkspaceModule requires toast()");
    if (typeof renderAll !== "function") throw new Error("ProjectWorkspaceModule requires renderAll()");
    if (typeof currentZoom !== "function") throw new Error("ProjectWorkspaceModule requires currentZoom()");
    if (typeof clampSidebarWidth !== "function") throw new Error("ProjectWorkspaceModule requires clampSidebarWidth()");
    if (typeof applySidebarWidth !== "function") throw new Error("ProjectWorkspaceModule requires applySidebarWidth()");
    if (typeof saveSidebarWidth !== "function") throw new Error("ProjectWorkspaceModule requires saveSidebarWidth()");
    if (typeof normalizeSheetValue !== "function") throw new Error("ProjectWorkspaceModule requires normalizeSheetValue()");
    if (!devLabel) throw new Error("ProjectWorkspaceModule requires devLabel");
    if (!windowRef) throw new Error("ProjectWorkspaceModule requires windowRef");
    if (!documentRef) throw new Error("ProjectWorkspaceModule requires documentRef");

    this._app = app;
    this._dom = dom;
    this._projectStateApi = projectStateApi;
    this._projectFileApi = projectFileApi;
    this._addChangesJournal = addChangesJournal;
    this._toast = toast;
    this._renderAll = renderAll;
    this._currentZoom = currentZoom;
    this._clampSidebarWidth = clampSidebarWidth;
    this._applySidebarWidth = applySidebarWidth;
    this._saveSidebarWidth = saveSidebarWidth;
    this._normalizeSheetValue = normalizeSheetValue;
    this._devLabel = devLabel;
    this._window = windowRef;
    this._document = documentRef;
  }

  onSidebarResizePointerDown(e) {
    if (this._app.ui.sidebarCollapsed) return;
    this._app.ui.sidebarResizing = true;
    this._app.ui.sidebarResizePointerId = e.pointerId;
    this._app.ui.sidebarResizeStartX = e.clientX;
    this._app.ui.sidebarResizeStartWidth = this._clampSidebarWidth(this._app.ui.sidebarWidth || this._dom.sidebar?.getBoundingClientRect()?.width || 360);
    this._dom.sidebarResizeHandle?.setPointerCapture?.(e.pointerId);
    this._document.body.classList.add("sidebar-resizing");
    e.preventDefault();
  }

  onSidebarResizePointerMove(e) {
    if (!this._app.ui.sidebarResizing) return;
    const delta = e.clientX - this._projectStateApi.num(this._app.ui.sidebarResizeStartX, 0);
    const nextWidth = this._projectStateApi.num(this._app.ui.sidebarResizeStartWidth, 360) + delta;
    this._applySidebarWidth(nextWidth, false);
  }

  onSidebarResizePointerUp(e) {
    if (!this._app.ui.sidebarResizing) return;
    if (this._app.ui.sidebarResizePointerId !== undefined && e.pointerId !== undefined && e.pointerId !== this._app.ui.sidebarResizePointerId) return;
    this._app.ui.sidebarResizing = false;
    this._app.ui.sidebarResizePointerId = undefined;
    this._app.ui.sidebarResizeStartX = undefined;
    this._app.ui.sidebarResizeStartWidth = undefined;
    this._dom.sidebarResizeHandle?.releasePointerCapture?.(e.pointerId);
    this._document.body.classList.remove("sidebar-resizing");
    this._saveSidebarWidth();
  }

  openSettingsDialog() {
    const settings = this._app.state.settings;
    this._dom.settingOrder.value = settings.orderNumber;
    this._dom.settingRequest.value = settings.requestNumber;
    this._dom.settingDate.value = settings.changeDate;
    this._dom.settingVersion.value = settings.version || "";
    this._dom.settingVat.value = this._projectStateApi.decToPct(settings.vatRate);
    this._dom.settingMode.value = settings.totalMode;
    this._dom.settingsDialog.showModal();
  }

  applySettingsForm() {
    this._app.state.settings.orderNumber = this._dom.settingOrder.value.trim();
    this._app.state.settings.requestNumber = this._dom.settingRequest.value.trim();
    this._app.state.settings.changeDate = this._dom.settingDate.value;
    this._app.state.settings.version = this._dom.settingVersion.value.trim();
    this._app.state.settings.vatRate = this._projectStateApi.pctToDec(this._dom.settingVat.value);
    this._app.state.settings.totalMode = this._dom.settingMode.value === "withDiscount" ? "withDiscount" : "withoutDiscount";
    this._addChangesJournal("settings.update", "dialog apply");
  }

  exportJson() {
    const payload = this._projectFileApi.buildExportPayload({
      state: this._app.state,
      sheetOverrides: this._app.ai.sheetOverrides,
      developer: this._devLabel,
    });
    this._download(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `${this._projectFileApi.buildExportName(this._app.state.settings)}.json`,
    );
    this._toast("JSON экспортирован");
  }

  async importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = String(file.name || "").toLowerCase();
    try {
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xlsm")) {
        const imported = await this._projectFileApi.importExcelState({
          arrayBuffer: await file.arrayBuffer(),
          excelJs: this._window.ExcelJS,
        });
        this._app.state = this._normalizeState(imported);
        this._app.ai.sheetOverrides = {};
        this._addChangesJournal("import.xlsx", file.name);
        this._toast("Excel импортирован");
      } else {
        const { stateRaw, sheetOverridesRaw } = this._projectFileApi.parseImportedJsonText(await file.text());
        this._app.state = this._normalizeState(stateRaw);
        this._app.ai.sheetOverrides = this._normalizeSheetOverrides(sheetOverridesRaw);
        this._addChangesJournal("import.json", file.name);
        this._toast("JSON импортирован");
      }
      this._app.ui.treeSel = { type: "settings" };
      this._app.ui.activeSheetId = "summary";
      this._app.ui.selection = null;
      this._renderAll();
    } catch (err) {
      console.error(err);
      this._toast("Ошибка импорта файла");
    } finally {
      this._dom.importFile.value = "";
    }
  }

  async exportXlsx() {
    if (!this._window.ExcelJS) {
      this._toast("ExcelJS не загружен");
      return;
    }

    try {
      const buf = await this._projectFileApi.buildXlsxBuffer({
        excelJs: this._window.ExcelJS,
        workbook: this._app.workbook,
        templateStyles: this._app.template.styles,
        creator: this._devLabel,
        zoomResolver: (sheet) => this._currentZoom(sheet),
      });
      this._download(
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `${this._projectFileApi.buildExportName(this._app.state.settings)}.xlsx`,
      );
      this._toast("XLSX экспортирован");
    } catch (err) {
      console.error(err);
      this._toast("Ошибка экспорта XLSX");
    }
  }

  _normalizeState(raw) {
    return this._projectStateApi.normalizeState(raw);
  }

  _normalizeSheetOverrides(raw) {
    return this._projectStateApi.normalizeSheetOverrides(raw, this._normalizeSheetValue);
  }

  _download(blob, name) {
    const u = URL.createObjectURL(blob);
    const a = this._document.createElement("a");
    a.href = u;
    a.download = name;
    this._document.body.appendChild(a);
    a.click();
    this._document.body.removeChild(a);
    URL.revokeObjectURL(u);
  }
}
