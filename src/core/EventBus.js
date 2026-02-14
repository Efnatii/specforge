export class EventBus {
  constructor() {
    this.handlersByEvent = new Map();
  }

  on(eventName, handler) {
    if (!this.handlersByEvent.has(eventName)) {
      this.handlersByEvent.set(eventName, new Set());
    }

    this.handlersByEvent.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const handlers = this.handlersByEvent.get(eventName);
    if (!handlers) {
      return;
    }

    handlers.delete(handler);
    if (handlers.size === 0) {
      this.handlersByEvent.delete(eventName);
    }
  }

  emit(eventName, payload) {
    const handlers = this.handlersByEvent.get(eventName);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      handler(payload);
    }
  }
}
