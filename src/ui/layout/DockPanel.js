import { Icon } from "../common/Icon.js";

export class DockPanel {
  constructor({ container, side = "left", i18n, tabs = [] } = {}) {
    this.container = container;
    this.side = side;
    this.i18n = i18n;
    this.tabs = tabs;
    this.activeTabId = tabs[0]?.id || null;
    this.pinned = true;
    this.collapsed = false;
    this.refs = {};
    this.render();
  }

  render() {
    this.container.innerHTML = "";

    const panel = document.createElement("section");
    panel.className = `dock-panel dock-panel-${this.side}`;

    const rail = document.createElement("div");
    rail.className = "dock-rail";

    const body = document.createElement("div");
    body.className = "dock-body";

    const header = document.createElement("header");
    header.className = "dock-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "dock-title-wrap";

    const titleIcon = document.createElement("span");
    titleIcon.className = "dock-title-icon";

    const title = document.createElement("h3");
    title.className = "dock-title";

    titleWrap.append(titleIcon, title);

    const tools = document.createElement("div");
    tools.className = "dock-tools";

    const pin = this.makeHeaderButton("pin", "dock.pin", () => {
      this.pinned = !this.pinned;
      pin.classList.toggle("active", this.pinned);
    });

    const collapse = this.makeHeaderButton("chevron-right", "dock.collapse", () => {
      this.collapsed = !this.collapsed;
      panel.classList.toggle("collapsed", this.collapsed);
      collapse.setAttribute("aria-pressed", this.collapsed ? "true" : "false");
    });

    tools.append(pin, collapse);
    header.append(titleWrap, tools);

    const tabsHost = document.createElement("div");
    tabsHost.className = "dock-tabs-host";

    const contentHost = document.createElement("div");
    contentHost.className = "dock-content-host";

    const tabButtons = {};
    const tabHosts = {};

    for (const tab of this.tabs) {
      const tabButton = document.createElement("button");
      tabButton.type = "button";
      tabButton.className = "dock-tab";
      tabButton.setAttribute("aria-label", this.i18n.t(tab.titleKey));
      tabButton.appendChild(Icon({ name: tab.icon, size: 14 }));
      tabButton.addEventListener("click", () => this.setActiveTab(tab.id));
      rail.appendChild(tabButton);
      tabButtons[tab.id] = tabButton;

      const host = document.createElement("section");
      host.className = "dock-tab-content";
      host.dataset.tab = tab.id;
      host.setAttribute("aria-label", this.i18n.t(tab.titleKey));
      contentHost.appendChild(host);
      tabHosts[tab.id] = host;
    }

    tabsHost.append(header, contentHost);
    body.appendChild(tabsHost);

    panel.append(rail, body);
    this.container.appendChild(panel);

    this.refs = { panel, title, titleIcon, tabButtons, tabHosts };
    this.applyActiveTab();
  }

  setActiveTab(tabId) {
    if (!this.refs.tabHosts[tabId]) {
      return;
    }
    this.activeTabId = tabId;
    this.applyActiveTab();
  }

  getTabHost(tabId) {
    return this.refs.tabHosts[tabId];
  }

  makeHeaderButton(icon, labelKey, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dock-header-btn";
    button.setAttribute("aria-label", this.i18n.t(labelKey));
    button.appendChild(Icon({ name: icon, size: 12 }));
    button.addEventListener("click", onClick);
    return button;
  }

  applyActiveTab() {
    for (const [tabId, button] of Object.entries(this.refs.tabButtons)) {
      const active = tabId === this.activeTabId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      this.refs.tabHosts[tabId].classList.toggle("active", active);
    }

    const activeDef = this.tabs.find((tab) => tab.id === this.activeTabId);
    this.refs.title.textContent = this.i18n.t(activeDef?.titleKey || "");
    this.refs.titleIcon.innerHTML = "";
    if (activeDef?.icon) {
      this.refs.titleIcon.appendChild(Icon({ name: activeDef.icon, size: 14 }));
    }
  }
}
