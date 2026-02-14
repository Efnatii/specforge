import { saveAs } from "file-saver";
import { EventBus } from "../core/EventBus.js";
import { StateStore, STATE_CHANGED } from "../core/StateStore.js";
import { JobQueue } from "../core/JobQueue.js";
import { IdbStore } from "../core/IdbStore.js";
import { JobLeaseManager } from "../core/JobLeaseManager.js";
import { JobRunner } from "../core/JobRunner.js";
import { BootManager } from "../core/BootManager.js";
import { Scheduler } from "../core/Scheduler.js";
import { TemplateLoader } from "../xlsx/TemplateLoader.js";
import { WorkbookAdapter } from "../xlsx/WorkbookAdapter.js";
import { TemplateBufferStore } from "../xlsx/TemplateBufferStore.js";
import { TemplateFingerprint } from "../xlsx/TemplateFingerprint.js";
import { WorkbookExporter } from "../xlsx/WorkbookExporter.js";
import { WorkbookImporter } from "../xlsx/WorkbookImporter.js";
import { SheetFactory } from "../xlsx/SheetFactory.js";
import { Layout } from "../ui/Layout.js";
import { RightPanel } from "../ui/RightPanel.js";
import { SheetTabs } from "../ui/SheetTabs.js";
import { SheetGridView } from "../ui/SheetGridView.js";
import { Toast } from "../ui/Toast.js";
import { ProgressPanel } from "../ui/ProgressPanel.js";
import { CellEditorOverlay } from "../ui/CellEditorOverlay.js";
import { ChangesPanel } from "../ui/ChangesPanel.js";
import { ConfirmDialog } from "../ui/dialogs/ConfirmDialog.js";
import { AddAssemblyDialog } from "../ui/dialogs/AddAssemblyDialog.js";
import { ImportModeDialog } from "../ui/dialogs/ImportModeDialog.js";
import { AutoFillPreviewDialog } from "../ui/dialogs/AutoFillPreviewDialog.js";
import { TemplateSchema } from "../editor/TemplateSchema.js";
import { UndoStack } from "../editor/UndoStack.js";
import { AuditLog } from "../editor/AuditLog.js";
import { ValueParser } from "../editor/ValueParser.js";
import { EditorStateDriver } from "../editor/EditorStateDriver.js";
import { EditorController } from "../editor/EditorController.js";
import { ClipboardService } from "../editor/ClipboardService.js";
import { TableRangeManager } from "../editor/TableRangeManager.js";
import { RowShiftService } from "../editor/RowShiftService.js";
import { PasteApplyService } from "../editor/PasteApplyService.js";
import { PasteSpecialDialog } from "../editor/PasteSpecialDialog.js";
import { WorkbookPipeline } from "./WorkbookPipeline.js";
import { CalcEngine } from "../calc/CalcEngine.js";
import { CalcFacade } from "./CalcFacade.js";
import { QcService } from "../qc/QcService.js";
import { QcPanel } from "../qc/QcPanel.js";
import { QcExporter } from "../qc/QcExporter.js";
import { QcFacade } from "./QcFacade.js";
import { PrintPreviewDialog } from "../print/PrintPreviewDialog.js";
import { PrintService } from "../print/PrintService.js";
import { PrintTemplates } from "../print/PrintTemplates.js";
import { BindingMap } from "../domain/BindingMap.js";
import { AssemblyRegistry } from "../domain/AssemblyRegistry.js";
import { TkpSyncService } from "../domain/TkpSyncService.js";
import { AutoFillService } from "../domain/AutoFillService.js";
import { TkpModel } from "../domain/TkpModel.js";
import { FindIndexBuilder } from "../find/FindIndexBuilder.js";
import { FindService } from "../find/FindService.js";
import { FindPanel } from "../find/FindPanel.js";
import { ReplaceService } from "../find/ReplaceService.js";
import { ConfigStore } from "../config/ConfigStore.js";
import { SchemaEditorDialog } from "../config/SchemaEditorDialog.js";
import { BindingsEditorDialog } from "../config/BindingsEditorDialog.js";
import { WorkerPool } from "../workers/WorkerPool.js";
import { ChaosService } from "../devtools/ChaosService.js";
import { ChaosPanel } from "../devtools/ChaosPanel.js";
import { I18n } from "../i18n/I18n.js";
import { ruDict } from "../i18n/ru.js";
import { CommandRegistry } from "../ui/command/CommandRegistry.js";
import { Hotkeys } from "../ui/command/Hotkeys.js";

const CACHE_SNAPSHOT_KEY = "lastSnapshot";
const CACHE_WORKBOOK_KEY = "lastWorkbook";
const UI_LAYOUT_KEY = "uiLayout";
const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
const emptyQc = { ts: 0, summary: { errorsCount: 0, warningsCount: 0 }, items: [] };

function createInitialState() {
  return { boot: { phase: "BOOT" }, template: { source: null, name: null, loadedAtTs: null, bufferHash: null, structureFingerprint: null }, workbook: { sheets: [], activeSheetId: null }, render: { zoom: 1 }, jobs: {}, editor: { selection: { sheetId: null, addressA1: null, anchorAddressA1: null, focusAddressA1: null, range: null, mode: "cell" }, editMode: false, lastError: null, errors: {} }, edits: {}, audit: { recent: [] }, calc: { perSheet: {} }, qc: { report: emptyQc }, tkp: TkpModel.createDefault(), find: { needle: "", replace: "", scope: "sheet", matchCase: false, wholeCell: false, useRegex: false, results: [], activeIndex: -1 }, exportMeta: { orderNo: "0091-0821", requestNo: "0254", title: "КП Общая", modifiedDate: today() }, warnings: [], ui: { layout: { leftDockWidth: 260, rightDockWidth: 360 } } };
}

export class App {
  constructor(rootElement) {
    this.currentWorkbook = null;
    this.i18n = new I18n(ruDict);
    this.templateSchema = new TemplateSchema();
    this.eventBus = new EventBus();
    this.stateStore = new StateStore(this.eventBus, createInitialState());
    this.jobQueue = new JobQueue({ stateStore: this.stateStore, maxAttempts: 2 });
    this.scheduler = new Scheduler();

    this.idbStore = new IdbStore();
    this.workerPool = new WorkerPool({});
    this.jobLeaseManager = new JobLeaseManager({ idbStore: this.idbStore });
    this.jobRunner = new JobRunner({ workerPool: this.workerPool, leaseManager: this.jobLeaseManager });
    this.jobQueue.idbStore = this.idbStore;
    this.jobQueue.setRunner(this.jobRunner);
    this.templateLoader = new TemplateLoader();
    this.workbookAdapter = new WorkbookAdapter();
    this.templateBufferStore = new TemplateBufferStore(this.idbStore);
    this.templateFingerprint = new TemplateFingerprint();
    this.workbookExporter = new WorkbookExporter();
    this.workbookImporter = new WorkbookImporter({
      templateLoader: this.templateLoader,
      workbookAdapter: this.workbookAdapter,
      templateFingerprint: this.templateFingerprint,
      templateSchema: this.templateSchema
    });
    this.sheetFactory = new SheetFactory(this.workbookAdapter);
    this.fileInputs = this.createFileInputs();
    this.commandRegistry = new CommandRegistry({ stateStore: this.stateStore, context: { i18n: this.i18n } });

    this.layout = new Layout(rootElement, {
      i18n: this.i18n,
      registry: this.commandRegistry,
      menuConfig: this.getTopMenuConfig(),
      ribbonTabs: this.getRibbonConfig(),
      layoutState: this.stateStore.getState().ui.layout,
      onLayoutChange: (layout) => this.updateLayoutState(layout),
      onOpenFile: () => this.openFilePicker("load"),
      onLoadDefaultAsset: () => this.loadDefaultAssetFromEmptyState(),
      onZoomIn: () => this.adjustZoom(0.05),
      onZoomOut: () => this.adjustZoom(-0.05)
    });
    this.layoutRefs = this.layout.render();
    this.toast = new Toast(this.layoutRefs.toastRoot);
    this.sheetTabs = new SheetTabs({ container: this.layoutRefs.tabs, eventBus: this.eventBus, i18n: this.i18n });
    this.sheetGridView = new SheetGridView({ container: this.layoutRefs.viewport });

    this.progressPanel = new ProgressPanel({ container: document.createElement("div"), onCancel: (id) => this.jobQueue.cancel(id), i18n: this.i18n });
    this.changesPanel = new ChangesPanel(document.createElement("div"), { i18n: this.i18n });
    this.qcPanel = new QcPanel(document.createElement("div"), {
      onJumpToCell: (i) => this.jumpToCell(i),
      onScan: () => this.qcFacade.runScan(this.currentWorkbook),
      onExportCsv: () => this.qcFacade.exportCsv(),
      onExportXlsx: () => this.qcFacade.exportXlsx(),
      i18n: this.i18n
    });
    this.findPanel = new FindPanel(document.createElement("div"), {
      onSearch: (query) => this.runFind(query),
      onPrev: () => this.selectFindPrev(),
      onNext: () => this.selectFindNext(),
      onReplaceOne: (payload) => this.runReplaceOne(payload),
      onReplaceAll: (payload) => this.runReplaceAll(payload),
      onSelect: (idx) => this.selectFindIndex(idx)
    }, { i18n: this.i18n });
    this.rightPanel = new RightPanel({
      root: this.layoutRefs.rightPanelHost,
      tabHosts: this.layoutRefs.rightTabHosts,
      onTabChange: (tabId) => this.layoutRefs.setRightDockTab?.(tabId),
      progressPanel: this.progressPanel,
      changesPanel: this.changesPanel,
      qcPanel: this.qcPanel,
      findPanel: this.findPanel,
      i18n: this.i18n
    });

    this.confirmDialog = new ConfirmDialog(this.layoutRefs.modalRoot, { i18n: this.i18n });
    this.addAssemblyDialog = new AddAssemblyDialog(this.layoutRefs.modalRoot, { i18n: this.i18n });
    this.importModeDialog = new ImportModeDialog(this.layoutRefs.modalRoot, { i18n: this.i18n });
    this.autoFillPreviewDialog = new AutoFillPreviewDialog(this.layoutRefs.modalRoot, { i18n: this.i18n });
    this.printPreviewDialog = new PrintPreviewDialog(this.layoutRefs.modalRoot, { i18n: this.i18n });
    this.printService = new PrintService({ printPreviewDialog: this.printPreviewDialog });
    this.pasteSpecialDialog = new PasteSpecialDialog(this.layoutRefs.modalRoot, { i18n: this.i18n });
    this.schemaEditorDialog = new SchemaEditorDialog(this.layoutRefs.modalRoot, { i18n: this.i18n });
    this.bindingsEditorDialog = new BindingsEditorDialog(this.layoutRefs.modalRoot, { i18n: this.i18n });
    this.cellEditorOverlay = new CellEditorOverlay({ container: this.layoutRefs.viewport }); this.undoStack = new UndoStack(200); this.auditLog = new AuditLog(300); this.valueParser = new ValueParser(); this.editorStateDriver = new EditorStateDriver({ stateStore: this.stateStore, idbStore: this.idbStore, getWorkbook: () => this.currentWorkbook, auditLog: this.auditLog }); this.clipboardService = new ClipboardService({ toast: this.toast }); this.tableRangeManager = null; this.rowShiftService = new RowShiftService({ templateSchema: this.templateSchema, getWorkbook: () => this.currentWorkbook, getEdits: () => this.stateStore.getState().edits }); this.configStore = new ConfigStore({ idbStore: this.idbStore, baseUrl: import.meta.env.BASE_URL }); this.findIndexBuilder = new FindIndexBuilder(); this.findService = new FindService(); this.chaosService = new ChaosService({ jobQueue: this.jobQueue, stateStore: this.stateStore, scheduler: this.scheduler }); this.chaosPanel = null;
    this.calcEngine = new CalcEngine({ eventBus: this.eventBus, stateStore: this.stateStore }); this.calcFacade = new CalcFacade({ calcEngine: this.calcEngine, stateStore: this.stateStore, jobQueue: this.jobQueue, toast: this.toast, templateSchema: this.templateSchema, eventBus: this.eventBus }); this.qcFacade = new QcFacade({ qcService: new QcService(), qcExporter: new QcExporter(), stateStore: this.stateStore, jobQueue: this.jobQueue, toast: this.toast, templateSchema: this.templateSchema });
    this.bindingMap = new BindingMap(); this.tableRangeManager = new TableRangeManager({ bindingMap: this.bindingMap }); this.tkpSyncService = new TkpSyncService(this.bindingMap); this.assemblyRegistry = new AssemblyRegistry({ eventBus: this.eventBus, idbStore: this.idbStore, scheduler: this.scheduler }); this.autoFillService = new AutoFillService({ tkpSyncService: this.tkpSyncService, auditLog: this.auditLog, scheduler: this.scheduler, ensureAssemblyPair: (abbr) => this.ensureAssemblyPair(abbr) });
    this.editorController = new EditorController({ eventBus: this.eventBus, stateStore: this.stateStore, templateSchema: this.templateSchema, gridView: this.sheetGridView, cellEditorOverlay: this.cellEditorOverlay, undoStack: this.undoStack, valueParser: this.valueParser, toast: this.toast, getWorkbook: () => this.currentWorkbook, stateDriver: this.editorStateDriver, onCellCommitted: (p) => this.handleCellCommitted(p), jobQueue: this.jobQueue, clipboardService: this.clipboardService, tableRangeManager: this.tableRangeManager, rowShiftService: this.rowShiftService });
    this.pasteApplyService = new PasteApplyService({ templateSchema: this.templateSchema, valueParser: this.valueParser, stateDriver: this.editorStateDriver, undoStack: this.undoStack, getWorkbook: () => this.currentWorkbook, getState: () => this.stateStore.getState(), onCellCommitted: (p) => this.handleCellCommitted(p), jobQueue: this.jobQueue, toast: this.toast });
    this.replaceService = new ReplaceService({ templateSchema: this.templateSchema, valueParser: this.valueParser, stateDriver: this.editorStateDriver, undoStack: this.undoStack, getWorkbook: () => this.currentWorkbook, getState: () => this.stateStore.getState(), onCellCommitted: (p) => this.handleCellCommitted(p), jobQueue: this.jobQueue, toast: this.toast });
    this.pipeline = new WorkbookPipeline({ jobQueue: this.jobQueue, templateLoader: this.templateLoader, workbookAdapter: this.workbookAdapter, onBeforeLoad: () => this.stateStore.update({ boot: { phase: "LOADING_TEMPLATE" } }), onAfterLoad: async (wb, meta, buffer) => this.installBaseline(wb, buffer, meta, true), onError: (e) => this.toast.show(this.i18n.t("appMessages.loadFailed", { message: e.message }), "error", 5000), assertNotAborted: (signal) => this.assertNotAborted(signal) });
    this.bootManager = new BootManager({ idbStore: this.idbStore, templateBufferStore: this.templateBufferStore, stateStore: this.stateStore, onLoadWorkbookFromBuffer: (workbook) => { this.currentWorkbook = workbook; } });
    this.registerCommands();
    this.layout.renderQuickAccess(this.getQuickAccessCommands());
    this.hotkeys = new Hotkeys({ target: window, commandRegistry: this.commandRegistry, onCommandSearch: () => this.layout.openCommandSearch() });
  }

  async start() {
    this.bindEvents(); this.editorController.start(); this.hotkeys.bind(); this.render(this.stateStore.getState()); await this.restoreLayoutState(); await this.configStore.init(); await this.loadSchema(); await this.loadBindingMap(); const model = await this.assemblyRegistry.restore().catch(() => TkpModel.createDefault()); this.stateStore.update({ tkp: model }); const recovery = await this.bootManager.boot().catch(() => null); if (recovery?.recovery && (recovery.recovery.requeued || recovery.recovery.failed)) { this.toast.show(this.i18n.t("appMessages.recovery", { requeued: recovery.recovery.requeued, failed: recovery.recovery.failed }), "info", 6000); }
    if (await this.tryRestoreFromCache()) { await this.restoreEdits(); await this.calcFacade.buildCalcModel(this.currentWorkbook, this.stateStore.getState().edits); if (this.shouldShowDevtools()) { this.mountChaosPanel(); } return; }
    try { await this.pipeline.loadFromAsset(import.meta.env.BASE_URL); } catch { this.stateStore.update({ boot: { phase: "ERROR" } }); }
    if (this.shouldShowDevtools()) { this.mountChaosPanel(); }
  }

  bindEvents() {
    this.eventBus.on("SHEET_SELECTED", async ({ sheetId }) => { this.stateStore.update({ workbook: { activeSheetId: sheetId }, editor: { editMode: false, selection: { sheetId, addressA1: null, anchorAddressA1: null, focusAddressA1: null, range: null, mode: "cell" } } }); await this.persistSnapshot(); });
    this.eventBus.on("ASSEMBLIES_CHANGED", (model) => this.stateStore.update({ tkp: model }));
    this.eventBus.on(STATE_CHANGED, (state) => this.render(state));
    this.rightPanel.setAssemblyHandlers({ onAssemblyChange: (abbr, patch) => this.assemblyRegistry.updateAssembly(abbr, patch), onAssemblyAction: (action, selected) => this.handleAssemblyAction(action, selected) });
  }

  render(state) {
    this.layout.updateHeader(state); this.sheetTabs.render(state.workbook.sheets, state.workbook.activeSheetId);
    const activeName = state.workbook.sheets.find((s) => s.id === state.workbook.activeSheetId)?.name; const qcWarnings = (state.qc.report?.items || []).filter((i) => i.sheetName === activeName);
    this.sheetGridView.render(this.currentWorkbook, state.workbook.activeSheetId, state.render.zoom, state.edits[state.workbook.activeSheetId] || {}, state.editor, state.calc.perSheet?.[activeName] || {}, qcWarnings);
    const fmtWarnings = this.sheetGridView.takeNumFmtWarnings(); if (fmtWarnings.length) { const set = new Set(state.warnings || []); const add = fmtWarnings.filter((w) => !set.has(w)); if (add.length) { this.stateStore.update({ warnings: [...state.warnings, ...add].slice(-120) }); } }
    this.rightPanel.render({ jobs: state.jobs, changes: state.audit.recent, qcReport: state.qc.report, sheets: state.workbook.sheets, tkpModel: state.tkp, findState: state.find });
  }

  createFileInputs() {
    const create = (handler) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx";
      input.className = "file-input-hidden";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (file) {
          await handler(file);
        }
        input.value = "";
      });
      document.body.appendChild(input);
      return input;
    };
    return {
      load: create(async (file) => { try { await this.pipeline.loadFromFile(file); } catch {} }),
      importUpdate: create(async (file) => this.runImportUpdate(file)),
      importReplace: create(async (file) => this.runImportReplace(file))
    };
  }

  openFilePicker(type) {
    this.fileInputs[type]?.click();
  }

  registerCommands() {
    const hasWorkbook = (state) => Boolean(state?.workbook?.sheets?.length);

    this.commandRegistry.registerMany([
      { id: "file.open", titleKey: "commands.openFile", icon: "folder-open", hotkey: "Ctrl+O", run: () => this.openFilePicker("load") },
      { id: "file.importUpdate", titleKey: "commands.importUpdate", icon: "upload", whenEnabled: hasWorkbook, run: () => this.openFilePicker("importUpdate") },
      { id: "file.importReplace", titleKey: "commands.importReplace", icon: "file-up", run: () => this.openFilePicker("importReplace") },
      { id: "file.export", titleKey: "commands.export", icon: "download", hotkey: "Ctrl+S", whenEnabled: hasWorkbook, run: () => this.runExport() },
      { id: "file.print", titleKey: "commands.print", icon: "printer", whenEnabled: hasWorkbook, run: () => this.runPrintPreviewFlow() },
      { id: "edit.undo", titleKey: "commands.undo", icon: "rotate-ccw", hotkey: "Ctrl+Z", whenEnabled: hasWorkbook, run: () => this.editorController.undo() },
      { id: "edit.redo", titleKey: "commands.redo", icon: "history", hotkey: "Ctrl+Y", whenEnabled: hasWorkbook, run: () => this.editorController.redo() },
      { id: "edit.insertRow", titleKey: "commands.insertRow", icon: "plus", hotkey: "Ctrl+Shift++", whenEnabled: hasWorkbook, run: () => this.editorController.insertRowInTable() },
      { id: "edit.deleteRow", titleKey: "commands.deleteRow", icon: "minus", hotkey: "Ctrl+-", whenEnabled: hasWorkbook, run: () => this.editorController.deleteRowInTable() },
      { id: "edit.pasteSpecial", titleKey: "commands.pasteSpecial", icon: "columns", hotkey: "Ctrl+Shift+V", whenEnabled: hasWorkbook, run: () => this.runPasteSpecial() },
      { id: "assemblies.add", titleKey: "commands.addAssembly", icon: "plus", whenEnabled: hasWorkbook, run: () => this.runAddAssembly() },
      { id: "assemblies.preview", titleKey: "commands.autofillPreview", icon: "wand", whenEnabled: hasWorkbook, run: () => this.runAutoFillPreview() },
      { id: "assemblies.modelSync", titleKey: "commands.workbookToModel", icon: "clipboard-import", whenEnabled: hasWorkbook, run: () => this.runWorkbookToModelPreview() },
      { id: "qc.scan", titleKey: "commands.qcScan", icon: "alert-triangle", whenEnabled: hasWorkbook, run: () => this.qcFacade.runScan(this.currentWorkbook) },
      { id: "qc.exportXlsx", titleKey: "commands.qcExport", icon: "download", whenEnabled: hasWorkbook, run: () => this.qcFacade.exportXlsx() },
      { id: "view.find", titleKey: "commands.find", icon: "search", hotkey: "Ctrl+F", whenEnabled: hasWorkbook, run: () => this.rightPanel.setActiveTab("find") },
      { id: "view.jobs", titleKey: "commands.jobsPanel", icon: "activity", run: () => this.rightPanel.setActiveTab("jobs") },
      { id: "view.zoomIn", titleKey: "commands.zoomIn", icon: "zoom-in", run: () => this.adjustZoom(0.05) },
      { id: "view.zoomOut", titleKey: "commands.zoomOut", icon: "zoom-out", run: () => this.adjustZoom(-0.05) },
      { id: "manage.schema", titleKey: "commands.schema", icon: "settings", run: () => this.runSchemaEditor() },
      { id: "manage.bindings", titleKey: "commands.bindings", icon: "list", run: () => this.runBindingsEditor() },
      { id: "manage.reset", titleKey: "commands.reset", icon: "rotate-ccw", run: () => this.reset() },
      { id: "help.search", titleKey: "commands.commandSearch", icon: "search", hotkey: "Alt+/", run: () => this.layout.openCommandSearch() }
    ]);
  }

  getQuickAccessCommands() {
    return [
      { id: "file.open", titleKey: "commands.openFile", icon: "folder-open" },
      { id: "file.export", titleKey: "commands.export", icon: "download" },
      { id: "edit.undo", titleKey: "commands.undo", icon: "rotate-ccw" },
      { id: "edit.redo", titleKey: "commands.redo", icon: "history" },
      { id: "help.search", titleKey: "commands.commandSearch", icon: "search" }
    ];
  }

  getTopMenuConfig() {
    return [
      { id: "file", titleKey: "menu.file", commands: ["file.open", "file.importUpdate", "file.importReplace", "file.export", "file.print", "manage.reset"] },
      { id: "edit", titleKey: "menu.edit", commands: ["edit.undo", "edit.redo", "edit.insertRow", "edit.deleteRow", "edit.pasteSpecial"] },
      { id: "select", titleKey: "menu.select", commands: ["view.find"] },
      { id: "view", titleKey: "menu.view", commands: ["view.zoomIn", "view.zoomOut", "view.jobs"] },
      { id: "insert", titleKey: "menu.insert", commands: ["assemblies.add"] },
      { id: "format", titleKey: "menu.format", commands: ["assemblies.preview"] },
      { id: "diag", titleKey: "menu.diagnostics", commands: ["qc.scan", "qc.exportXlsx"] },
      { id: "manage", titleKey: "menu.manage", commands: ["manage.schema", "manage.bindings"] },
      { id: "config", titleKey: "menu.config", commands: ["manage.schema", "manage.bindings"] },
      { id: "help", titleKey: "menu.help", commands: ["help.search"] }
    ];
  }

  getRibbonConfig() {
    return [
      { id: "project", title: "ribbon.project", groups: [{ titleKey: "ribbonGroup.project", commands: ["file.open", "file.importReplace"] }, { titleKey: "ribbonGroup.search", commands: ["view.find", "help.search"] }] },
      { id: "io", title: "ribbon.io", groups: [{ titleKey: "ribbonGroup.import", commands: ["file.open", "file.importUpdate", "file.importReplace"] }, { titleKey: "ribbonGroup.export", commands: ["file.export", "file.print"] }] },
      { id: "edit", title: "ribbon.edit", groups: [{ titleKey: "ribbonGroup.edits", commands: ["edit.undo", "edit.redo", "edit.insertRow", "edit.deleteRow", "edit.pasteSpecial"] }] },
      { id: "assemblies", title: "ribbon.assemblies", groups: [{ titleKey: "ribbonGroup.assemblies", commands: ["assemblies.add", "assemblies.preview", "assemblies.modelSync"] }] },
      { id: "qc", title: "ribbon.qc", groups: [{ titleKey: "ribbonGroup.qc", commands: ["qc.scan", "qc.exportXlsx"] }] },
      { id: "view", title: "ribbon.view", groups: [{ titleKey: "ribbonGroup.zoom", commands: ["view.zoomIn", "view.zoomOut"] }, { titleKey: "ribbonGroup.panels", commands: ["view.jobs", "view.find"] }] },
      { id: "settings", title: "ribbon.settings", groups: [{ titleKey: "ribbonGroup.settings", commands: ["manage.schema", "manage.bindings", "manage.reset"] }] }
    ];
  }

  adjustZoom(delta) {
    const current = Number(this.stateStore.getState().render.zoom || 1);
    const next = Math.min(3, Math.max(0.25, Math.round((current + delta) * 100) / 100));
    this.stateStore.update({ render: { zoom: next } });
  }

  updateLayoutState(layout) {
    this.stateStore.update({ ui: { layout } });
    this.idbStore.set(UI_LAYOUT_KEY, layout).catch(() => null);
  }

  async restoreLayoutState() {
    const saved = await this.idbStore.get(UI_LAYOUT_KEY).catch(() => null);
    if (!saved || typeof saved !== "object") {
      return;
    }
    this.stateStore.update({ ui: { layout: saved } });
    if (this.layout?.shell) {
      this.layout.shell.layoutState = { ...this.layout.shell.layoutState, ...saved };
      this.layout.shell.applyLayout();
    }
  }

  async loadBindingMap() { const effective = this.configStore.getEffectiveBindings(); this.bindingMap = effective.bindings; this.tableRangeManager = new TableRangeManager({ bindingMap: this.bindingMap }); this.editorController.tableRangeManager = this.tableRangeManager; this.tkpSyncService = new TkpSyncService(this.bindingMap); this.autoFillService.tkpSyncService = this.tkpSyncService; }

  async installBaseline(workbook, buffer, meta, clearEdits) { const hash = await this.templateFingerprint.hashBufferSha256(buffer); const structureFingerprint = this.templateFingerprint.buildStructureFingerprint(workbook); await this.templateBufferStore.setBaselineBuffer(buffer, meta); this.currentWorkbook = workbook; const sheets = workbook.sheets.map((s) => ({ id: s.id, name: s.name })); const activeSheetId = sheets[0]?.id || null; const patch = { template: { ...meta, loadedAtTs: meta.loadedAtTs || Date.now(), bufferHash: hash, structureFingerprint }, workbook: { sheets, activeSheetId }, warnings: workbook.warnings || [], editor: { selection: { sheetId: activeSheetId, addressA1: null, anchorAddressA1: null, focusAddressA1: null, range: null, mode: "cell" }, editMode: false, lastError: null, errors: {} }, calc: { perSheet: {} }, qc: { report: emptyQc } }; if (clearEdits) { this.undoStack.clear(); this.auditLog.clear(); await this.editorStateDriver.clearPersistedEdits(); Object.assign(patch, { edits: {}, audit: { recent: [] } }); } this.stateStore.update(patch); await this.persistSnapshot(); await this.calcFacade.buildCalcModel(this.currentWorkbook, this.stateStore.getState().edits); await this.qcFacade.runScan(this.currentWorkbook); this.stateStore.update({ boot: { phase: "READY" } }); }

  handleCellCommitted({ sheetName, addressA1, value }) { this.calcFacade.onCellCommitted({ sheetName, addressA1, value }); this.qcFacade.runLightForCell(this.currentWorkbook, sheetName, addressA1); }

  async runPrintPreviewFlow() {
    const baseline = this.templateBufferStore.getBaselineBuffer(); const state = this.stateStore.getState(); if (!baseline || !this.currentWorkbook) { this.toast.show(this.i18n.t("appMessages.loadWorkbookFirst"), "error"); return; }
    const payload = await this.printService.openDialog({ templates: PrintTemplates.list(), sheets: state.workbook.sheets, assemblies: state.tkp.assemblies, defaults: { templateId: "TEMPLATE_ALL" } }); if (!payload) { return; }
    const { promise } = this.jobQueue.enqueue({ type: "BUILD_PRINT_DOC", title: this.i18n.t("appMessages.jobBuildPrint"), run: async (_, signal, progress) => this.printService.buildPrintDoc({ baselineBuffer: baseline.buffer, workbookSnapshot: this.currentWorkbook, edits: state.edits, calcSnapshot: state.calc, ...payload, signal, reportProgress: progress }) });
    try { const doc = await promise; if (payload.mode === "preview") { this.printService.preview(this.layoutRefs.modalRoot, doc.htmlString); } else { this.printService.print(doc.htmlString); } } catch (e) { this.toast.show(this.i18n.t("appMessages.printBuildFailed", { message: e.message }), "error"); }
  }

  async runAutoFillPreview() { if (!this.currentWorkbook) { return; } const plan = await this.autoFillService.preview("ACTION_SYNC_MODEL_TO_WORKBOOK", { tkpModel: this.stateStore.getState().tkp, workbookSnapshot: this.currentWorkbook, editsOverlay: this.stateStore.getState().edits }); const ok = await this.autoFillPreviewDialog.open(plan); if (!ok) { return; } const nextEdits = this.autoFillService.apply(plan, { workbookSnapshot: this.currentWorkbook, currentEdits: this.stateStore.getState().edits, actionId: "autofill:sync_model_to_workbook" }); this.stateStore.update({ edits: nextEdits, audit: { recent: this.auditLog.getRecent(50) } }); await this.idbStore.put("workbookEdits", nextEdits); await this.calcFacade.recalcAfterMassEdit(this.currentWorkbook, nextEdits); await this.qcFacade.runScan(this.currentWorkbook); }

  async runWorkbookToModelPreview() {
    if (!this.currentWorkbook) { return; }
    const preview = await this.autoFillService.preview("ACTION_SYNC_WORKBOOK_TO_MODEL", { workbookSnapshot: this.currentWorkbook, editsOverlay: this.stateStore.getState().edits });
    const diffs = this.buildModelDiffChanges(this.stateStore.getState().tkp, preview.modelDraft);
    const plan = { title: this.i18n.t("appMessages.modelPreviewTitle"), changes: diffs, stats: { cellsChanged: diffs.length } };
    const ok = await this.autoFillPreviewDialog.open(plan);
    if (ok) { this.assemblyRegistry.setModel(preview.modelDraft); this.toast.show(this.i18n.t("appMessages.modelUpdated"), "success"); }
  }

  buildModelDiffChanges(prev, next) {
    const out = []; for (const key of ["orderNo", "requestNo", "modifiedDate"]) { if (String(prev.meta?.[key] || "") !== String(next.meta?.[key] || "")) { out.push({ sheetName: this.i18n.t("appMessages.modelSheet"), addressA1: key, before: prev.meta?.[key] || null, after: next.meta?.[key] || null, reason: this.i18n.t("appMessages.modelReasonMeta") }); } } const byAbbrPrev = new Map((prev.assemblies || []).map((a) => [a.abbr, a])); const byAbbrNext = new Map((next.assemblies || []).map((a) => [a.abbr, a])); for (const [abbr, n] of byAbbrNext.entries()) { const p = byAbbrPrev.get(abbr); if (!p) { out.push({ sheetName: this.i18n.t("appMessages.modelSheet"), addressA1: abbr, before: null, after: n.name, reason: this.i18n.t("appMessages.modelReasonAssemblyAdd") }); continue; } for (const k of ["name", "qty", "unit", "comment", "include"]) { if (String(p[k] ?? "") !== String(n[k] ?? "")) { out.push({ sheetName: this.i18n.t("appMessages.modelSheet"), addressA1: `${abbr}.${k}`, before: p[k] ?? null, after: n[k] ?? null, reason: this.i18n.t("appMessages.modelReasonAssemblyChange") }); } } } return out;
  }

  async handleAssemblyAction(action, selectedAbbr) {
    if (action === "add") { this.assemblyRegistry.addAssembly({}); return; }
    if (action === "remove" && selectedAbbr) { this.assemblyRegistry.removeAssembly(selectedAbbr); return; }
    if (action === "duplicate" && selectedAbbr) { this.assemblyRegistry.duplicateAssembly(selectedAbbr); return; }
    if (action === "sync_preview") { await this.runAutoFillPreview(); }
  }

  async ensureAssemblyPair(abbr) { const names = (this.currentWorkbook?.sheets || []).map((s) => s.name); if (names.includes(abbr) && names.includes(`Расход. мат. ${abbr}`)) { return; } const baseline = this.templateBufferStore.getBaselineBuffer(); if (!baseline) { return; } const { promise } = this.jobQueue.enqueue({ type: "ADD_ASSEMBLY_SHEETS", title: this.i18n.t("appMessages.jobAddAssembly", { abbr }), run: async (_, signal, progress) => { this.assertNotAborted(signal); progress({ completed: 0, total: 3, message: this.i18n.t("appMessages.progressClone") }); const res = await this.sheetFactory.addAssemblyPair({ baselineBuffer: baseline.buffer, abbr }); progress({ completed: 1, total: 3, message: this.i18n.t("appMessages.progressSaveBase") }); progress({ completed: 2, total: 3, message: this.i18n.t("appMessages.progressReparse") }); return res; } }); const res = await promise; await this.installBaseline(res.normalizedWorkbook, res.newBaselineBuffer, { source: "generated", name: `assembly:${abbr}`, loadedAtTs: Date.now() }, false); }

  async runExport() { const baseline = this.templateBufferStore.getBaselineBuffer(); if (!baseline) { return; } const s = this.stateStore.getState(); const exportBuffer = baseline.buffer.slice(0); const { promise } = this.jobQueue.enqueue({ type: "EXPORT_XLSX", title: this.i18n.t("appMessages.jobExportXlsx"), workerOp: "EXPORT_XLSX", workerPayload: { baselineBuffer: exportBuffer, edits: s.edits, sheets: s.workbook.sheets, exportMeta: s.exportMeta }, transfer: [exportBuffer] }); try { const result = await promise; saveAs(new Blob([result.outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), result.fileName || `${s.exportMeta.orderNo}.xlsx`); if ((result.warnings || []).length) { this.stateStore.update({ warnings: [...this.stateStore.getState().warnings, ...result.warnings].slice(-80) }); } } catch (e) { this.toast.show(this.i18n.t("appMessages.exportFailed", { message: e.message }), "error"); } }

  async runImportReplace(file) { const { promise } = this.jobQueue.enqueue({ type: "IMPORT_REPLACE_TEMPLATE", title: this.i18n.t("appMessages.jobImportReplace"), run: async (_, signal, p) => this.workbookImporter.importReplaceTemplate(file, signal, p) }); try { const r = await promise; await this.installBaseline(r.normalizedWorkbook, r.buffer, { source: "file", name: file.name, loadedAtTs: Date.now() }, true); } catch (e) { this.toast.show(this.i18n.t("appMessages.importReplaceFailed", { message: e.message }), "error"); } }

  async runImportUpdate(file) { const baseline = this.templateBufferStore.getBaselineBuffer(); if (!baseline) { return; } const s = this.stateStore.getState(); const importedBuffer = await file.arrayBuffer(); const baselineCopy = baseline.buffer.slice(0); const importedCopy = importedBuffer.slice(0); const { promise } = this.jobQueue.enqueue({ type: "IMPORT_AS_EDITS", title: this.i18n.t("appMessages.jobImportUpdate"), workerOp: "IMPORT_UPDATE_DIFF", workerPayload: { baselineBuffer: baselineCopy, importedBuffer: importedCopy, schema: this.configStore.getEffectiveSchema().json, structureFingerprintBaseline: s.template.structureFingerprint, workbookSheets: s.workbook.sheets }, transfer: [baselineCopy, importedCopy] }); try { const r = await promise; this.stateStore.update({ edits: r.nextEdits }); await this.idbStore.put("workbookEdits", r.nextEdits); await this.calcFacade.recalcAfterMassEdit(this.currentWorkbook, r.nextEdits); await this.qcFacade.runScan(this.currentWorkbook); } catch (e) { if (e.code === "INCOMPATIBLE_TEMPLATE") { const m = await this.importModeDialog.open({ reason: e.message, softTagFound: false }); if (m === "replace") { await this.runImportReplace(file); } return; } this.toast.show(this.i18n.t("appMessages.importUpdateFailed", { message: e.message }), "error"); } }

  async runAddAssembly() { const payload = await this.addAssemblyDialog.open(); if (!payload) { return; } await this.ensureAssemblyPair(payload.abbr); this.assemblyRegistry.addAssembly({ abbr: payload.abbr, name: payload.displayName || payload.abbr, qty: 1, include: true }); }

  async loadSchema() { const { promise } = this.jobQueue.enqueue({ type: "LOAD_SCHEMA_ASSET", title: this.i18n.t("appMessages.jobLoadSchema"), run: async (_, signal, p) => { this.assertNotAborted(signal); p({ completed: 0, total: 1, message: this.i18n.t("appMessages.progressReadSchema") }); const s = this.configStore.getEffectiveSchema().schema; p({ completed: 1, total: 1, message: this.i18n.t("appMessages.progressReady") }); return s; } }); this.templateSchema = await promise.catch(() => new TemplateSchema()); this.workbookImporter.templateSchema = this.templateSchema; this.editorController.templateSchema = this.templateSchema; this.rowShiftService.templateSchema = this.templateSchema; this.pasteApplyService.templateSchema = this.templateSchema; this.replaceService.templateSchema = this.templateSchema; this.calcFacade.templateSchema = this.templateSchema; this.qcFacade.templateSchema = this.templateSchema; }

  async restoreEdits() { await this.editorStateDriver.restoreEdits().catch(() => null); }

  async tryRestoreFromCache() { const [snapshot, workbook, baseline] = await Promise.all([this.idbStore.get(CACHE_SNAPSHOT_KEY), this.idbStore.get(CACHE_WORKBOOK_KEY), this.templateBufferStore.restore()]).catch(() => [null, null, null]); if (!snapshot || !workbook?.sheets?.length) { return false; } this.currentWorkbook = workbook; const fp = snapshot.template?.structureFingerprint || this.templateFingerprint.buildStructureFingerprint(workbook); this.stateStore.update({ ...snapshot, template: { ...snapshot.template, structureFingerprint: fp, ...(baseline?.meta || {}) }, calc: { perSheet: {} }, qc: { report: emptyQc }, editor: { ...(snapshot.editor || {}), errors: snapshot.editor?.errors || {} }, tkp: this.assemblyRegistry.getModel() }); return true; }

  async persistSnapshot() { const s = this.stateStore.getState(); await this.idbStore.set(CACHE_SNAPSHOT_KEY, { boot: { phase: s.boot.phase }, template: s.template, workbook: s.workbook, render: s.render, exportMeta: s.exportMeta, editor: { errors: s.editor.errors }, tkp: s.tkp, ui: s.ui }); if (this.currentWorkbook) { await this.idbStore.set(CACHE_WORKBOOK_KEY, this.currentWorkbook); } }

  async runFind(query) {
    if (!this.currentWorkbook) { return; }
    const state = this.stateStore.getState();
    const activeSheetName = state.workbook.sheets.find((s) => s.id === state.workbook.activeSheetId)?.name || null;
    try {
      const { promise } = this.jobQueue.enqueue({ type: "BUILD_FIND_INDEX", title: this.i18n.t("appMessages.jobFindIndex"), workerOp: "BUILD_FIND_INDEX", workerPayload: { scope: query.scope, normalizedWorkbook: this.currentWorkbook, edits: state.edits, calcSnapshot: state.calc, sheetName: activeSheetName } });
      const result = await promise;
      this.findService.setIndex(result.index);
      const results = this.findService.query({ ...query, sheetName: query.scope === "sheet" ? activeSheetName : null });
      this.stateStore.update({ find: { ...state.find, ...query, results, activeIndex: this.findService.activeIndex } });
    } catch (error) {
      this.toast.show(this.i18n.t("appMessages.findIndexFailed", { message: error.message }), "error");
    }
  }

  selectFindNext() {
    const next = this.findService.next();
    const state = this.stateStore.getState();
    this.stateStore.update({ find: { ...state.find, activeIndex: this.findService.activeIndex } });
    if (next) { this.jumpToCell(next); }
  }

  selectFindPrev() {
    const prev = this.findService.prev();
    const state = this.stateStore.getState();
    this.stateStore.update({ find: { ...state.find, activeIndex: this.findService.activeIndex } });
    if (prev) { this.jumpToCell(prev); }
  }

  selectFindIndex(idx) {
    const item = this.findService.setActiveResult(idx);
    const state = this.stateStore.getState();
    this.stateStore.update({ find: { ...state.find, activeIndex: this.findService.activeIndex } });
    if (item) { this.jumpToCell(item); }
  }

  async runReplaceOne(payload) {
    const result = this.findService.getActiveResult();
    const state = this.stateStore.getState();
    await this.replaceService.replaceOne({ result, ...payload });
    await this.calcFacade.recalcAfterMassEdit(this.currentWorkbook, this.stateStore.getState().edits);
    await this.qcFacade.runScan(this.currentWorkbook);
    this.stateStore.update({ audit: { recent: this.auditLog.getRecent(50) }, find: { ...state.find } });
  }

  async runReplaceAll(payload) {
    const state = this.stateStore.getState();
    await this.replaceService.replaceAll({ results: state.find.results || [], ...payload, scope: payload.scope });
    await this.calcFacade.recalcAfterMassEdit(this.currentWorkbook, this.stateStore.getState().edits);
    await this.qcFacade.runScan(this.currentWorkbook);
    this.stateStore.update({ audit: { recent: this.auditLog.getRecent(50) } });
  }

  async runPasteSpecial() {
    const text = await navigator.clipboard?.readText?.().catch(() => "");
    if (!text) {
      this.toast.show(this.i18n.t("appMessages.clipboardEmpty"), "error");
      return;
    }

    const options = await this.pasteSpecialDialog.open();
    if (!options) { return; }

    const matrix = text.replace(/\r\n/g, "\n").split("\n").filter((line, idx, all) => !(idx === all.length - 1 && line === "")).map((line) => line.split("\t"));
    const sel = this.stateStore.getState().editor.selection?.range;
    if (!sel) { return; }
    await this.pasteApplyService.apply({ targetRange: sel, matrix, options });
    await this.calcFacade.recalcAfterMassEdit(this.currentWorkbook, this.stateStore.getState().edits);
    await this.qcFacade.runScan(this.currentWorkbook);
  }

  async runSchemaEditor() {
    const effective = this.configStore.getEffectiveSchema();
    await this.schemaEditorDialog.open({
      json: effective.json,
      onValidate: (json) => this.configStore.validateSchema(json),
      onApply: async (json) => { await this.configStore.setOverrideSchema(json); await this.loadSchema(); this.auditLog.add({ ts: Date.now(), userAction: "configApply", sheetName: "schema", addressA1: "version", before: "", after: String(json.schemaVersion || 1) }); this.stateStore.update({ audit: { recent: this.auditLog.getRecent(50) } }); },
      onRevert: async () => { await this.configStore.clearOverrides(); await this.loadSchema(); await this.loadBindingMap(); }
    });
  }

  async runBindingsEditor() {
    const effective = this.configStore.getEffectiveBindings();
    await this.bindingsEditorDialog.open({
      json: effective.json,
      onValidate: (json) => this.configStore.validateBindings(json),
      onApply: async (json) => { await this.configStore.setOverrideBindings(json); await this.loadBindingMap(); this.auditLog.add({ ts: Date.now(), userAction: "configApply", sheetName: "bindings", addressA1: "version", before: "", after: String(json.version || 1) }); this.stateStore.update({ audit: { recent: this.auditLog.getRecent(50) } }); },
      onRevert: async () => { await this.configStore.clearOverrides(); await this.loadSchema(); await this.loadBindingMap(); }
    });
  }

  shouldShowDevtools() {
    const qs = new URLSearchParams(window.location.search);
    return import.meta.env.DEV || qs.get("devtools") === "1";
  }

  mountChaosPanel() {
    if (this.chaosPanel) {
      return;
    }
    const host = document.createElement("div");
    host.className = "dialog-backdrop";
    host.style.alignItems = "start";
    host.style.paddingTop = "48px";
    const shell = document.createElement("div");
    host.appendChild(shell);
    this.layoutRefs.modalRoot.appendChild(host);
    this.chaosPanel = new ChaosPanel(shell, this.chaosService, { i18n: this.i18n });
    this.chaosPanel.mount();
  }

  jumpToCell(item) { const state = this.stateStore.getState(); const sheet = state.workbook.sheets.find((s) => s.name === item.sheetName); if (!sheet) { return; } this.stateStore.update({ workbook: { activeSheetId: sheet.id }, editor: { selection: { sheetId: sheet.id, addressA1: item.addressA1, anchorAddressA1: item.addressA1, focusAddressA1: item.addressA1, range: null, mode: "cell" }, editMode: false } }); this.eventBus.emit("SHEET_SELECTED", { sheetId: sheet.id }); setTimeout(() => { this.eventBus.emit("EDITOR_SELECT_ADDRESS", { addressA1: item.addressA1 }); this.sheetGridView.scrollCellIntoView(item.addressA1); }, 0); }

  async reset() { const ok = await this.confirmDialog.open({ title: this.i18n.t("dialog.resetTitle"), message: this.i18n.t("dialog.resetMessage"), confirmText: this.i18n.t("dialog.resetConfirm") }); if (!ok) { return; } await this.idbStore.clearAll(); await this.templateBufferStore.clear(); this.calcEngine.destroy(); this.undoStack.clear(); this.auditLog.clear(); this.currentWorkbook = null; const model = TkpModel.createDefault(); this.assemblyRegistry.setModel(model); this.stateStore.replace(createInitialState()); this.cellEditorOverlay.close(); }

  async loadDefaultAssetFromEmptyState() {
    try {
      await this.pipeline.loadFromAsset(import.meta.env.BASE_URL);
    } catch {
      this.stateStore.update({ boot: { phase: "ERROR" } });
    }
  }

  assertNotAborted(signal) { if (signal?.aborted) { throw new Error("Задача прервана"); } }
}



