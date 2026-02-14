export class ChaosPanel {
  constructor(root, chaosService) {
    this.root = root;
    this.chaosService = chaosService;
  }

  mount() {
    this.root.innerHTML = "";
    const host = document.createElement("div");
    host.className = "dialog";

    const title = document.createElement("h3");
    title.className = "dialog-title";
    title.textContent = "Chaos Tools";

    const throttle = document.createElement("input");
    throttle.type = "number";
    throttle.className = "dialog-input";
    throttle.placeholder = "Worker delay ms";
    throttle.value = "0";

    const buttons = document.createElement("div");
    buttons.className = "dialog-buttons";

    buttons.append(
      this.btn("Start long job", () => this.chaosService.startLongJob()),
      this.btn("Reload in 2s", () => this.chaosService.reloadWhileRunning()),
      this.btn("Set throttle", () => this.chaosService.setThrottle(Number(throttle.value || 0))),
      this.btn("Fail next attempt", () => this.chaosService.failNextJobAttempt()),
      this.btn("Export debug", () => this.chaosService.exportDebugBundle())
    );

    host.append(title, throttle, buttons);
    this.root.appendChild(host);
  }

  btn(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }
}
