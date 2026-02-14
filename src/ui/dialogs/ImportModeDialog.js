export class ImportModeDialog {
  constructor(root, { i18n } = {}) {
    this.root = root;
    this.i18n = i18n;
  }

  open({ reason, softTagFound }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog";

      const title = document.createElement("h3");
      title.className = "dialog-title";
      title.textContent = this.i18n.t("dialog.importModeTitle");

      const message = document.createElement("div");
      message.className = "dialog-message";
      message.textContent = reason || this.i18n.t("dialog.importModeReasonFallback");

      const hint = document.createElement("div");
      hint.className = "dialog-message";
      hint.textContent = softTagFound
        ? this.i18n.t("dialog.importModeTagged")
        : this.i18n.t("dialog.importModeUntagged");

      const buttons = document.createElement("div");
      buttons.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = this.i18n.t("common.cancel");

      const replace = document.createElement("button");
      replace.type = "button";
      replace.textContent = this.i18n.t("dialog.importModeReplace");

      cancel.addEventListener("click", () => {
        backdrop.remove();
        resolve("cancel");
      });

      replace.addEventListener("click", () => {
        backdrop.remove();
        resolve("replace");
      });

      buttons.append(cancel, replace);
      dialog.append(title, message, hint, buttons);
      backdrop.appendChild(dialog);
      this.root.appendChild(backdrop);
    });
  }
}
