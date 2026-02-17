import { ProjectSheetSelectionModule } from "../../project/ui/sheet-selection.js";
import { ProjectWorkspaceModule } from "../../project/ui/workspace.js";
import { ProjectSidebarModule } from "../../project/ui/sidebar.js";
import { ProjectUiActionModule } from "../../project/ui/actions.js";
import { OpenAiAuthModule } from "../ui/openai-auth.js";

export class AppUiBaseCompositionModule {
  constructor({
    dom,
    config,
    windowRef,
    documentRef,
    fetchFn,
  }) {
    if (!dom) throw new Error("AppUiBaseCompositionModule requires dom");
    if (!config) throw new Error("AppUiBaseCompositionModule requires config");
    if (!windowRef) throw new Error("AppUiBaseCompositionModule requires windowRef");
    if (!documentRef) throw new Error("AppUiBaseCompositionModule requires documentRef");
    if (typeof fetchFn !== "function") throw new Error("AppUiBaseCompositionModule requires fetchFn()");

    this._dom = dom;
    this._config = config;
    this._window = windowRef;
    this._document = documentRef;
    this._fetch = fetchFn;
  }

  compose({ core, journal }) {
    if (!core) throw new Error("AppUiBaseCompositionModule.compose requires core");
    if (!journal) throw new Error("AppUiBaseCompositionModule.compose requires journal");

    const {
      app,
      appFormattingModule,
      projectStateModule,
      projectMutationModule,
      workbookModule,
      projectFileModule,
      workbookViewModule,
      sheetCanvasModule,
      toastModule,
      renderBridge,
    } = core;

    const {
      devLabel,
      aiModels,
      defaultAiModel,
    } = this._config;

    const {
      addChangesJournal,
      clampSidebarWidth,
      applySidebarWidth,
      saveSidebarWidth,
      isKnownAiModel,
      renderOpenAiModelOptions,
      renderOpenAiModelPrice,
      saveOpenAiApiKey,
      saveOpenAiModel,
      saveAiOptions,
      addExternalJournal,
      renderAiUi,
    } = journal;

    const projectSheetSelectionModule = new ProjectSheetSelectionModule({
      app,
      dom: this._dom,
      documentRef: this._document,
      activeSheet: () => workbookViewModule.activeSheet(),
      cellText: (...args) => sheetCanvasModule.cellText(...args),
    });

    const projectWorkspaceModule = new ProjectWorkspaceModule({
      app,
      dom: this._dom,
      projectStateApi: projectStateModule,
      projectFileApi: projectFileModule,
      addChangesJournal,
      toast: (text) => toastModule.show(text),
      renderAll: () => renderBridge.renderAll(),
      currentZoom: (sheet) => workbookViewModule.currentZoom(sheet),
      clampSidebarWidth,
      applySidebarWidth,
      saveSidebarWidth,
      normalizeSheetValue: (value) => {
        if (value === null || value === undefined || value === "") return null;
        if (typeof value === "number" || typeof value === "boolean") return value;
        return String(value);
      },
      devLabel,
      windowRef: this._window,
      documentRef: this._document,
    });

    const projectSidebarModule = new ProjectSidebarModule({
      app,
      dom: this._dom,
      projectStateApi: projectStateModule,
      projectMutationApi: projectMutationModule,
      workbookApi: workbookModule,
      esc: (value) => appFormattingModule.escapeHtml(value),
      money: (value) => appFormattingModule.money(value),
    });

    const projectUiActionModule = new ProjectUiActionModule({
      app,
      mutationApi: projectMutationModule,
      renderAll: () => renderBridge.renderAll(),
      renderTree: () => projectSidebarModule.renderTree(),
      renderInspector: () => projectSidebarModule.renderInspector(),
      renderTabs: () => workbookViewModule.renderTabs(),
      renderSheet: () => renderBridge.renderSheet(),
      addChangesJournal,
      toast: (text) => toastModule.show(text),
      openSettingsDialog: () => projectWorkspaceModule.openSettingsDialog(),
    });

    const openAiAuthModule = new OpenAiAuthModule({
      app,
      dom: this._dom,
      aiModels,
      defaultModel: defaultAiModel,
      fetchFn: (...args) => this._fetch(...args),
      windowRef: this._window,
      isKnownAiModel,
      renderOpenAiModelOptions,
      renderOpenAiModelPrice,
      saveOpenAiApiKey,
      saveOpenAiModel,
      saveAiOptions,
      addChangesJournal,
      addExternalJournal,
      renderAiUi,
      toast: (text) => toastModule.show(text),
    });

    return {
      projectSheetSelectionModule,
      projectWorkspaceModule,
      projectSidebarModule,
      projectUiActionModule,
      openAiAuthModule,
    };
  }
}
