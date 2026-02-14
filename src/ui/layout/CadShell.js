import { Icon } from "../common/Icon.js";
import { TopMenuBar } from "./TopMenuBar.js";
import { RibbonBar } from "./RibbonBar.js";
import { DockPanel } from "./DockPanel.js";
import { Splitter } from "./Splitter.js";
import { StatusBar } from "./StatusBar.js";
import { CommandSearch } from "../command/CommandSearch.js";

const MIN_DOCK = 180;
const MAX_LEFT = 460;
const MAX_RIGHT = 520;

export class CadShell {
  constructor(root, options = {}) {
    this.root = root;
    this.i18n = options.i18n;
    this.registry = options.registry;
    this.menuConfig = options.menuConfig || [];
    this.ribbonTabs = options.ribbonTabs || [];
    this.layoutState = options.layoutState || { leftDockWidth: 260, rightDockWidth: 360 };
    this.onLayoutChange = options.onLayoutChange;
    this.onOpenFile = options.onOpenFile;
    this.onZoomIn = options.onZoomIn;
    this.onZoomOut = options.onZoomOut;
    this.refs = {};
  }

  render() {
    this.root.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "cad-shell";

    const topMenuHost = document.createElement("div");
    topMenuHost.className = "cad-top-menu-host";

    const ribbonLine = document.createElement("div");
    ribbonLine.className = "cad-ribbon-line";

    const quickAccess = document.createElement("div");
    quickAccess.className = "cad-quick-access";

    const ribbonHost = document.createElement("div");
    ribbonHost.className = "cad-ribbon-host";

    const commandSearchHost = document.createElement("div");
    commandSearchHost.className = "cad-command-search-host";

    ribbonLine.append(quickAccess, ribbonHost, commandSearchHost);

    const body = document.createElement("div");
    body.className = "cad-body";

    const leftDockWrap = document.createElement("aside");
    leftDockWrap.className = "cad-left-dock-wrap";

    const leftSplitter = document.createElement("div");
    leftSplitter.className = "dock-splitter";

    const centerWrap = document.createElement("main");
    centerWrap.className = "cad-center";

    const workspaceHeader = document.createElement("div");
    workspaceHeader.className = "workspace-header";

    const workspaceMeta = document.createElement("div");
    workspaceMeta.className = "workspace-meta";

    const workspaceName = document.createElement("span");
    workspaceName.className = "workspace-name";

    const workspaceMode = document.createElement("span");
    workspaceMode.className = "workspace-mode";

    workspaceMeta.append(workspaceName, workspaceMode);

    const workspaceActions = document.createElement("div");
    workspaceActions.className = "workspace-actions";
    workspaceActions.appendChild(this.makeIconButton("zoom-out", "status.zoomOut", () => this.onZoomOut?.()));
    workspaceActions.appendChild(this.makeIconButton("zoom-in", "status.zoomIn", () => this.onZoomIn?.()));

    workspaceHeader.append(workspaceMeta, workspaceActions);

    const viewportWrap = document.createElement("section");
    viewportWrap.className = "workspace-wrap";

    const viewport = document.createElement("section");
    viewport.className = "sheet-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute("aria-label", this.i18n.t("workspace.label"));

    const emptyState = this.createEmptyState();

    viewportWrap.append(viewport, emptyState);
    centerWrap.append(workspaceHeader, viewportWrap);

    const rightSplitter = document.createElement("div");
    rightSplitter.className = "dock-splitter";

    const rightDockWrap = document.createElement("aside");
    rightDockWrap.className = "cad-right-dock-wrap";

    body.append(leftDockWrap, leftSplitter, centerWrap, rightSplitter, rightDockWrap);

    const statusHost = document.createElement("div");
    statusHost.className = "cad-status-host";

    const modalRoot = document.createElement("div");
    modalRoot.className = "modal-root";

    const toastRoot = document.createElement("div");
    toastRoot.className = "toast-root";

    shell.append(topMenuHost, ribbonLine, body, statusHost, modalRoot, toastRoot);
    this.root.appendChild(shell);

    this.topMenuBar = new TopMenuBar({ container: topMenuHost, i18n: this.i18n, menuConfig: this.menuConfig, registry: this.registry });
    this.ribbonBar = new RibbonBar({ container: ribbonHost, i18n: this.i18n, tabs: this.ribbonTabs, registry: this.registry });
    this.commandSearch = new CommandSearch({ container: commandSearchHost, registry: this.registry, i18n: this.i18n });

    this.leftDock = new DockPanel({
      container: leftDockWrap,
      side: "left",
      i18n: this.i18n,
      tabs: [
        { id: "sheets", titleKey: "dock.sheets", icon: "file" },
        { id: "tree", titleKey: "dock.tree", icon: "tree" },
        { id: "tasks", titleKey: "dock.tasks", icon: "tasks" }
      ]
    });

    this.rightDock = new DockPanel({
      container: rightDockWrap,
      side: "right",
      i18n: this.i18n,
      tabs: [
        { id: "assemblies", titleKey: "dock.assemblies", icon: "list" },
        { id: "changes", titleKey: "dock.changes", icon: "history" },
        { id: "qc", titleKey: "dock.qc", icon: "alert-triangle" },
        { id: "jobs", titleKey: "dock.jobs", icon: "activity" },
        { id: "find", titleKey: "dock.find", icon: "search" }
      ]
    });

    this.statusBar = new StatusBar({ container: statusHost, i18n: this.i18n, onZoomIn: this.onZoomIn, onZoomOut: this.onZoomOut });
    this.topMenuBar.render();

    this.refs = {
      shell,
      viewport,
      emptyState,
      workspaceName,
      workspaceMode,
      quickAccess,
      leftDockWrap,
      rightDockWrap,
      tabs: this.leftDock.getTabHost("sheets"),
      leftTree: this.leftDock.getTabHost("tree"),
      leftTasks: this.leftDock.getTabHost("tasks"),
      rightPanelHost: this.rightDock.getTabHost("assemblies"),
      rightTabHosts: {
        assemblies: this.rightDock.getTabHost("assemblies"),
        changes: this.rightDock.getTabHost("changes"),
        qc: this.rightDock.getTabHost("qc"),
        jobs: this.rightDock.getTabHost("jobs"),
        find: this.rightDock.getTabHost("find")
      },
      setRightDockTab: (tabId) => this.rightDock.setActiveTab(tabId),
      modalRoot,
      toastRoot,
      commandSearch: this.commandSearch
    };

    this.attachSplitters(leftSplitter, rightSplitter);
    this.observeShell(shell);
    this.applyLayout();

    return this.refs;
  }

  renderRibbon(state) {
    this.topMenuBar.render();
    this.ribbonBar.render(state);
  }

  renderQuickAccess(commands = []) {
    this.refs.quickAccess.innerHTML = "";
    commands.forEach((command) => {
      const button = this.makeIconButton(command.icon, command.titleKey, () => this.registry.execute(command.id));
      button.classList.add("quick-access-btn");
      this.refs.quickAccess.appendChild(button);
    });
  }

  updateMeta({ activeSheetName, zoom }) {
    this.refs.workspaceName.textContent = activeSheetName || this.i18n.t("workspace.noSheet");
    this.refs.workspaceMode.textContent = this.i18n.t("workspace.zoom", { value: Number(zoom || 1).toFixed(2) });
  }

  updateStatus(data) {
    this.statusBar.update(data);
  }

  updateEmptyState(isVisible) {
    this.refs.emptyState.classList.toggle("visible", isVisible);
    this.refs.viewport.classList.toggle("hidden", isVisible);
  }

  openCommandSearch() {
    this.commandSearch.open();
  }

  attachSplitters(leftSplitter, rightSplitter) {
    this.leftSplitter = new Splitter({ element: leftSplitter, onResize: (delta) => this.resizeLeft(delta), onResizeEnd: () => this.persistLayout() });
    this.rightSplitter = new Splitter({ element: rightSplitter, onResize: (delta) => this.resizeRight(delta), onResizeEnd: () => this.persistLayout() });
  }

  observeShell(shell) {
    this.resizeObserver = new ResizeObserver(() => this.applyLayout());
    this.resizeObserver.observe(shell);
  }

  resizeLeft(delta) {
    this.layoutState.leftDockWidth = Math.max(MIN_DOCK, Math.min(MAX_LEFT, this.layoutState.leftDockWidth + delta));
    this.applyLayout();
  }

  resizeRight(delta) {
    this.layoutState.rightDockWidth = Math.max(MIN_DOCK, Math.min(MAX_RIGHT, this.layoutState.rightDockWidth - delta));
    this.applyLayout();
  }

  applyLayout() {
    this.refs.shell.style.setProperty("--leftDockWidth", `${this.layoutState.leftDockWidth}px`);
    this.refs.shell.style.setProperty("--rightDockWidth", `${this.layoutState.rightDockWidth}px`);
  }

  persistLayout() {
    this.onLayoutChange?.({ ...this.layoutState });
  }

  makeIconButton(icon, labelKey, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-icon";
    button.setAttribute("aria-label", this.i18n.t(labelKey));
    button.appendChild(Icon({ name: icon, size: 14 }));
    button.addEventListener("click", onClick);
    return button;
  }

  createEmptyState() {
    const box = document.createElement("section");
    box.className = "cad-empty-state";

    const icon = document.createElement("div");
    icon.className = "cad-empty-icon";
    icon.appendChild(Icon({ name: "file", size: 40 }));

    const title = document.createElement("h2");
    title.className = "cad-empty-title";
    title.textContent = this.i18n.t("empty.title");

    const steps = document.createElement("ol");
    steps.className = "cad-empty-steps";
    ["empty.step1", "empty.step2", "empty.step3"].forEach((key, idx) => {
      const row = document.createElement("li");
      row.className = "cad-empty-step";
      row.appendChild(Icon({ name: idx === 0 ? "folder-open" : idx === 1 ? "columns" : "download", size: 16 }));
      row.appendChild(document.createTextNode(this.i18n.t(key)));
      steps.appendChild(row);
    });

    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "cad-empty-cta";
    cta.setAttribute("aria-label", this.i18n.t("empty.openFileCta"));
    cta.appendChild(Icon({ name: "folder-open", size: 16 }));
    cta.appendChild(document.createTextNode(this.i18n.t("empty.openFileCta")));
    cta.addEventListener("click", () => this.onOpenFile?.());

    const hint = document.createElement("div");
    hint.className = "cad-empty-hint";
    hint.textContent = this.i18n.t("status.commandSearchHint");

    box.append(icon, title, steps, cta, hint);
    return box;
  }
}
