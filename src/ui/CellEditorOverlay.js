export class CellEditorOverlay {
  constructor({ container }) {
    this.container = container;
    this.overlay = document.createElement("div");
    this.overlay.className = "cell-editor-overlay";
    this.overlay.hidden = true;
    this.inputEl = null;
    this.container.appendChild(this.overlay);
  }

  open(rect, initialValue, { multiline = false } = {}) {
    this.overlay.hidden = false;
    this.overlay.style.left = `${rect.x}px`;
    this.overlay.style.top = `${rect.y}px`;
    this.overlay.style.width = `${Math.max(40, rect.w)}px`;
    this.overlay.style.height = `${Math.max(22, rect.h)}px`;

    this.overlay.innerHTML = "";
    this.inputEl = multiline ? document.createElement("textarea") : document.createElement("input");
    if (!multiline) {
      this.inputEl.type = "text";
    }
    this.inputEl.className = "cell-editor-input";
    this.inputEl.value = initialValue ?? "";

    this.overlay.appendChild(this.inputEl);
  }

  close() {
    this.overlay.hidden = true;
    this.overlay.innerHTML = "";
    this.inputEl = null;
  }

  focus() {
    if (!this.inputEl) {
      return;
    }

    this.inputEl.focus();
    const len = this.inputEl.value.length;
    if (typeof this.inputEl.setSelectionRange === "function") {
      this.inputEl.setSelectionRange(len, len);
    }
  }

  getValue() {
    return this.inputEl ? this.inputEl.value : "";
  }

  isOpen() {
    return !this.overlay.hidden;
  }

  isEventInside(target) {
    return this.overlay.contains(target);
  }
}
