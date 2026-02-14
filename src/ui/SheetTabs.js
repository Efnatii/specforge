export class SheetTabs {
  constructor({ container, eventBus }) {
    this.container = container;
    this.eventBus = eventBus;
  }

  render(sheets, activeSheetId) {
    this.container.innerHTML = "";

    if (!sheets || sheets.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tabs-empty";
      empty.textContent = "No sheets";
      this.container.appendChild(empty);
      return;
    }

    for (const sheet of sheets) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = sheet.id === activeSheetId ? "sheet-tab active" : "sheet-tab";
      tab.textContent = sheet.name;
      tab.addEventListener("click", () => {
        this.eventBus.emit("SHEET_SELECTED", { sheetId: sheet.id });
      });
      this.container.appendChild(tab);
    }
  }
}
