function formatHotkey(event) {
  const keys = [];
  if (event.ctrlKey || event.metaKey) {
    keys.push("Ctrl");
  }
  if (event.altKey) {
    keys.push("Alt");
  }
  if (event.shiftKey) {
    keys.push("Shift");
  }
  const key = normalizeKey(event.key);
  if (key) {
    keys.push(key);
  }
  return keys.join("+");
}

function normalizeKey(key) {
  if (!key) {
    return "";
  }
  const lower = key.toLowerCase();
  if (lower === " ") {
    return "Space";
  }
  if (lower === "escape") {
    return "Esc";
  }
  if (lower === "arrowup") {
    return "Up";
  }
  if (lower === "arrowdown") {
    return "Down";
  }
  if (lower === "arrowleft") {
    return "Left";
  }
  if (lower === "arrowright") {
    return "Right";
  }
  if (lower === "/") {
    return "/";
  }
  return lower.length === 1 ? lower.toUpperCase() : key;
}

export class Hotkeys {
  constructor({ target = window, commandRegistry, onCommandSearch } = {}) {
    this.target = target;
    this.commandRegistry = commandRegistry;
    this.onCommandSearch = onCommandSearch;
    this.bound = (event) => this.onKeyDown(event);
  }

  bind() {
    this.target.addEventListener("keydown", this.bound);
  }

  unbind() {
    this.target.removeEventListener("keydown", this.bound);
  }

  onKeyDown(event) {
    if (this.shouldIgnore(event)) {
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === "/") {
      event.preventDefault();
      this.onCommandSearch?.();
      return;
    }

    const hotkey = formatHotkey(event);
    const command = this.commandRegistry?.getByHotkey(hotkey);
    if (!command) {
      return;
    }
    event.preventDefault();
    this.commandRegistry.execute(command.id);
  }

  shouldIgnore(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    if (target.closest(".command-search")) {
      return false;
    }
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
  }
}
