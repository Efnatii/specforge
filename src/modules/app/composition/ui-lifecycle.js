import { AppRenderModule } from "../lifecycle/render.js";
import { AppBindingsModule } from "../lifecycle/bindings.js";
import { AppBootstrapModule } from "../lifecycle/bootstrap.js";

export class AppUiLifecycleCompositionModule {
  constructor({
    dom,
    windowRef,
    documentRef,
  }) {
    if (!dom) throw new Error("AppUiLifecycleCompositionModule requires dom");
    if (!windowRef) throw new Error("AppUiLifecycleCompositionModule requires windowRef");
    if (!documentRef) throw new Error("AppUiLifecycleCompositionModule requires documentRef");
    this._dom = dom;
    this._window = windowRef;
    this._document = documentRef;
  }

  compose({ core, journal, uiBase, agent }) {
    if (!core) throw new Error("AppUiLifecycleCompositionModule.compose requires core");
    if (!journal) throw new Error("AppUiLifecycleCompositionModule.compose requires journal");
    if (!uiBase) throw new Error("AppUiLifecycleCompositionModule.compose requires uiBase");
    if (!agent) throw new Error("AppUiLifecycleCompositionModule.compose requires agent");

    const {
      app,
      workbookModule,
      workbookViewModule,
      sheetCanvasModule,
      clipboardModule,
      toastModule,
      projectStateModule,
      templateModule,
      renderBridge,
    } = core;

    const {
      projectSheetSelectionModule,
      projectWorkspaceModule,
      projectUiActionModule,
      openAiAuthModule,
      projectSidebarModule,
    } = uiBase;

    const {
      agentAttachmentModule,
      agentPromptModule,
      applyAgentSheetOverrides,
    } = agent;

    const {
      renderAiUi,
      renderJournalViewMode,
      renderOpenAiModelPrice,
      saveAiCollapsed,
      copyJournal,
      copyAllJournals,
      renderAgentJournals,
      loadAiSettings,
      applySidebarWidth,
    } = journal;

    const appBindingsModule = new AppBindingsModule({
      app,
      dom: this._dom,
      windowRef: this._window,
      documentRef: this._document,
      projectStateApi: projectStateModule,
      projectWorkspaceApi: projectWorkspaceModule,
      openAiAuthApi: openAiAuthModule,
      agentAttachmentApi: agentAttachmentModule,
      agentPromptApi: agentPromptModule,
      projectUiActionApi: projectUiActionModule,
      projectSheetSelectionApi: projectSheetSelectionModule,
      renderAiUi,
      renderJournalViewMode,
      renderOpenAiModelPrice,
      saveAiCollapsed,
      copyJournal,
      copyAllJournals,
      renderAgentJournals,
      activeSheet: () => workbookViewModule.activeSheet(),
      currentZoom: (sheet) => workbookViewModule.currentZoom(sheet),
      renderTabs: () => workbookViewModule.renderTabs(),
      renderSheet: () => renderBridge.renderSheet(),
      renderAll: () => renderBridge.renderAll(),
      copyText: (text) => clipboardModule.copyText(text),
      toast: (text) => toastModule.show(text),
    });

    const appRenderModule = new AppRenderModule({
      app,
      workbookApi: workbookModule,
      applyAgentSheetOverrides,
      workbookViewApi: workbookViewModule,
      sheetCanvasApi: sheetCanvasModule,
      projectSheetSelectionApi: projectSheetSelectionModule,
      projectSidebarApi: projectSidebarModule,
      renderAiUi,
    });
    renderBridge.setRenderModule(appRenderModule);

    const appBootstrapModule = new AppBootstrapModule({
      app,
      templateApi: templateModule,
      projectStateApi: projectStateModule,
      loadAiSettings,
      applySidebarWidth,
      bindEvents: () => appBindingsModule.bindEvents(),
      renderAll: () => renderBridge.renderAll(),
      renderAiUi,
      toast: (text) => toastModule.show(text),
    });

    return {
      appBindingsModule,
      appRenderModule,
      appBootstrapModule,
    };
  }
}
