export class JsonTextEditor {
  constructor({ title, initialJson }) {
    this.title = title;
    this.initialJson = initialJson || {};
  }

  render(root, handlers = {}) {
    root.innerHTML = "";

    const title = document.createElement("h3");
    title.className = "dialog-title";
    title.textContent = this.title;

    const textarea = document.createElement("textarea");
    textarea.className = "cell-editor-input";
    textarea.style.minHeight = "320px";
    textarea.value = JSON.stringify(this.initialJson, null, 2);

    const message = document.createElement("div");
    message.className = "dialog-message";

    const buttons = document.createElement("div");
    buttons.className = "dialog-buttons";

    const validate = this.makeBtn("Validate", () => {
      try {
        const parsed = JSON.parse(textarea.value);
        handlers.onValidate?.(parsed);
        message.textContent = "Valid";
      } catch (error) {
        message.textContent = error.message;
      }
    });

    const apply = this.makeBtn("Apply", () => {
      try {
        const parsed = JSON.parse(textarea.value);
        handlers.onApply?.(parsed);
      } catch (error) {
        message.textContent = error.message;
      }
    });

    const revert = this.makeBtn("Revert", () => handlers.onRevert?.());
    const exportBtn = this.makeBtn("Export JSON", () => handlers.onExport?.(textarea.value));
    const importBtn = this.makeBtn("Import JSON", () => handlers.onImport?.());

    buttons.append(validate, apply, revert, exportBtn, importBtn);
    root.append(title, textarea, message, buttons);

    return { textarea, message };
  }

  makeBtn(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }
}
