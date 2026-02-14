export class RenderScheduler {
  constructor(renderFn) {
    this.renderFn = renderFn;
    this.pending = false;
    this.reason = "";
  }

  requestRender(reason = "") {
    this.reason = reason;
    if (this.pending) {
      return;
    }

    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.renderFn(this.reason);
    });
  }
}
