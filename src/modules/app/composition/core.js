import { AppIdentityModule } from "../core/identity.js";
import { ProjectStateModule } from "../../project/state.js";
import { ProjectMutationModule } from "../../project/mutation.js";
import { AppFormattingModule } from "../core/formatting.js";
import { TemplateModule } from "../../template/index.js";
import { WorkbookModule } from "../../workbook/index.js";
import { ProjectFileModule } from "../../project/file/index.js";
import { SheetCanvasModule } from "../../sheet/canvas.js";
import { ClipboardModule } from "../../shared/clipboard.js";
import { ToastModule } from "../../shared/toast.js";
import { WorkbookViewModule } from "../../workbook/view.js";

export class AppCoreCompositionModule {
  constructor({
    dom,
    config,
    windowRef,
    documentRef,
    fetchFn,
  }) {
    if (!dom) throw new Error("AppCoreCompositionModule requires dom");
    if (!config) throw new Error("AppCoreCompositionModule requires config");
    if (!windowRef) throw new Error("AppCoreCompositionModule requires windowRef");
    if (!documentRef) throw new Error("AppCoreCompositionModule requires documentRef");
    if (typeof fetchFn !== "function") throw new Error("AppCoreCompositionModule requires fetchFn()");

    this._dom = dom;
    this._config = config;
    this._window = windowRef;
    this._document = documentRef;
    this._fetch = fetchFn;
  }

  compose() {
    const { sheetNames, defaultAiModel } = this._config;

    const app = {
      template: null,
      state: null,
      workbook: null,
      ui: {
        activeSheetId: "summary",
        treeSel: { type: "settings" },
        sidebarTab: "tree",
        journalView: "chat",
        selection: null,
        zoomBySheet: {},
        selecting: false,
        panning: false,
        pan: null,
        sidebarCollapsed: false,
        sidebarWidth: 360,
        sidebarResizing: false,
      },
      ai: {
        apiKey: "",
        model: defaultAiModel,
        connected: false,
        sending: false,
        collapsed: false,
        options: {
          webSearch: true,
          webSearchCountry: "RU",
          webSearchContextSize: "high",
          reasoning: true,
          allowQuestions: true,
          reasoningEffort: "medium",
        },
        webSearchPopoverOpen: false,
        reasoningPopoverOpen: false,
        pendingQuestion: null,
        attachments: [],
        fileSearch: {
          vectorStoreId: "",
          attachmentsSignature: "",
          syncedAt: 0,
        },
        chatJournal: [],
        chatSummary: "",
        chatSummaryCount: 0,
        tableJournal: [],
        externalJournal: [],
        changesJournal: [],
        sheetOverrides: {},
        lastTaskPrompt: "",
        lastAssemblyId: "",
        lastActionablePrompt: "",
        pendingTask: "",
        taskState: "idle",
        turnId: "",
        turnCounter: 0,
        streaming: true,
        streamDeltaCount: 0,
        streamReasoningDeltaCount: 0,
        streamResponseId: "",
        currentRequestId: "",
        lastStreamBuffer: "",
        streamReasoningBuffer: "",
        streamDeltaFlushTimer: 0,
        streamDeltaHasPending: false,
        streamEntryId: "",
        lastSuccessfulMutationTs: 0,
      },
    };

    const appIdentityModule = new AppIdentityModule();
    const projectStateModule = new ProjectStateModule({
      createId: () => appIdentityModule.createId(),
    });
    const projectMutationModule = new ProjectMutationModule({
      stateApi: projectStateModule,
      createId: () => appIdentityModule.createId(),
    });
    const appFormattingModule = new AppFormattingModule({
      num: (value, fallback = 0) => projectMutationModule.num(value, fallback),
    });
    const templateModule = new TemplateModule({
      fetchFn: (...args) => this._fetch(...args),
      documentRef: this._document,
      sheetNames,
      math: projectStateModule,
    });
    const workbookModule = new WorkbookModule({
      sheetNames,
      math: projectStateModule,
    });
    const projectFileModule = new ProjectFileModule({
      stateApi: projectStateModule,
      templateApi: templateModule,
    });
    const sheetCanvasModule = new SheetCanvasModule({
      dom: this._dom,
      documentRef: this._document,
      decodeAddr: (...args) => templateModule.decodeAddr(...args),
    });
    const clipboardModule = new ClipboardModule({
      windowRef: this._window,
      documentRef: this._document,
    });
    const toastModule = new ToastModule({
      dom: this._dom,
      windowRef: this._window,
    });
    const workbookViewModule = new WorkbookViewModule({
      app,
      dom: this._dom,
      esc: (value) => appFormattingModule.escapeHtml(value),
    });

    let appRenderModule = null;
    const renderBridge = {
      renderAll: () => {
        if (!appRenderModule) throw new Error("AppRenderModule is not initialized");
        appRenderModule.renderAll();
      },
      renderSheet: () => {
        if (!appRenderModule) throw new Error("AppRenderModule is not initialized");
        appRenderModule.renderSheet();
      },
      setRenderModule: (moduleApi) => {
        appRenderModule = moduleApi;
      },
    };

    return {
      app,
      appIdentityModule,
      appFormattingModule,
      projectStateModule,
      projectMutationModule,
      templateModule,
      workbookModule,
      projectFileModule,
      sheetCanvasModule,
      clipboardModule,
      toastModule,
      workbookViewModule,
      renderBridge,
    };
  }
}
