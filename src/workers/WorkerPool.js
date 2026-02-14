import { WorkerClient } from "./WorkerClient.js";

function clampPoolSize() {
  const hc = Number(navigator.hardwareConcurrency || 4);
  return Math.max(2, Math.min(4, hc - 1));
}

export class WorkerPool {
  constructor({ size = clampPoolSize(), workerFactory = null } = {}) {
    this.size = Math.max(1, size);
    this.workerFactory = workerFactory || (() => new Worker(new URL("./app-worker.js", import.meta.url), { type: "module" }));
    this.idle = [];
    this.busy = new Set();
    this.waiters = [];

    for (let i = 0; i < this.size; i += 1) {
      this.idle.push(this.createClient());
    }
  }

  async acquire() {
    if (this.idle.length > 0) {
      const client = this.idle.pop();
      this.busy.add(client);
      return client;
    }

    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(client) {
    if (!this.busy.has(client)) {
      return;
    }

    this.busy.delete(client);
    const waiter = this.waiters.shift();
    if (waiter) {
      this.busy.add(client);
      waiter(client);
      return;
    }

    this.idle.push(client);
  }

  shutdown() {
    for (const client of [...this.idle, ...this.busy]) {
      client.terminate();
    }
    this.idle = [];
    this.busy.clear();
    this.waiters = [];
  }

  createClient() {
    const worker = this.workerFactory();
    const client = new WorkerClient(worker);
    worker.addEventListener("error", () => this.replaceClient(client));
    worker.addEventListener("messageerror", () => this.replaceClient(client));
    return client;
  }

  replaceClient(client) {
    this.busy.delete(client);
    this.idle = this.idle.filter((item) => item !== client);
    client.terminate();
    this.idle.push(this.createClient());
  }
}
