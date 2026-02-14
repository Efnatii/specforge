export class ChangesPanel {
  constructor(container) {
    this.container = container;
  }

  render(recent) {
    this.container.innerHTML = "";

    const list = Array.isArray(recent) ? recent.slice(0, 50) : [];
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "changes-empty";
      empty.textContent = "No edits yet";
      this.container.appendChild(empty);
      return;
    }

    for (const item of list) {
      const row = document.createElement("div");
      row.className = "change-item";
      const ts = new Date(item.ts).toLocaleTimeString();
      row.textContent = `${ts} [${item.userAction}] ${item.sheetName} ${item.addressA1}: ${this.formatValue(item.before)} -> ${this.formatValue(item.after)}`;
      this.container.appendChild(row);
    }
  }

  formatValue(value) {
    if (value === null || value === undefined) {
      return "<empty>";
    }

    return String(value);
  }
}
