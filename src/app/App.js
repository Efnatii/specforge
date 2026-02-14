import { saveAs } from "file-saver";
import { EventBus } from "../core/EventBus.js";
import { StateStore, STATE_CHANGED } from "../core/StateStore.js";
import { JobQueue } from "../core/JobQueue.js";
import { IdbStore } from "../core/IdbStore.js";
import { Scheduler } from "../core/Scheduler.js";
import { TemplateLoader } from "../xlsx/TemplateLoader.js";
import { WorkbookAdapter } from "../xlsx/WorkbookAdapter.js";
import { TemplateBufferStore } from "../xlsx/TemplateBufferStore.js";
import { TemplateFingerprint } from "../xlsx/TemplateFingerprint.js";
import { WorkbookExporter } from "../xlsx/WorkbookExporter.js";
import { WorkbookImporter } from "../xlsx/WorkbookImporter.js";
import { SheetFactory } from "../xlsx/SheetFactory.js";
import { Layout } from "../ui/Layout.js";
import { Toolbar } from "../ui/Toolbar.js";
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
import { AppHotkeys } from "./AppHotkeys.js";
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

const CACHE_SNAPSHOT_KEY = "lastSnapshot";
const CACHE_WORKBOOK_KEY = "lastWorkbook";
const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
const emptyQc = { ts: 0, summary: { errorsCount: 0, warningsCount: 0 }, items: [] };

function createInitialState() {
  return { boot: { phase: "BOOT" }, template: { source: null, name: null, loadedAtTs: null, bufferHash: null, structureFingerprint: null }, workbook: { sheets: [], activeSheetId: null }, render: { zoom: 1 }, jobs: {}, editor: { selection: { sheetId: null, addressA1: null, anchorAddressA1: null, focusAddressA1: null, range: null, mode: "cell" }, editMode: false, lastError: null, errors: {} }, edits: {}, audit: { recent: [] }, calc: { perSheet: {} }, qc: { report: emptyQc }, tkp: TkpModel.createDefault(), find: { needle: "", replace: "", scope: "sheet", matchCase: false, wholeCell: false, useRegex: false, results: [], activeIndex: -1 }, exportMeta: { orderNo: "0091-0821", requestNo: "0254", title: "КП Общая", modifiedDate: today() }, warnings: [] };
}

export class App {
  constructor(rootElement) {
    this.currentWorkbook = null; this.templateSchema = new TemplateSchema(); this.eventBus = new EventBus(); this.stateStore = new StateStore(this.eventBus, createInitialState()); this.jobQueue = new JobQueue({ stateStore: this.stateStore, maxAttempts: 2 }); this.scheduler = new Scheduler();
    this.idbStore = new IdbStore(); this.templateLoader = new TemplateLoader(); this.workbookAdapter = new WorkbookAdapter(); this.templateBufferStore = new TemplateBufferStore(this.idbStore); this.templateFingerprint = new TemplateFingerprint(); this.workbookExporter = new WorkbookExporter(); this.workbookImporter = new WorkbookImporter({ templateLoader: this.templateLoader, workbookAdapter: this.workbookAdapter, templateFingerprint: this.templateFingerprint, templateSchema: this.templateSchema }); this.sheetFactory = new SheetFactory(this.workbookAdapter);
    this.layout = new Layout(rootElement); this.layoutRefs = this.layout.render(); this.toast = new Toast(this.layoutRefs.toastRoot);
    this.toolbar = new Toolbar(this.layoutRefs.toolbarHost, this.toolbarCallbacks()); this.toolbar.render(); this.sheetTabs = new SheetTabs({ container: this.layoutRefs.tabs, eventBus: this.eventBus }); this.sheetGridView = new SheetGridView({ container: this.layoutRefs.viewport });
    this.progressPanel = new ProgressPanel({ container: document.createElement("div"), onCancel: (id) => this.jobQueue.cancel(id) }); this.changesPanel = new ChangesPanel(document.createElement("div")); this.qcPanel = new QcPanel(document.createElement("div"), { onJumpToCell: (i) => this.jumpToCell(i), onScan: () => this.qcFacade.runScan(this.currentWorkbook), onExportCsv: () => this.qcFacade.exportCsv(), onExportXlsx: () => this.qcFacade.exportXlsx() }); this.findPanel = new FindPanel(document.createElement("div"), { onSearch: (query) => this.runFind(query), onPrev: () => this.selectFindPrev(), onNext: () => this.selectFindNext(), onReplaceOne: (payload) => this.runReplaceOne(payload), onReplaceAll: (payload) => this.runReplaceAll(payload), onSelect: (idx) => this.selectFindIndex(idx) }); this.rightPanel = new RightPanel({ root: this.layoutRefs.rightPanelHost, progressPanel: this.progressPanel, changesPanel: this.changesPanel, qcPanel: this.qcPanel, findPanel: this.findPanel });
    this.confirmDialog = new ConfirmDialog(this.layoutRefs.modalRoot); this.addAssemblyDialog = new AddAssemblyDialog(this.layoutRefs.modalRoot); this.importModeDialog = new ImportModeDialog(this.layoutRefs.modalRoot); this.autoFillPreviewDialog = new AutoFillPreviewDialog(this.layoutRefs.modalRoot); this.printPreviewDialog = new PrintPreviewDialog(this.layoutRefs.modalRoot); this.printService = new PrintService({ printPreviewDialog: this.printPreviewDialog }); this.pasteSpecialDialog = new PasteSpecialDialog(this.layoutRefs.modalRoot); this.schemaEditorDialog = new SchemaEditorDialog(this.layoutRefs.modalRoot); this.bindingsEditorDialog = new BindingsEditorDialog(this.layoutRefs.modalRoot);
    this.cellEditorOverlay = new CellEditorOverlay({ container: this.layoutRefs.viewport }); this.undoStack = new UndoStack(200); this.auditLog = new AuditLog(300); this.valueParser = new ValueParser(); this.editorStateDriver = new EditorStateDriver({ stateStore: this.stateStore, idbStore: this.idbStore, getWorkbook: () => this.currentWorkbook, auditLog: this.auditLog }); this.clipboardService = new ClipboardService({ toast: this.toast }); this.tableRangeManager = null; this.rowShiftService = new RowShiftService({ templateSchema: this.templateSchema, getWorkbook: () => this.currentWorkbook, getEdits: () => this.stateStore.getState().edits }); this.configStore = new ConfigStore({ idbStore: this.idbStore, baseUrl: import.meta.env.BASE_URL }); this.findIndexBuilder = new FindIndexBuilder(); this.findService = new FindService();
    this.calcEngine = new CalcEngine({ eventBus: this.eventBus, stateStore: this.stateStore }); this.calcFacade = new CalcFacade({ calcEngine: this.calcEngine, stateStore: this.stateStore, jobQueue: this.jobQueue, toast: this.toast, templateSchema: this.templateSchema, eventBus: this.eventBus }); this.qcFacade = new QcFacade({ qcService: new QcService(), qcExporter: new QcExporter(), stateStore: this.stateStore, jobQueue: this.jobQueue, toast: this.toast, templateSchema: this.templateSchema });
    this.bindingMap = new BindingMap(); this.tableRangeManager = new TableRangeManager({ bindingMap: this.bindingMap }); this.tkpSyncService = new TkpSyncService(this.bindingMap); this.assemblyRegistry = new AssemblyRegistry({ eventBus: this.eventBus, idbStore: this.idbStore, scheduler: this.scheduler }); this.autoFillService = new AutoFillService({ tkpSyncService: this.tkpSyncService, auditLog: this.auditLog, scheduler: this.scheduler, ensureAssemblyPair: (abbr) => this.ensureAssemblyPair(abbr) });
    this.editorController = new EditorController({ eventBus: this.eventBus, stateStore: this.stateStore, templateSchema: this.templateSchema, gridView: this.sheetGridView, cellEditorOverlay: this.cellEditorOverlay, undoStack: this.undoStack, valueParser: this.valueParser, toast: this.toast, getWorkbook: () => this.currentWorkbook, stateDriver: this.editorStateDriver, onCellCommitted: (p) => this.handleCellCommitted(p), jobQueue: this.jobQueue, clipboardService: this.clipboardService, tableRangeManager: this.tableRangeManager, rowShiftService: this.rowShiftService });
    this.pasteApplyService = new PasteApplyService({ templateSchema: this.templateSchema, valueParser: this.valueParser, stateDriver: this.editorStateDriver, undoStack: this.undoStack, getWorkbook: () => this.currentWorkbook, getState: () => this.stateStore.getState(), onCellCommitted: (p) => this.handleCellCommitted(p), jobQueue: this.jobQueue, toast: this.toast });
    this.replaceService = new ReplaceService({ templateSchema: this.templateSchema, valueParser: this.valueParser, stateDriver: this.editorStateDriver, undoStack: this.undoStack, getWorkbook: () => this.currentWorkbook, getState: () => this.stateStore.getState(), onCellCommitted: (p) => this.handleCellCommitted(p), jobQueue: this.jobQueue, toast: this.toast });
    this.appHotkeys = new AppHotkeys({ root: this.layoutRefs.viewport, handlers: { onUndo: () => this.editorController.undo(), onRedo: () => this.editorController.redo(), onInsertRow: () => this.editorController.insertRowInTable(), onDeleteRow: () => this.editorController.deleteRowInTable(), onPasteSpecial: () => this.runPasteSpecial() } });
    this.pipeline = new WorkbookPipeline({ jobQueue: this.jobQueue, templateLoader: this.templateLoader, workbookAdapter: this.workbookAdapter, onBeforeLoad: () => this.stateStore.update({ boot: { phase: "LOADING_TEMPLATE" } }), onAfterLoad: async (wb, meta, buffer) => this.installBaseline(wb, buffer, meta, true), onError: (e) => this.toast.show(`Load failed: ${e.message}`, "error", 5000), assertNotAborted: (signal) => this.assertNotAborted(signal) });
  }

  async start() {
    this.bindEvents(); this.editorController.start(); this.appHotkeys.bind(); this.render(this.stateStore.getState()); await this.configStore.init(); await this.loadSchema(); await this.loadBindingMap(); const model = await this.assemblyRegistry.restore().catch(() => TkpModel.createDefault()); this.stateStore.update({ tkp: model });
    if (await this.tryRestoreFromCache()) { await this.restoreEdits(); await this.calcFacade.buildCalcModel(this.currentWorkbook, this.stateStore.getState().edits); return; }
    try { await this.pipeline.loadFromAsset(import.meta.env.BASE_URL); } catch { this.stateStore.update({ boot: { phase: "ERROR" } }); }
  }

  bindEvents() {
    this.eventBus.on("SHEET_SELECTED", async ({ sheetId }) => { this.stateStore.update({ workbook: { activeSheetId: sheetId }, editor: { editMode: false, selection: { sheetId, addressA1: null, anchorAddressA1: null, focusAddressA1: null, range: null, mode: "cell" } } }); await this.persistSnapshot(); });
    this.eventBus.on("ASSEMBLIES_CHANGED", (model) => this.stateStore.update({ tkp: model }));
    this.eventBus.on(STATE_CHANGED, (state) => this.render(state));
    this.rightPanel.setAssemblyHandlers({ onAssemblyChange: (abbr, patch) => this.assemblyRegistry.updateAssembly(abbr, patch), onAssemblyAction: (action, selected) => this.handleAssemblyAction(action, selected) });
  }

  render(state) {
    this.layout.updateHeader(state); this.toolbar.setExportMeta(state.exportMeta); this.toolbar.setAvailability({ hasBaseline: Boolean(this.templateBufferStore.getBaselineBuffer()) }); this.sheetTabs.render(state.workbook.sheets, state.workbook.activeSheetId);
    const activeName = state.workbook.sheets.find((s) => s.id === state.workbook.activeSheetId)?.name; const qcWarnings = (state.qc.report?.items || []).filter((i) => i.sheetName === activeName);
    this.sheetGridView.render(this.currentWorkbook, state.workbook.activeSheetId, state.render.zoom, state.edits[state.workbook.activeSheetId] || {}, state.editor, state.calc.perSheet?.[activeName] || {}, qcWarnings);
    const fmtWarnings = this.sheetGridView.takeNumFmtWarnings(); if (fmtWarnings.length) { const set = new Set(state.warnings || []); const add = fmtWarnings.filter((w) => !set.has(w)); if (add.length) { this.stateStore.update({ warnings: [...state.warnings, ...add].slice(-120) }); } }
    this.rightPanel.render({ jobs: state.jobs, changes: state.audit.recent, qcReport: state.qc.report, sheets: state.workbook.sheets, tkpModel: state.tkp, findState: state.find });
  }

  toolbarCallbacks() {
    return { onLoadFile: () => this.toolbar.openLoadPicker(), onLoadFilePicked: async (f) => { try { await this.pipeline.loadFromFile(f); } catch {} }, onReset: async () => this.reset(), onExport: async () => this.runExport(), onImportUpdate: () => this.toolbar.openImportUpdatePicker(), onImportUpdatePicked: async (f) => this.runImportUpdate(f), onImportReplace: () => this.toolbar.openImportReplacePicker(), onImportReplacePicked: async (f) => this.runImportReplace(f), onAddAssembly: async () => this.runAddAssembly(), onAutoFillPreview: async () => this.runAutoFillPreview(), onWorkbookToModelPreview: async () => this.runWorkbookToModelPreview(), onPrintPreview: async () => this.runPrintPreviewFlow(), onFindPanelToggle: () => { this.rightPanel.activeTab = "find"; this.rightPanel.applyTabVisibility(); }, onPasteSpecial: async () => this.runPasteSpecial(), onEditSchema: async () => this.runSchemaEditor(), onEditBindings: async () => this.runBindingsEditor(), onExportMetaChanged: (exportMeta) => { this.stateStore.update({ exportMeta }); this.assemblyRegistry.setModel({ ...this.assemblyRegistry.getModel(), meta: { ...this.assemblyRegistry.getModel().meta, ...exportMeta } }); } };
  }

  async loadBindingMap() { const effective = this.configStore.getEffectiveBindings(); this.bindingMap = effective.bindings; this.tableRangeManager = new TableRangeManager({ bindingMap: this.bindingMap }); this.editorController.tableRangeManager = this.tableRangeManager; this.tkpSyncService = new TkpSyncService(this.bindingMap); this.autoFillService.tkpSyncService = this.tkpSyncService; }

  async installBaseline(workbook, buffer, meta, clearEdits) { const hash = await this.templateFingerprint.hashBufferSha256(buffer); const structureFingerprint = this.templateFingerprint.buildStructureFingerprint(workbook); await this.templateBufferStore.setBaselineBuffer(buffer, meta); this.currentWorkbook = workbook; const sheets = workbook.sheets.map((s) => ({ id: s.id, name: s.name })); const activeSheetId = sheets[0]?.id || null; const patch = { template: { ...meta, loadedAtTs: meta.loadedAtTs || Date.now(), bufferHash: hash, structureFingerprint }, workbook: { sheets, activeSheetId }, warnings: workbook.warnings || [], editor: { selection: { sheetId: activeSheetId, addressA1: null, anchorAddressA1: null, focusAddressA1: null, range: null, mode: "cell" }, editMode: false, lastError: null, errors: {} }, calc: { perSheet: {} }, qc: { report: emptyQc } }; if (clearEdits) { this.undoStack.clear(); this.auditLog.clear(); await this.editorStateDriver.clearPersistedEdits(); Object.assign(patch, { edits: {}, audit: { recent: [] } }); } this.stateStore.update(patch); await this.persistSnapshot(); await this.calcFacade.buildCalcModel(this.currentWorkbook, this.stateStore.getState().edits); await this.qcFacade.runScan(this.currentWorkbook); this.stateStore.update({ boot: { phase: "READY" } }); }

  handleCellCommitted({ sheetName, addressA1, value }) { this.calcFacade.onCellCommitted({ sheetName, addressA1, value }); this.qcFacade.runLightForCell(this.currentWorkbook, sheetName, addressA1); }

  async runPrintPreviewFlow() {
    const baseline = this.templateBufferStore.getBaselineBuffer(); const state = this.stateStore.getState(); if (!baseline || !this.currentWorkbook) { this.toast.show("Load workbook first", "error"); return; }
    const payload = await this.printService.openDialog({ templates: PrintTemplates.list(), sheets: state.workbook.sheets, assemblies: state.tkp.assemblies, defaults: { templateId: "TEMPLATE_ALL" } }); if (!payload) { return; }
    const { promise } = this.jobQueue.enqueue({ type: "BUILD_PRINT_DOC", title: "Build print document", run: async (_, signal, progress) => this.printService.buildPrintDoc({ baselineBuffer: baseline.buffer, workbookSnapshot: this.currentWorkbook, edits: state.edits, calcSnapshot: state.calc, ...payload, signal, reportProgress: progress }) });
    try { const doc = await promise; if (payload.mode === "preview") { this.printService.preview(this.layoutRefs.modalRoot, doc.htmlString); } else { this.printService.print(doc.htmlString); } } catch (e) { this.toast.show(`Print build failed: ${e.message}`, "error"); }
  }

  async runAutoFillPreview() { if (!this.currentWorkbook) { return; } const plan = await this.autoFillService.preview("ACTION_SYNC_MODEL_TO_WORKBOOK", { tkpModel: this.stateStore.getState().tkp, workbookSnapshot: this.currentWorkbook, editsOverlay: this.stateStore.getState().edits }); const ok = await this.autoFillPreviewDialog.open(plan); if (!ok) { return; } const nextEdits = this.autoFillService.apply(plan, { workbookSnapshot: this.currentWorkbook, currentEdits: this.stateStore.getState().edits, actionId: "autofill:sync_model_to_workbook" }); this.stateStore.update({ edits: nextEdits, audit: { recent: this.auditLog.getRecent(50) } }); await this.idbStore.put("workbookEdits", nextEdits); await this.calcFacade.recalcAfterMassEdit(this.currentWorkbook, nextEdits); await this.qcFacade.runScan(this.currentWorkbook); }

  async runWorkbookToModelPreview() {
    if (!this.currentWorkbook) { return; }
    const preview = await this.autoFillService.preview("ACTION_SYNC_WORKBOOK_TO_MODEL", { workbookSnapshot: this.currentWorkbook, editsOverlay: this.stateStore.getState().edits });
    const diffs = this.buildModelDiffChanges(this.stateStore.getState().tkp, preview.modelDraft);
    const plan = { title: "Workbook -> Model Preview", changes: diffs, stats: { cellsChanged: diffs.length } };
    const ok = await this.autoFillPreviewDialog.open(plan);
    if (ok) { this.assemblyRegistry.setModel(preview.modelDraft); this.toast.show("Model updated from workbook", "success"); }
  }

  buildModelDiffChanges(prev, next) {
    const out = []; for (const key of ["orderNo", "requestNo", "modifiedDate"]) { if (String(prev.meta?.[key] || "") !== String(next.meta?.[key] || "")) { out.push({ sheetName: "Model", addressA1: key, before: prev.meta?.[key] || null, after: next.meta?.[key] || null, reason: "meta change" }); } } const byAbbrPrev = new Map((prev.assemblies || []).map((a) => [a.abbr, a])); const byAbbrNext = new Map((next.assemblies || []).map((a) => [a.abbr, a])); for (const [abbr, n] of byAbbrNext.entries()) { const p = byAbbrPrev.get(abbr); if (!p) { out.push({ sheetName: "Model", addressA1: abbr, before: null, after: n.name, reason: "assembly add" }); continue; } for (const k of ["name", "qty", "unit", "comment", "include"]) { if (String(p[k] ?? "") !== String(n[k] ?? "")) { out.push({ sheetName: "Model", addressA1: `${abbr}.${k}`, before: p[k] ?? null, after: n[k] ?? null, reason: "assembly change" }); } } } return out;
  }

  async handleAssemblyAction(action, selectedAbbr) {
    if (action === "add") { this.assemblyRegistry.addAssembly({}); return; }
    if (action === "remove" && selectedAbbr) { this.assemblyRegistry.removeAssembly(selectedAbbr); return; }
    if (action === "duplicate" && selectedAbbr) { this.assemblyRegistry.duplicateAssembly(selectedAbbr); return; }
    if (action === "sync_preview") { await this.runAutoFillPreview(); }
  }

  async ensureAssemblyPair(abbr) { const names = (this.currentWorkbook?.sheets || []).map((s) => s.name); if (names.includes(abbr) && names.includes(`Расход. мат. ${abbr}`)) { return; } const baseline = this.templateBufferStore.getBaselineBuffer(); if (!baseline) { return; } const { promise } = this.jobQueue.enqueue({ type: "ADD_ASSEMBLY_SHEETS", title: `Ensure assembly ${abbr}`, run: async (_, signal, progress) => { this.assertNotAborted(signal); progress({ completed: 0, total: 3, message: "Clone" }); const res = await this.sheetFactory.addAssemblyPair({ baselineBuffer: baseline.buffer, abbr }); progress({ completed: 1, total: 3, message: "Write" }); progress({ completed: 2, total: 3, message: "Parse" }); return res; } }); const res = await promise; await this.installBaseline(res.normalizedWorkbook, res.newBaselineBuffer, { source: "generated", name: `assembly:${abbr}`, loadedAtTs: Date.now() }, false); }

  async runExport() { const baseline = this.templateBufferStore.getBaselineBuffer(); if (!baseline) { return; } const s = this.stateStore.getState(); const { promise } = this.jobQueue.enqueue({ type: "EXPORT_XLSX", title: "Export XLSX", run: async (_, signal, p) => { this.assertNotAborted(signal); p({ completed: 0, total: 4, message: "Load baseline" }); const w=[]; p({ completed: 1, total: 4, message: "Apply edits" }); const result = await this.workbookExporter.export({ baselineBuffer: baseline.buffer, edits: s.edits, sheets: s.workbook.sheets, exportMeta: s.exportMeta, reportWarning: (x) => w.push(x) }); p({ completed: 2, total: 4, message: "Write buffer" }); saveAs(new Blob([result.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), result.fileName); p({ completed: 3, total: 4, message: "Download" }); return w; } }); try { const warns = await promise; if (warns.length) { this.stateStore.update({ warnings: [...this.stateStore.getState().warnings, ...warns].slice(-80) }); } } catch (e) { this.toast.show(`Export failed: ${e.message}`, "error"); } }

  async runImportReplace(file) { const { promise } = this.jobQueue.enqueue({ type: "IMPORT_REPLACE_TEMPLATE", title: "Import replace template", run: async (_, signal, p) => this.workbookImporter.importReplaceTemplate(file, signal, p) }); try { const r = await promise; await this.installBaseline(r.normalizedWorkbook, r.buffer, { source: "file", name: file.name, loadedAtTs: Date.now() }, true); } catch (e) { this.toast.show(`Import replace failed: ${e.message}`, "error"); } }

  async runImportUpdate(file) { const baseline = this.templateBufferStore.getBaselineBuffer(); if (!baseline) { return; } const s = this.stateStore.getState(); const { promise } = this.jobQueue.enqueue({ type: "IMPORT_AS_EDITS", title: "Import as edits", run: async (_, signal, p) => this.workbookImporter.importAsEdits(file, { baselineBuffer: baseline.buffer, baselineStructureFingerprint: s.template.structureFingerprint, workbookSheets: s.workbook.sheets }, signal, p) }); try { const r = await promise; if (!r.compatible) { const m = await this.importModeDialog.open({ reason: r.reason, softTagFound: r.softTagFound }); if (m === "replace") { await this.runImportReplace(file); } return; } this.stateStore.update({ edits: r.nextEdits }); await this.idbStore.put("workbookEdits", r.nextEdits); await this.calcFacade.recalcAfterMassEdit(this.currentWorkbook, r.nextEdits); await this.qcFacade.runScan(this.currentWorkbook); } catch (e) { this.toast.show(`Import update failed: ${e.message}`, "error"); } }

  async runAddAssembly() { const payload = await this.addAssemblyDialog.open(); if (!payload) { return; } await this.ensureAssemblyPair(payload.abbr); this.assemblyRegistry.addAssembly({ abbr: payload.abbr, name: payload.displayName || payload.abbr, qty: 1, include: true }); }

  async loadSchema() { const { promise } = this.jobQueue.enqueue({ type: "LOAD_SCHEMA_ASSET", title: "Load template schema", run: async (_, signal, p) => { this.assertNotAborted(signal); p({ completed: 0, total: 1, message: "Loading schema" }); const s = this.configStore.getEffectiveSchema().schema; p({ completed: 1, total: 1, message: "Schema ready" }); return s; } }); this.templateSchema = await promise.catch(() => new TemplateSchema()); this.workbookImporter.templateSchema = this.templateSchema; this.editorController.templateSchema = this.templateSchema; this.rowShiftService.templateSchema = this.templateSchema; this.pasteApplyService.templateSchema = this.templateSchema; this.replaceService.templateSchema = this.templateSchema; this.calcFacade.templateSchema = this.templateSchema; this.qcFacade.templateSchema = this.templateSchema; }

  async restoreEdits() { await this.editorStateDriver.restoreEdits().catch(() => null); }

  async tryRestoreFromCache() { const [snapshot, workbook, baseline] = await Promise.all([this.idbStore.get(CACHE_SNAPSHOT_KEY), this.idbStore.get(CACHE_WORKBOOK_KEY), this.templateBufferStore.restore()]).catch(() => [null, null, null]); if (!snapshot || !workbook?.sheets?.length) { return false; } this.currentWorkbook = workbook; const fp = snapshot.template?.structureFingerprint || this.templateFingerprint.buildStructureFingerprint(workbook); this.stateStore.update({ ...snapshot, template: { ...snapshot.template, structureFingerprint: fp, ...(baseline?.meta || {}) }, calc: { perSheet: {} }, qc: { report: emptyQc }, editor: { ...(snapshot.editor || {}), errors: snapshot.editor?.errors || {} }, tkp: this.assemblyRegistry.getModel() }); return true; }

  async persistSnapshot() { const s = this.stateStore.getState(); await this.idbStore.set(CACHE_SNAPSHOT_KEY, { boot: { phase: s.boot.phase }, template: s.template, workbook: s.workbook, render: s.render, exportMeta: s.exportMeta, editor: { errors: s.editor.errors }, tkp: s.tkp }); if (this.currentWorkbook) { await this.idbStore.set(CACHE_WORKBOOK_KEY, this.currentWorkbook); } }

  async runFind(query) {
    if (!this.currentWorkbook) { return; }
    const state = this.stateStore.getState();
    const activeSheetName = state.workbook.sheets.find((s) => s.id === state.workbook.activeSheetId)?.name || null;
    const { promise } = this.jobQueue.enqueue({ type: "BUILD_FIND_INDEX", title: "Build find index", run: async (_, signal, progress) => this.findIndexBuilder.buildIndex({ scope: query.scope, normalizedWorkbook: this.currentWorkbook, edits: state.edits, calcSnapshot: state.calc, activeSheetName, signal, reportProgress: progress }) });
    const index = await promise;
    this.findService.setIndex(index);
    const results = this.findService.query({ ...query, sheetName: query.scope === "sheet" ? activeSheetName : null });
    this.stateStore.update({ find: { ...state.find, ...query, results, activeIndex: this.findService.activeIndex } });
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
      this.toast.show("Clipboard is empty", "error");
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

  jumpToCell(item) { const state = this.stateStore.getState(); const sheet = state.workbook.sheets.find((s) => s.name === item.sheetName); if (!sheet) { return; } this.stateStore.update({ workbook: { activeSheetId: sheet.id }, editor: { selection: { sheetId: sheet.id, addressA1: item.addressA1, anchorAddressA1: item.addressA1, focusAddressA1: item.addressA1, range: null, mode: "cell" }, editMode: false } }); this.eventBus.emit("SHEET_SELECTED", { sheetId: sheet.id }); setTimeout(() => { this.eventBus.emit("EDITOR_SELECT_ADDRESS", { addressA1: item.addressA1 }); this.sheetGridView.scrollCellIntoView(item.addressA1); }, 0); }

  async reset() { const ok = await this.confirmDialog.open({ title: "Reset", message: "Clear workbook, baseline and edits?", confirmText: "Reset" }); if (!ok) { return; } await this.idbStore.clearAll(); await this.templateBufferStore.clear(); this.calcEngine.destroy(); this.undoStack.clear(); this.auditLog.clear(); this.currentWorkbook = null; const model = TkpModel.createDefault(); this.assemblyRegistry.setModel(model); this.stateStore.replace(createInitialState()); this.cellEditorOverlay.close(); }

  assertNotAborted(signal) { if (signal?.aborted) { throw new Error("Job aborted"); } }
}
