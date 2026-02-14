export class Splitter {
  constructor({ element, axis = "x", onResizeStart, onResize, onResizeEnd } = {}) {
    this.element = element;
    this.axis = axis;
    this.onResizeStart = onResizeStart;
    this.onResize = onResize;
    this.onResizeEnd = onResizeEnd;
    this.active = false;
    this.boundMove = (event) => this.handleMove(event);
    this.boundUp = () => this.handleUp();
    this.mount();
  }

  mount() {
    this.element.addEventListener("mousedown", (event) => this.handleDown(event));
  }

  handleDown(event) {
    event.preventDefault();
    this.active = true;
    this.startCoord = this.axis === "x" ? event.clientX : event.clientY;
    this.onResizeStart?.();
    window.addEventListener("mousemove", this.boundMove);
    window.addEventListener("mouseup", this.boundUp);
    document.body.classList.add("splitter-dragging");
  }

  handleMove(event) {
    if (!this.active) {
      return;
    }
    const coord = this.axis === "x" ? event.clientX : event.clientY;
    const delta = coord - this.startCoord;
    this.startCoord = coord;
    this.onResize?.(delta);
  }

  handleUp() {
    if (!this.active) {
      return;
    }
    this.active = false;
    window.removeEventListener("mousemove", this.boundMove);
    window.removeEventListener("mouseup", this.boundUp);
    document.body.classList.remove("splitter-dragging");
    this.onResizeEnd?.();
  }
}
