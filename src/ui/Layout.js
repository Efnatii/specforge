import { CadShell } from "./layout/CadShell.js";

function hasEdits(edits = {}) {
  return Object.values(edits).some((sheetEdits) => Object.keys(sheetEdits || {}).length > 0);
}

function summarizeJobs(jobs = {}) {
  const list = Object.values(jobs);
  const running = list.filter((job) => job.status === "RUNNING" || job.status === "QUEUED").length;
  return { running, total: list.length };
}

export class Layout {
  constructor(root, options = {}) {
    this.root = root;
    this.i18n = options.i18n;
    this.registry = options.registry;
    this.menuConfig = options.menuConfig || [];
    this.ribbonTabs = options.ribbonTabs || [];
    this.layoutState = options.layoutState;
    this.onLayoutChange = options.onLayoutChange;
    this.onOpenFile = options.onOpenFile;
    this.onLoadDefaultAsset = options.onLoadDefaultAsset;
    this.onZoomIn = options.onZoomIn;
    this.onZoomOut = options.onZoomOut;
    this.refs = {};
  }

  render() {
    this.shell = new CadShell(this.root, {
      i18n: this.i18n,
      registry: this.registry,
      menuConfig: this.menuConfig,
      ribbonTabs: this.ribbonTabs,
      layoutState: this.layoutState,
      onLayoutChange: this.onLayoutChange,
      onOpenFile: this.onOpenFile,
      onZoomIn: this.onZoomIn,
      onZoomOut: this.onZoomOut
    });

    this.refs = this.shell.render();
    return this.refs;
  }

  updateHeader(state) {
    const sheets = state.workbook?.sheets || [];
    const activeSheet = sheets.find((sheet) => sheet.id === state.workbook?.activeSheetId);

    this.shell.renderRibbon(state);
    this.shell.updateMeta({ activeSheetName: activeSheet?.name, zoom: state.render?.zoom || 1 });
    this.shell.updateStatus({
      templateName: state.template?.name,
      hasUnsavedChanges: hasEdits(state.edits),
      jobsSummary: summarizeJobs(state.jobs),
      zoom: state.render?.zoom,
      activeCell: state.editor?.selection?.addressA1
    });

    const hasWorkbook = sheets.length > 0;
    this.shell.updateEmptyState(!hasWorkbook);
  }

  renderQuickAccess(commands) {
    this.shell.renderQuickAccess(commands);
  }

  openCommandSearch() {
    this.shell.openCommandSearch();
  }
}
