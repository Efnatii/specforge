export class Toast {
  constructor(container) {
    this.container = container;
  }

  show(message, type = "info", durationMs = 3500) {
    const item = document.createElement("div");
    item.className = `toast toast-${type}`;
    item.textContent = message;

    this.container.appendChild(item);

    const timer = setTimeout(() => {
      item.remove();
    }, durationMs);

    item.addEventListener("click", () => {
      clearTimeout(timer);
      item.remove();
    });
  }
}
