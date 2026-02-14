import { Icon } from "./Icon.js";

export class Layout {
  constructor(root, { i18n, onOpenFile, onLoadDefaultAsset } = {}) {
    this.root = root;
    this.i18n = i18n;
    this.onOpenFile = onOpenFile;
    this.onLoadDefaultAsset = onLoadDefaultAsset;
    this.refs = {};
  }

  render() {
    this.root.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "app-shell";

    const header = document.createElement("header");
    header.className = "app-header panel";
    header.setAttribute("role", "banner");

    const title = document.createElement("h1");
    title.className = "app-title";
    title.textContent = this.i18n.t("app.title");

    const phase = document.createElement("div");
    phase.className = "boot-phase badge";

    const templateMeta = document.createElement("div");
    templateMeta.className = "template-meta";

    header.append(title, phase, templateMeta);

    const toolbarHost = document.createElement("div");
    toolbarHost.className = "toolbar panel";
    toolbarHost.setAttribute("role", "toolbar");
    toolbarHost.setAttribute("aria-label", this.i18n.t("toolbar.groupTools"));

    const body = document.createElement("div");
    body.className = "app-body";

    const leftSidebar = document.createElement("aside");
    leftSidebar.className = "left-sidebar panel";
    leftSidebar.setAttribute("aria-label", this.i18n.t("nav.sheets"));

    const tabs = document.createElement("div");
    tabs.className = "sheet-tabs";
    leftSidebar.appendChild(tabs);

    const center = document.createElement("main");
    center.className = "sheet-main panel";
    center.setAttribute("aria-label", "Рабочая область");

    const viewport = document.createElement("section");
    viewport.className = "sheet-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute("aria-label", "Таблица");

    const emptyState = this.createEmptyState();

    center.append(viewport, emptyState);

    const rightPanelHost = document.createElement("aside");
    rightPanelHost.className = "right-panel panel";
    rightPanelHost.setAttribute("aria-label", "Правая панель");

    body.append(leftSidebar, center, rightPanelHost);

    const modalRoot = document.createElement("div");
    modalRoot.className = "modal-root";

    const toastRoot = document.createElement("div");
    toastRoot.className = "toast-root";

    shell.append(header, toolbarHost, body, modalRoot, toastRoot);
    this.root.appendChild(shell);

    this.refs = {
      phase,
      templateMeta,
      toolbarHost,
      tabs,
      viewport,
      emptyState,
      rightPanelHost,
      modalRoot,
      toastRoot
    };

    return this.refs;
  }

  createEmptyState() {
    const box = document.createElement("section");
    box.className = "empty-state";
    box.setAttribute("aria-label", this.i18n.t("empty.title"));

    const main = document.createElement("div");
    main.className = "empty-main";

    const title = document.createElement("h2");
    title.className = "empty-title";
    title.textContent = this.i18n.t("empty.title");

    const subtitle = document.createElement("p");
    subtitle.className = "empty-subtitle";
    subtitle.textContent = this.i18n.t("empty.subtitle");

    const steps = document.createElement("ol");
    steps.className = "empty-steps";
    steps.append(
      this.createStep("folder-open", this.i18n.t("empty.step1")),
      this.createStep("columns", this.i18n.t("empty.step2")),
      this.createStep("download", this.i18n.t("empty.step3"))
    );

    const actions = document.createElement("div");
    actions.className = "empty-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "empty-open-btn";
    openButton.setAttribute("aria-label", this.i18n.t("empty.openFileCta"));
    openButton.append(Icon({ name: "folder-open", size: 22 }), document.createTextNode(this.i18n.t("empty.openFileCta")));
    openButton.addEventListener("click", () => this.onOpenFile?.());

    const loadAssetButton = document.createElement("button");
    loadAssetButton.type = "button";
    loadAssetButton.className = "text-link-button";
    loadAssetButton.textContent = this.i18n.t("empty.loadAssetCta");
    loadAssetButton.addEventListener("click", () => this.onLoadDefaultAsset?.());

    actions.append(openButton, loadAssetButton);
    main.append(title, subtitle, steps, actions);

    const side = document.createElement("aside");
    side.className = "empty-side";

    const hintsTitle = document.createElement("h3");
    hintsTitle.className = "panel-title";
    hintsTitle.textContent = this.i18n.t("empty.hintsTitle");

    const hints = document.createElement("ul");
    hints.className = "empty-hints";

    for (const key of ["empty.hint1", "empty.hint2", "empty.hint3"]) {
      const row = document.createElement("li");
      row.textContent = this.i18n.t(key);
      hints.appendChild(row);
    }

    side.append(hintsTitle, hints);
    box.append(main, side);

    return box;
  }

  createStep(iconName, text) {
    const item = document.createElement("li");
    item.className = "empty-step";

    const iconWrap = document.createElement("span");
    iconWrap.className = "empty-step-icon";
    iconWrap.appendChild(Icon({ name: iconName, size: 18 }));

    const textWrap = document.createElement("span");
    textWrap.textContent = text;

    item.append(iconWrap, textWrap);
    return item;
  }

  updateHeader(state) {
    const phaseValue = this.i18n.t(`phase.${state.boot.phase}`);
    this.refs.phase.textContent = `${this.i18n.t("header.phase")}: ${phaseValue}`;

    if (state.template.name) {
      const dt = state.template.loadedAtTs ? new Date(state.template.loadedAtTs).toLocaleString("ru-RU") : "-";
      const hashShort = state.template.bufferHash ? ` | ${this.i18n.t("header.hashPrefix")}: ${state.template.bufferHash.slice(0, 10)}` : "";
      const source = this.resolveSourceLabel(state.template.source);
      this.refs.templateMeta.textContent = `${source}: ${state.template.name} (${dt})${hashShort}`;
    } else {
      this.refs.templateMeta.textContent = this.i18n.t("header.noWorkbook");
    }

    this.updateEmptyState(state);
  }

  resolveSourceLabel(source) {
    if (source === "asset") {
      return this.i18n.t("header.sourceAsset");
    }
    if (source === "file") {
      return this.i18n.t("header.sourceFile");
    }
    if (source === "generated") {
      return this.i18n.t("header.sourceGenerated");
    }
    return source || "-";
  }

  updateEmptyState(state) {
    const hasWorkbook = Array.isArray(state.workbook?.sheets) && state.workbook.sheets.length > 0;
    this.refs.emptyState.classList.toggle("visible", !hasWorkbook);
    this.refs.viewport.classList.toggle("hidden", !hasWorkbook);
  }
}
