export class Layout {
  constructor(root) {
    this.root = root;
    this.refs = {};
  }

  render() {
    this.root.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "app-shell";

    const header = document.createElement("header");
    header.className = "app-header";

    const title = document.createElement("h1");
    title.className = "app-title";
    title.textContent = "SpecForge TKP Template Viewer";

    const phase = document.createElement("div");
    phase.className = "boot-phase";

    const templateMeta = document.createElement("div");
    templateMeta.className = "template-meta";

    header.append(title, phase, templateMeta);

    const toolbarHost = document.createElement("div");
    toolbarHost.className = "toolbar";

    const body = document.createElement("div");
    body.className = "app-body";

    const center = document.createElement("main");
    center.className = "sheet-center";

    const tabs = document.createElement("nav");
    tabs.className = "sheet-tabs";

    const viewport = document.createElement("section");
    viewport.className = "sheet-viewport";
    viewport.tabIndex = 0;

    center.append(tabs, viewport);

    const rightPanelHost = document.createElement("aside");
    rightPanelHost.className = "right-panel";

    body.append(center, rightPanelHost);

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
      rightPanelHost,
      modalRoot,
      toastRoot
    };

    return this.refs;
  }

  updateHeader(state) {
    this.refs.phase.textContent = `Phase: ${state.boot.phase}`;

    if (state.template.name) {
      const dt = state.template.loadedAtTs ? new Date(state.template.loadedAtTs).toLocaleString() : "n/a";
      const hash = state.template.bufferHash ? ` hash:${state.template.bufferHash.slice(0, 10)}` : "";
      this.refs.templateMeta.textContent = `${state.template.source}: ${state.template.name} (${dt})${hash}`;
      return;
    }

    this.refs.templateMeta.textContent = "No workbook loaded";
  }
}
