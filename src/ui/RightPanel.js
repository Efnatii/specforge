export class RightPanel {
  constructor({ root, progressPanel, changesPanel, qcPanel, findPanel }) {
    this.root = root;
    this.progressPanel = progressPanel;
    this.changesPanel = changesPanel;
    this.qcPanel = qcPanel;
    this.findPanel = findPanel;
    this.activeTab = "changes";
    this.selectedAbbr = null;
    this.refs = {};
    this.onAssemblyChange = null;
    this.onAssemblyAction = null;
    this.mount();
  }

  mount() {
    this.root.innerHTML = "";

    const jobsTitle = document.createElement("h2");
    jobsTitle.className = "panel-title";
    jobsTitle.textContent = "Jobs";

    const jobsHost = document.createElement("div");
    jobsHost.className = "progress-panel";

    const tabs = document.createElement("div");
    tabs.className = "right-tabs";

    const changesTab = this.makeTabButton("changes", "Changes");
    const qcTab = this.makeTabButton("qc", "QC");
    const asmTab = this.makeTabButton("assemblies", "Сборки");
    const findTab = this.makeTabButton("find", "Find");
    tabs.append(changesTab, qcTab, asmTab, findTab);

    const changesHost = document.createElement("div");
    changesHost.className = "changes-panel";

    const qcHost = document.createElement("div");
    qcHost.className = "qc-panel";

    const assembliesHost = document.createElement("div");
    assembliesHost.className = "assemblies-panel";
    const findHost = document.createElement("div");
    findHost.className = "qc-panel";

    this.root.append(jobsTitle, jobsHost, tabs, changesHost, qcHost, assembliesHost, findHost);

    this.refs = { jobsHost, changesHost, qcHost, assembliesHost, findHost, changesTab, qcTab, asmTab, findTab };
    this.progressPanel.container = jobsHost;
    this.changesPanel.container = changesHost;
    this.qcPanel.container = qcHost;
    this.findPanel.container = findHost;

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
    const host = this.refs.assembliesHost;
    host.innerHTML = "";

    const actions = document.createElement("div");
    actions.className = "assembly-actions";

    actions.append(
      this.makeActionButton("Add", () => this.onAssemblyAction?.("add", this.selectedAbbr)),
      this.makeActionButton("Remove", () => this.onAssemblyAction?.("remove", this.selectedAbbr)),
      this.makeActionButton("Duplicate", () => this.onAssemblyAction?.("duplicate", this.selectedAbbr)),
      this.makeActionButton("Sync to workbook (Preview)", () => this.onAssemblyAction?.("sync_preview", this.selectedAbbr))
    );

    const table = document.createElement("table");
    table.className = "assemblies-table";
    table.innerHTML = "<thead><tr><th>Use</th><th>ABBR</th><th>Name</th><th>Qty</th><th>Unit</th><th>Comment</th></tr></thead>";

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
    input.addEventListener("change", () => this.onAssemblyChange?.(row.abbr, { [key]: type === "number" ? Number(input.value) : input.value }));
    td.appendChild(input);
    return td;
  }

  makeCellCheckbox(row, key) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = row[key] !== false;
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

  makeTabButton(tab, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "right-tab";
    button.textContent = label;
    button.addEventListener("click", () => {
      this.activeTab = tab;
      this.applyTabVisibility();
    });
    return button;
  }

  applyTabVisibility() {
    this.refs.changesHost.style.display = this.activeTab === "changes" ? "grid" : "none";
    this.refs.qcHost.style.display = this.activeTab === "qc" ? "grid" : "none";
    this.refs.assembliesHost.style.display = this.activeTab === "assemblies" ? "grid" : "none";
    this.refs.findHost.style.display = this.activeTab === "find" ? "grid" : "none";
    this.refs.changesTab.classList.toggle("active", this.activeTab === "changes");
    this.refs.qcTab.classList.toggle("active", this.activeTab === "qc");
    this.refs.asmTab.classList.toggle("active", this.activeTab === "assemblies");
    this.refs.findTab.classList.toggle("active", this.activeTab === "find");
  }
}
