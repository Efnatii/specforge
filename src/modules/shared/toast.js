export class ToastModule {
  constructor({ dom, windowRef, durationMs = 1600 }) {
    if (!dom) throw new Error("ToastModule requires dom");
    if (!windowRef) throw new Error("ToastModule requires windowRef");
    this._dom = dom;
    this._window = windowRef;
    this._durationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1600;
    this._timer = 0;
  }

  show(text) {
    if (!this._dom.toast) return;
    this._dom.toast.textContent = String(text || "");
    this._dom.toast.classList.add("show");
    if (this._timer) this._window.clearTimeout(this._timer);
    this._timer = this._window.setTimeout(() => {
      this._dom.toast.classList.remove("show");
      this._timer = 0;
    }, this._durationMs);
  }
}
