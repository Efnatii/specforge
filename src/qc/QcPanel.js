export class QcPanel {
  constructor(container, { onJumpToCell, onScan, onExportCsv, onExportXlsx }) {
    this.container = container;
    this.onJumpToCell = onJumpToCell;
    this.onScan = onScan;
    this.onExportCsv = onExportCsv;
    this.onExportXlsx = onExportXlsx;
    this.filter = { level: "all", sheetName: "all" };
  }

  render(report, sheets) {
    this.container.innerHTML = "";

    const actions = document.createElement("div");
    actions.className = "qc-actions";

    const scan = this.makeButton("QC Scan", () => this.onScan());
    const exportCsv = this.makeButton("Export CSV", () => this.onExportCsv());
    const exportXlsx = this.makeButton("Export XLSX", () => this.onExportXlsx());

    actions.append(scan, exportCsv, exportXlsx);

    const filters = document.createElement("div");
    filters.className = "qc-filters";

    const level = document.createElement("select");
    level.innerHTML = "<option value='all'>All</option><option value='error'>Errors</option><option value='warning'>Warnings</option>";
    level.value = this.filter.level;
    level.addEventListener("change", () => {
      this.filter.level = level.value;
      this.render(report, sheets);
    });

    const bySheet = document.createElement("select");
    bySheet.innerHTML = "<option value='all'>All Sheets</option>";
    for (const sheet of sheets || []) {
      const option = document.createElement("option");
      option.value = sheet.name;
      option.textContent = sheet.name;
      bySheet.appendChild(option);
    }
    bySheet.value = this.filter.sheetName;
    bySheet.addEventListener("change", () => {
      this.filter.sheetName = bySheet.value;
      this.render(report, sheets);
    });

    filters.append(level, bySheet);

    const summary = document.createElement("div");
    summary.className = "qc-summary";
    summary.textContent = `Errors: ${report?.summary?.errorsCount || 0} | Warnings: ${report?.summary?.warningsCount || 0}`;

    const list = document.createElement("div");
    list.className = "qc-list";

    const items = this.filterItems(report?.items || []);
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "changes-empty";
      empty.textContent = "No QC items";
      list.appendChild(empty);
    } else {
      for (const item of items) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = `qc-item level-${item.level}`;
        row.textContent = `[${item.level}] ${item.code} ${item.sheetName}!${item.addressA1} - ${item.message}`;
        row.addEventListener("click", () => this.onJumpToCell(item));
        list.appendChild(row);
      }
    }

    this.container.append(actions, filters, summary, list);
  }

  filterItems(items) {
    return items.filter((item) => {
      if (this.filter.level !== "all" && item.level !== this.filter.level) {
        return false;
      }
      if (this.filter.sheetName !== "all" && item.sheetName !== this.filter.sheetName) {
        return false;
      }
      return true;
    });
  }

  makeButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }
}
