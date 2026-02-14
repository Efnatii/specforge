export class AddAssemblyDialog {
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
      title.textContent = "Add Assembly";

      const abbrInput = document.createElement("input");
      abbrInput.type = "text";
      abbrInput.placeholder = "ABBR";
      abbrInput.className = "dialog-input";

      const displayInput = document.createElement("input");
      displayInput.type = "text";
      displayInput.placeholder = "Display name (optional)";
      displayInput.className = "dialog-input";

      const note = document.createElement("div");
      note.className = "dialog-message";
      note.textContent = "Allowed: letters, numbers, _ and - (spaces become _)";

      const buttons = document.createElement("div");
      buttons.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.textContent = "Add";

      cancel.addEventListener("click", () => {
        backdrop.remove();
        resolve(null);
      });

      confirm.addEventListener("click", () => {
        const abbr = String(abbrInput.value || "").trim();
        const displayName = String(displayInput.value || "").trim();
        if (!abbr) {
          abbrInput.focus();
          return;
        }

        backdrop.remove();
        resolve({
          abbr,
          displayName,
          prototypeMode: "auto"
        });
      });

      buttons.append(cancel, confirm);
      dialog.append(title, abbrInput, displayInput, note, buttons);
      backdrop.appendChild(dialog);
      this.root.appendChild(backdrop);
      abbrInput.focus();
    });
  }
}
