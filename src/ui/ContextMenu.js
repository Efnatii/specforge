export class ContextMenu {
  constructor() {
    this.node = document.createElement("div");
    this.node.className = "context-menu";
    this.node.style.display = "none";
    this.node.style.position = "fixed";
    this.node.style.zIndex = "300";
    this.node.style.background = "#fff";
    this.node.style.border = "1px solid #c7c7c7";
    this.node.style.borderRadius = "4px";
    this.node.style.padding = "4px";
    this.onClose = () => this.hide();
    document.body.appendChild(this.node);
    document.addEventListener("click", this.onClose);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hide();
      }
    });
  }

  show(x, y, actions) {
    this.node.innerHTML = "";
    for (const action of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.style.display = "block";
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.style.border = "none";
      btn.style.background = "transparent";
      btn.style.padding = "6px 10px";
      btn.addEventListener("click", () => {
        this.hide();
        action.onClick?.();
      });
      this.node.appendChild(btn);
    }

    this.node.style.left = `${x}px`;
    this.node.style.top = `${y}px`;
    this.node.style.display = "block";
  }

  hide() {
    this.node.style.display = "none";
  }

  destroy() {
    document.removeEventListener("click", this.onClose);
    this.node.remove();
  }
}
