export class AutoFillPreviewDialog {
  constructor(root) {
    this.root = root;
  }

  open(patchPlan) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog autofill-dialog";

      const title = document.createElement("h3");
      title.className = "dialog-title";
      title.textContent = patchPlan.title || "AutoFill Preview";

      const summary = document.createElement("div");
      summary.className = "dialog-message";
      summary.textContent = `Cells changed: ${patchPlan.stats?.cellsChanged || 0}`;

      const filter = document.createElement("input");
      filter.type = "text";
      filter.placeholder = "Filter by sheet";
      filter.className = "dialog-input";

      const list = document.createElement("div");
      list.className = "autofill-list";

      const renderList = () => {
        const q = String(filter.value || "").trim().toLowerCase();
        list.innerHTML = "";

        const rows = (patchPlan.changes || []).filter((item) => {
          if (!q) {
            return true;
          }
          return item.sheetName.toLowerCase().includes(q);
        });

        if (rows.length === 0) {
          const empty = document.createElement("div");
          empty.className = "changes-empty";
          empty.textContent = "No changes";
          list.appendChild(empty);
          return;
        }

        for (const item of rows) {
          const row = document.createElement("div");
          row.className = "change-item";
          row.textContent = `${item.sheetName}!${item.addressA1}: ${this.format(item.before)} -> ${this.format(item.after)} (${item.reason})`;
          list.appendChild(row);
        }
      };

      filter.addEventListener("input", renderList);
      renderList();

      const actions = document.createElement("div");
      actions.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";

      const apply = document.createElement("button");
      apply.type = "button";
      apply.textContent = "Apply";

      cancel.addEventListener("click", () => {
        backdrop.remove();
        resolve(false);
      });

      apply.addEventListener("click", () => {
        backdrop.remove();
        resolve(true);
      });

      actions.append(cancel, apply);
      dialog.append(title, summary, filter, list, actions);
      backdrop.appendChild(dialog);
      this.root.appendChild(backdrop);
    });
  }

  format(value) {
    if (value === null || value === undefined) {
      return "<empty>";
    }
    return String(value);
  }
}
