import { RibbonGroup } from "./RibbonGroup.js";
import { RibbonTab } from "./RibbonTab.js";

export class RibbonBar {
  constructor({ container, i18n, tabs = [], registry }) {
    this.container = container;
    this.i18n = i18n;
    this.registry = registry;
    this.tabs = tabs.map((tab) => new RibbonTab(tab));
    this.activeTabId = this.tabs[0]?.id || null;
  }

  render(state) {
    this.container.innerHTML = "";

    const root = document.createElement("section");
    root.className = "ribbon-bar";

    const tabRow = document.createElement("div");
    tabRow.className = "ribbon-tabs";

    this.tabs.forEach((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ribbon-tab-btn";
      button.setAttribute("aria-label", this.i18n.t(tab.title));
      button.textContent = this.i18n.t(tab.title);
      button.classList.toggle("active", tab.id === this.activeTabId);
      button.addEventListener("click", () => {
        this.activeTabId = tab.id;
        this.render(state);
      });
      tabRow.appendChild(button);
    });

    const groupsHost = document.createElement("div");
    groupsHost.className = "ribbon-groups";

    const activeTab = this.tabs.find((tab) => tab.id === this.activeTabId);
    (activeTab?.groups || []).forEach((groupDef) => {
      const group = new RibbonGroup({ group: groupDef, registry: this.registry, i18n: this.i18n });
      groupsHost.appendChild(group.render(state));
    });

    root.append(tabRow, groupsHost);
    this.container.appendChild(root);
  }
}
