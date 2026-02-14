import { JsonTextEditor } from "./JsonTextEditor.js";

export class SchemaEditorDialog {
  constructor(root, { i18n } = {}) {
    this.root = root;
    this.i18n = i18n;
  }

  open({ json, onValidate, onApply, onRevert }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog autofill-dialog";

      const editor = new JsonTextEditor({ title: this.i18n.t("dialog.schemaTitle"), initialJson: json, i18n: this.i18n });
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
          a.download = "template.schema.override.json";
          a.click();
          URL.revokeObjectURL(url);
        },
        onImport: () => this.importJson(refs.textarea, refs.message)
      });

      const close = document.createElement("button");
      close.type = "button";
      close.textContent = this.i18n.t("configEditor.close") || this.i18n.t("common.close");
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
