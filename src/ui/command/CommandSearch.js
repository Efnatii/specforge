import { Icon } from "../common/Icon.js";

export class CommandSearch {
  constructor({ container, registry, i18n }) {
    this.container = container;
    this.registry = registry;
    this.i18n = i18n;
    this.visible = false;
    this.activeIndex = 0;
    this.results = [];
    this.refs = {};
    this.render();
  }

  render() {
    this.container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "command-search";

    const icon = document.createElement("span");
    icon.className = "command-search-icon";
    icon.appendChild(Icon({ name: "search", size: 14 }));

    const input = document.createElement("input");
    input.type = "text";
    input.className = "command-search-input";
    input.placeholder = this.i18n.t("commandSearch.placeholder");
    input.setAttribute("aria-label", this.i18n.t("commandSearch.label"));

    const list = document.createElement("ul");
    list.className = "command-search-results";
    list.hidden = true;

    input.addEventListener("input", () => this.onQueryChange());
    input.addEventListener("keydown", (event) => this.onInputKeyDown(event));
    input.addEventListener("blur", () => {
      window.setTimeout(() => this.close(), 90);
    });

    wrap.append(icon, input, list);
    this.container.appendChild(wrap);

    this.refs = { wrap, input, list };
  }

  open() {
    this.visible = true;
    this.refs.wrap.classList.add("open");
    this.refs.input.focus();
    this.refs.input.select();
    this.onQueryChange();
  }

  close() {
    this.visible = false;
    this.refs.wrap.classList.remove("open");
    this.refs.list.hidden = true;
    this.refs.list.innerHTML = "";
  }

  onQueryChange() {
    const query = this.refs.input.value;
    this.results = this.registry.list({ query }).slice(0, 12);
    this.activeIndex = 0;
    this.renderResults();
  }

  onInputKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!this.results.length) {
        return;
      }
      this.activeIndex = Math.min(this.results.length - 1, this.activeIndex + 1);
      this.renderResults();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.results.length) {
        return;
      }
      this.activeIndex = Math.max(0, this.activeIndex - 1);
      this.renderResults();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const command = this.results[this.activeIndex];
      if (!command?.enabled) {
        return;
      }
      this.registry.execute(command.id);
      this.close();
    }
  }

  renderResults() {
    this.refs.list.innerHTML = "";
    if (!this.visible || !this.results.length) {
      this.refs.list.hidden = true;
      return;
    }

    this.refs.list.hidden = false;
    this.results.forEach((command, index) => {
      const item = document.createElement("li");
      item.className = "command-search-item";
      item.classList.toggle("active", index === this.activeIndex);
      item.classList.toggle("disabled", !command.enabled);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-search-action";
      button.disabled = !command.enabled;
      button.setAttribute("aria-label", command.title);
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        this.registry.execute(command.id);
        this.close();
      });

      const left = document.createElement("span");
      left.className = "command-search-left";
      left.appendChild(Icon({ name: command.icon || "search", size: 12 }));
      left.appendChild(document.createTextNode(command.title));

      const hotkey = document.createElement("span");
      hotkey.className = "kbd-hint";
      hotkey.textContent = command.hotkey || "";

      button.append(left, hotkey);
      item.appendChild(button);
      this.refs.list.appendChild(item);
    });
  }
}
