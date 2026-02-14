export class ImportModeDialog {
  constructor(root) {
    this.root = root;
  }

  open({ reason, softTagFound }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog";

      const title = document.createElement("h3");
      title.className = "dialog-title";
      title.textContent = "Import Update is not compatible";

      const message = document.createElement("div");
      message.className = "dialog-message";
      message.textContent = reason || "Structure mismatch";

      const hint = document.createElement("div");
      hint.className = "dialog-message";
      hint.textContent = softTagFound
        ? "File contains SpecForge tag, but structure still does not match baseline."
        : "SpecForge tag not found. File may be external.";

      const buttons = document.createElement("div");
      buttons.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";

      const replace = document.createElement("button");
      replace.type = "button";
      replace.textContent = "Replace template";

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
