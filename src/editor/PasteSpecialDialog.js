export class PasteSpecialDialog {
  constructor(root, { i18n } = {}) {
    this.root = root;
    this.i18n = i18n;
  }

  open() {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog";

      const title = document.createElement("h3");
      title.className = "dialog-title";
      title.textContent = this.i18n.t("dialog.pasteSpecialTitle");

      const mode = document.createElement("select");
      mode.className = "dialog-input";
      mode.innerHTML = `<option value="normal">${this.i18n.t("dialog.pasteModeNormal")}</option><option value="values">${this.i18n.t("dialog.pasteModeValues")}</option><option value="transpose">${this.i18n.t("dialog.pasteModeTranspose")}</option>`;

      const skip = document.createElement("label");
      skip.className = "dialog-message";
      const skipInput = document.createElement("input");
      skipInput.type = "checkbox";
      skip.append(skipInput, document.createTextNode(` ${this.i18n.t("dialog.pasteSkipBlanks")}`));

      const applyTo = document.createElement("select");
      applyTo.className = "dialog-input";
      applyTo.innerHTML = `<option value="top-left">${this.i18n.t("dialog.pasteApplyTopLeft")}</option><option value="selection">${this.i18n.t("dialog.pasteApplySelection")}</option>`;

      const fill = document.createElement("select");
      fill.className = "dialog-input";
      fill.innerHTML = `<option value="clamp">${this.i18n.t("dialog.pasteFillClamp")}</option><option value="repeat">${this.i18n.t("dialog.pasteFillRepeat")}</option>`;

      const buttons = document.createElement("div");
      buttons.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = this.i18n.t("common.cancel");
      cancel.addEventListener("click", () => {
        backdrop.remove();
        resolve(null);
      });

      const apply = document.createElement("button");
      apply.type = "button";
      apply.textContent = this.i18n.t("common.apply");
      apply.addEventListener("click", () => {
        backdrop.remove();
        resolve({ mode: mode.value, skipBlanks: skipInput.checked, applyTo: applyTo.value, fillSelection: fill.value });
      });

      buttons.append(cancel, apply);
      dialog.append(title, mode, skip, applyTo, fill, buttons);
      backdrop.appendChild(dialog);
      this.root.appendChild(backdrop);
    });
  }
}
