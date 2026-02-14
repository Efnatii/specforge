export class ViewportMeasure {
  constructor() {
    this.cleanup = null;
  }

  bind(viewportEl, onSize) {
    this.unbind();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          onSize(entry.contentRect.width, entry.contentRect.height);
        }
      });
      observer.observe(viewportEl);
      this.cleanup = () => observer.disconnect();
      return;
    }

    const handler = () => {
      const rect = viewportEl.getBoundingClientRect();
      onSize(rect.width, rect.height);
    };
    window.addEventListener("resize", handler);
    handler();
    this.cleanup = () => window.removeEventListener("resize", handler);
  }

  unbind() {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }
}
