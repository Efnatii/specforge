import { JsonTextEditor } from "./JsonTextEditor.js";

export class BindingsEditorDialog {
  constructor(root) {
    this.root = root;
  }

  open({ json, onValidate, onApply, onRevert }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog autofill-dialog";

      const editor = new JsonTextEditor({ title: "Binding Map", initialJson: json });
      const refs = editor.render(dialog, {
        onValidate,
        onApply: async (parsed) => {
          try {
            await onApply?.(parsed);
            backdrop.remove();
            resolve(true);
          } catch (error) {
            refs.message.textContent = error.message;
          }
        },
        onRevert,
        onExport: (text) => {
          const blob = new Blob([text], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "binding.map.override.json";
          a.click();
          URL.revokeObjectURL(url);
        },
        onImport: () => this.importJson(refs.textarea, refs.message)
      });

      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "Close";
      close.addEventListener("click", () => {
        backdrop.remove();
        resolve(false);
      });
      dialog.appendChild(close);

      backdrop.appendChild(dialog);
      this.root.appendChild(backdrop);
    });
  }

  importJson(textarea, message) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      try {
        textarea.value = await file.text();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    input.click();
  }
}
