import { Icon } from "./Icon.js";

export class SheetTabs {
  constructor({ container, eventBus, i18n }) {
    this.container = container;
    this.eventBus = eventBus;
    this.i18n = i18n;
    this.searchText = "";
  }

  render(sheets, activeSheetId) {
    this.container.innerHTML = "";

    const header = document.createElement("div");
    header.className = "sidebar-header";

    const title = document.createElement("h2");
    title.className = "sidebar-title";
    title.textContent = this.i18n.t("nav.sheets");

    const searchWrap = document.createElement("label");
    searchWrap.className = "sidebar-search";

    const searchIcon = document.createElement("span");
    searchIcon.className = "sidebar-search-icon";
    searchIcon.appendChild(Icon({ name: "search", size: 14 }));

    const search = document.createElement("input");
    search.type = "text";
    search.className = "sidebar-search-input";
    search.placeholder = this.i18n.t("nav.sheetsSearch");
    search.value = this.searchText;
    search.setAttribute("aria-label", this.i18n.t("nav.sheetsSearch"));
    search.addEventListener("input", () => {
      this.searchText = search.value;
      this.render(sheets, activeSheetId);
    });

    searchWrap.append(searchIcon, search);
    header.append(title, searchWrap);

    const list = document.createElement("div");
    list.className = "sheet-list";

    const filtered = (sheets || []).filter((sheet) => this.matchesFilter(sheet.name));

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tabs-empty";
      empty.textContent = this.i18n.t("nav.noSheets");
      list.appendChild(empty);
    } else {
      for (const sheet of filtered) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "sheet-tab";
        item.classList.toggle("active", sheet.id === activeSheetId);
        item.setAttribute("aria-label", sheet.name);

        const icon = document.createElement("span");
        icon.className = "sheet-tab-icon";
        icon.appendChild(Icon({ name: "columns", size: 14 }));

        const label = document.createElement("span");
        label.className = "sheet-tab-label";
        label.textContent = sheet.name;

        item.append(icon, label);
        item.addEventListener("click", () => {
          this.eventBus.emit("SHEET_SELECTED", { sheetId: sheet.id });
        });

        list.appendChild(item);
      }
    }

    this.container.append(header, list);
  }

  matchesFilter(name) {
    const q = String(this.searchText || "").trim().toLowerCase();
    if (!q) {
      return true;
    }
    return String(name || "").toLowerCase().includes(q);
  }
}
