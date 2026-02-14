export class AppHotkeys {
  constructor({ root, handlers }) {
    this.root = root;
    this.handlers = handlers;
    this.bound = (event) => this.onKeyDown(event);
  }

  bind() {
    this.root.addEventListener("keydown", this.bound);
  }

  unbind() {
    this.root.removeEventListener("keydown", this.bound);
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;

    if (ctrl && key === "z" && !event.shiftKey) {
      event.preventDefault();
      this.handlers.onUndo?.();
      return;
    }

    if ((ctrl && key === "y") || (ctrl && key === "z" && event.shiftKey)) {
      event.preventDefault();
      this.handlers.onRedo?.();
      return;
    }

    if (ctrl && event.shiftKey && (event.key === "=" || event.key === "+")) {
      event.preventDefault();
      this.handlers.onInsertRow?.();
      return;
    }

    if (ctrl && event.key === "-") {
      event.preventDefault();
      this.handlers.onDeleteRow?.();
      return;
    }

    if (ctrl && event.shiftKey && key === "v") {
      event.preventDefault();
      this.handlers.onPasteSpecial?.();
    }

  }
}
