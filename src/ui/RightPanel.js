import { Icon } from "./Icon.js";

export class RightPanel {
  constructor({ root, progressPanel, changesPanel, qcPanel, findPanel, i18n }) {
    this.root = root;
    this.progressPanel = progressPanel;
    this.changesPanel = changesPanel;
    this.qcPanel = qcPanel;
    this.findPanel = findPanel;
    this.i18n = i18n;

    this.activeTab = "assemblies";
    this.selectedAbbr = null;
    this.onAssemblyChange = null;
    this.onAssemblyAction = null;
    this.refs = {};

    this.mount();
  }

  mount() {
    this.root.innerHTML = "";

    const tabs = document.createElement("div");
    tabs.className = "right-tabs";

    const tabDefs = [
      { id: "assemblies", icon: "list", label: this.i18n.t("panel.assemblies") },
      { id: "changes", icon: "history", label: this.i18n.t("panel.changes") },
      { id: "qc", icon: "alert-triangle", label: this.i18n.t("panel.qc") },
      { id: "jobs", icon: "activity", label: this.i18n.t("panel.jobs") },
      { id: "find", icon: "search", label: this.i18n.t("panel.find") }
    ];

    const hosts = {};
    const tabButtons = {};
    const hostClassByTab = {
      assemblies: "assemblies-panel",
      changes: "changes-panel",
      qc: "qc-panel",
      jobs: "progress-panel",
      find: "find-panel"
    };

    for (const tab of tabDefs) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "right-tab";
      button.setAttribute("aria-label", tab.label);
      button.append(Icon({ name: tab.icon, size: 14 }), document.createTextNode(tab.label));
      button.addEventListener("click", () => this.setActiveTab(tab.id));
      tabs.appendChild(button);
      tabButtons[tab.id] = button;

      const host = document.createElement("section");
      host.className = "right-tab-host";
      host.classList.add(hostClassByTab[tab.id]);
      host.dataset.tab = tab.id;
      host.setAttribute("aria-label", tab.label);
      hosts[tab.id] = host;
      this.root.appendChild(host);
    }

    this.root.prepend(tabs);

    this.refs = {
      tabs,
      tabButtons,
      hosts
    };

    this.progressPanel.container = hosts.jobs;
    this.changesPanel.container = hosts.changes;
    this.qcPanel.container = hosts.qc;
    this.findPanel.container = hosts.find;

    this.applyTabVisibility();
  }

  setActiveTab(tabId) {
    if (!this.refs.hosts?.[tabId]) {
      return;
    }
    this.activeTab = tabId;
    this.applyTabVisibility();
  }

  setAssemblyHandlers({ onAssemblyChange, onAssemblyAction }) {
    this.onAssemblyChange = onAssemblyChange;
    this.onAssemblyAction = onAssemblyAction;
  }

  render({ jobs, changes, qcReport, sheets, tkpModel, findState }) {
    this.progressPanel.render(jobs || {});
    this.changesPanel.render(changes || []);
    this.qcPanel.render(qcReport || { summary: { errorsCount: 0, warningsCount: 0 }, items: [] }, sheets || []);
    this.findPanel.render(findState || {});
    this.renderAssemblies(tkpModel || { assemblies: [] });
  }

  renderAssemblies(tkpModel) {
    const host = this.refs.hosts.assemblies;
    host.innerHTML = "";

    const actions = document.createElement("div");
    actions.className = "assembly-actions";

    actions.append(
      this.makeActionButton(this.i18n.t("assemblies.add"), () => this.onAssemblyAction?.("add", this.selectedAbbr)),
      this.makeActionButton(this.i18n.t("assemblies.remove"), () => this.onAssemblyAction?.("remove", this.selectedAbbr)),
      this.makeActionButton(this.i18n.t("assemblies.duplicate"), () => this.onAssemblyAction?.("duplicate", this.selectedAbbr)),
      this.makeActionButton(this.i18n.t("assemblies.syncPreview"), () => this.onAssemblyAction?.("sync_preview", this.selectedAbbr))
    );

    const table = document.createElement("table");
    table.className = "assemblies-table";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    for (const key of ["include", "abbr", "name", "qty", "unit", "comment"]) {
      const th = document.createElement("th");
      th.textContent = this.i18n.t(`assemblies.${key}`);
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);

    const body = document.createElement("tbody");
    for (const row of tkpModel.assemblies || []) {
      const tr = document.createElement("tr");
      tr.dataset.abbr = row.abbr;
      tr.classList.toggle("selected", this.selectedAbbr === row.abbr);
      tr.addEventListener("click", () => {
        this.selectedAbbr = row.abbr;
        this.renderAssemblies(tkpModel);
      });

      tr.append(
        this.makeCellCheckbox(row, "include"),
        this.makeCellInput(row, "abbr"),
        this.makeCellInput(row, "name"),
        this.makeCellInput(row, "qty", "number"),
        this.makeCellInput(row, "unit"),
        this.makeCellInput(row, "comment")
      );

      body.appendChild(tr);
    }

    table.appendChild(body);
    host.append(actions, table);
  }

  makeCellInput(row, key, type = "text") {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = type;
    input.value = row[key] ?? "";
    input.className = "assembly-input";
    input.setAttribute("aria-label", `${row.abbr || ""} ${key}`.trim());
    input.addEventListener("change", () => this.onAssemblyChange?.(row.abbr, { [key]: type === "number" ? Number(input.value) : input.value }));
    td.appendChild(input);
    return td;
  }

  makeCellCheckbox(row, key) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = row[key] !== false;
    input.setAttribute("aria-label", `${row.abbr || ""} ${key}`.trim());
    input.addEventListener("change", () => this.onAssemblyChange?.(row.abbr, { [key]: input.checked }));
    td.appendChild(input);
    return td;
  }

  makeActionButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  applyTabVisibility() {
    for (const [tabId, host] of Object.entries(this.refs.hosts || {})) {
      const active = tabId === this.activeTab;
      host.style.display = active ? "grid" : "none";
      this.refs.tabButtons?.[tabId]?.classList.toggle("active", active);
      this.refs.tabButtons?.[tabId]?.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }
}
