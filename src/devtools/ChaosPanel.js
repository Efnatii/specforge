export class ChaosPanel {
  constructor(root, chaosService, { i18n } = {}) {
    this.root = root;
    this.chaosService = chaosService;
    this.i18n = i18n;
  }

  mount() {
    this.root.innerHTML = "";
    const host = document.createElement("div");
    host.className = "dialog";

    const title = document.createElement("h3");
    title.className = "dialog-title";
    title.textContent = this.i18n.t("chaos.title");

    const throttle = document.createElement("input");
    throttle.type = "number";
    throttle.className = "dialog-input";
    throttle.placeholder = this.i18n.t("chaos.workerDelay");
    throttle.value = "0";

    const buttons = document.createElement("div");
    buttons.className = "dialog-buttons";

    buttons.append(
      this.btn(this.i18n.t("chaos.startLong"), () => this.chaosService.startLongJob()),
      this.btn(this.i18n.t("chaos.reloadIn2s"), () => this.chaosService.reloadWhileRunning()),
      this.btn(this.i18n.t("chaos.setThrottle"), () => this.chaosService.setThrottle(Number(throttle.value || 0))),
      this.btn(this.i18n.t("chaos.failNext"), () => this.chaosService.failNextJobAttempt()),
      this.btn(this.i18n.t("chaos.exportDebug"), () => this.chaosService.exportDebugBundle())
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
