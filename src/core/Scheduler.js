export class Scheduler {
  constructor() {
    this.timers = new Map();
  }

  debounce(key, fn, delayMs = 300) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const timer = setTimeout(() => {
      this.timers.delete(key);
      fn();
    }, delayMs);

    this.timers.set(key, timer);
  }

  clear(key) {
    if (!this.timers.has(key)) {
      return;
    }

    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
  }

  async yieldToUi() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
