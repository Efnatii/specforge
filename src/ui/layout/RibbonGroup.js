import { Icon } from "../common/Icon.js";
import { Tooltip } from "../common/Tooltip.js";

export class RibbonGroup {
  constructor({ group, registry, i18n }) {
    this.group = group;
    this.registry = registry;
    this.i18n = i18n;
    this.buttons = [];
  }

  render(state) {
    const wrap = document.createElement("section");
    wrap.className = "ribbon-group";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", this.i18n.t(this.group.titleKey));

    const actions = document.createElement("div");
    actions.className = "ribbon-group-actions";

    this.buttons = [];
    this.group.commands.forEach((commandId, index) => {
      const command = this.registry.list({ state }).find((item) => item.id === commandId);
      if (!command) {
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ribbon-btn btn-icon";
      button.setAttribute("aria-label", command.title);
      button.tabIndex = index === 0 ? 0 : -1;
      button.disabled = !command.enabled;
      button.appendChild(Icon({ name: command.icon || "panel", size: 16 }));
      button.addEventListener("click", () => this.registry.execute(command.id));
      button.addEventListener("keydown", (event) => this.onKeyDown(event));
      this.buttons.push(button);
      actions.appendChild(Tooltip.wrap(button, { text: command.title, hotkey: command.hotkey }));
    });

    const title = document.createElement("div");
    title.className = "ribbon-group-title";
    title.textContent = this.i18n.t(this.group.titleKey);

    wrap.append(actions, title);
    return wrap;
  }

  onKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }
    if (!this.buttons.length) {
      return;
    }
    event.preventDefault();
    const currentIndex = this.buttons.findIndex((button) => button === event.currentTarget);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + step + this.buttons.length) % this.buttons.length;
    this.buttons.forEach((button, index) => {
      button.tabIndex = index === nextIndex ? 0 : -1;
    });
    this.buttons[nextIndex].focus();
  }
}
