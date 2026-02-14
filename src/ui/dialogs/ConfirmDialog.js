export class ConfirmDialog {
  constructor(root, { i18n } = {}) {
    this.root = root;
    this.i18n = i18n;
  }

  open({ title, message, confirmText, cancelText } = {}) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog";

      const heading = document.createElement("h3");
      heading.className = "dialog-title";
      heading.textContent = title || this.i18n.t("dialog.resetTitle");

      const body = document.createElement("div");
      body.className = "dialog-message";
      body.textContent = message || this.i18n.t("dialog.resetMessage");

      const buttons = document.createElement("div");
      buttons.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = cancelText || this.i18n.t("common.cancel");

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.textContent = confirmText || this.i18n.t("common.apply");

      cancel.addEventListener("click", () => {
        backdrop.remove();
        resolve(false);
      });

      confirm.addEventListener("click", () => {
        backdrop.remove();
        resolve(true);
      });

      buttons.append(cancel, confirm);
      dialog.append(heading, body, buttons);
      backdrop.appendChild(dialog);
      this.root.appendChild(backdrop);
    });
  }
}
