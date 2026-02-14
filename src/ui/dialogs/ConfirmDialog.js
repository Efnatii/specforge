export class ConfirmDialog {
  constructor(root) {
    this.root = root;
  }

  open({ title, message, confirmText = "Confirm", cancelText = "Cancel" }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";

      const dialog = document.createElement("div");
      dialog.className = "dialog";

      const heading = document.createElement("h3");
      heading.className = "dialog-title";
      heading.textContent = title;

      const body = document.createElement("div");
      body.className = "dialog-message";
      body.textContent = message;

      const buttons = document.createElement("div");
      buttons.className = "dialog-buttons";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = cancelText;

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.textContent = confirmText;

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
