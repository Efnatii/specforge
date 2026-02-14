export class PasteSpecialDialog {
  constructor(root) {
    this.root = root;
  }

  open() {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog";

      const title = document.createElement("h3");
      title.className = "dialog-title";
      title.textContent = "Paste Special";

      const mode = document.createElement("select");
      mode.className = "dialog-input";
      mode.innerHTML = '<option value="normal">Normal</option><option value="values">Values only</option><option value="transpose">Transpose</option>';

      const skip = document.createElement("label");
      skip.className = "dialog-message";
      const skipInput = document.createElement("input");
      skipInput.type = "checkbox";
      skip.append(skipInput, document.createTextNode(" Skip blanks"));

      const applyTo = document.createElement("select");
      applyTo.className = "dialog-input";
      applyTo.innerHTML = '<option value="top-left">Apply at top-left</option><option value="selection">Apply to selection</option>';

      const fill = document.createElement("select");
      fill.className = "dialog-input";
      fill.innerHTML = '<option value="clamp">Clamp to selection</option><option value="repeat">Repeat in selection</option>';

      const buttons = document.createElement("div");
      buttons.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => {
        backdrop.remove();
        resolve(null);
      });

      const apply = document.createElement("button");
      apply.type = "button";
      apply.textContent = "Apply";
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
