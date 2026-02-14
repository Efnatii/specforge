export class TopMenuBar {
  constructor({ container, i18n, menuConfig = [], registry }) {
    this.container = container;
    this.i18n = i18n;
    this.menuConfig = menuConfig;
    this.registry = registry;
    this.activeMenuId = null;
    this.boundOutside = (event) => this.handleOutsideClick(event);
    document.addEventListener("click", this.boundOutside);
  }

  render() {
    this.container.innerHTML = "";
    const bar = document.createElement("nav");
    bar.className = "top-menu-bar";
    bar.setAttribute("aria-label", this.i18n.t("cad.topMenu"));

    this.menuConfig.forEach((menu) => {
      const group = document.createElement("div");
      group.className = "top-menu-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "top-menu-button";
      button.textContent = this.i18n.t(menu.titleKey);
      button.setAttribute("aria-label", this.i18n.t(menu.titleKey));
      button.addEventListener("click", () => this.toggleMenu(menu.id));

      const dropdown = document.createElement("div");
      dropdown.className = "top-menu-dropdown";
      dropdown.hidden = true;

      for (const commandId of menu.commands || []) {
        const command = this.registry.list({}).find((item) => item.id === commandId);
        if (!command) {
          continue;
        }
        const action = document.createElement("button");
        action.type = "button";
        action.className = "top-menu-action";
        action.textContent = command.title;
        action.disabled = !command.enabled;
        action.setAttribute("aria-label", command.title);
        action.addEventListener("click", () => {
          this.registry.execute(command.id);
          this.closeMenus();
        });
        dropdown.appendChild(action);
      }

      group.append(button, dropdown);
      bar.appendChild(group);
    });

    this.container.appendChild(bar);
  }

  handleOutsideClick(event) {
    const root = this.container.querySelector(".top-menu-bar");
    if (root && !root.contains(event.target)) {
      this.closeMenus();
    }
  }

  toggleMenu(id) {
    this.activeMenuId = this.activeMenuId === id ? null : id;
    this.applyVisibility();
  }

  closeMenus() {
    this.activeMenuId = null;
    this.applyVisibility();
  }

  applyVisibility() {
    const items = this.container.querySelectorAll(".top-menu-item");
    items.forEach((item, index) => {
      const menu = this.menuConfig[index];
      const active = menu?.id === this.activeMenuId;
      item.querySelector(".top-menu-dropdown").hidden = !active;
      item.querySelector(".top-menu-button")?.setAttribute("aria-expanded", active ? "true" : "false");
    });
  }
}
