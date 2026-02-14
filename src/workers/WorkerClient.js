import { CancelledError, makeMessage } from "./WorkerProtocol.js";

export class WorkerClient {
  constructor(workerInstance) {
    this.worker = workerInstance;
    this.pending = new Map();
    this.worker.addEventListener("message", (event) => this.onMessage(event.data));
    this.worker.addEventListener("error", (event) => this.onWorkerError(event));
    this.worker.addEventListener("messageerror", (event) => this.onWorkerError(event));
  }

  run(op, payload, { signal = null, onProgress = null, transfer = [] } = {}) {
    const requestId = this.createRequestId();

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, onProgress });

      if (signal?.aborted) {
        this.sendCancel(requestId, "aborted-before-run");
        reject(new CancelledError());
        this.pending.delete(requestId);
        return;
      }

      const abortHandler = () => this.sendCancel(requestId, "aborted-by-signal");
      signal?.addEventListener("abort", abortHandler, { once: true });
      this.pending.get(requestId).cleanup = () => signal?.removeEventListener("abort", abortHandler);

      this.worker.postMessage(makeMessage("RUN", {
        requestId,
        op,
        payload,
        meta: { startedTs: Date.now() }
      }), transfer);
    });
  }

  ping() {
    const requestId = this.createRequestId();
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, onProgress: null });
      this.worker.postMessage(makeMessage("PING", { requestId }));
    });
  }

  terminate() {
    this.worker.terminate();
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Worker terminated"));
      pending.cleanup?.();
    }
    this.pending.clear();
  }

  sendCancel(requestId, reason) {
    this.worker.postMessage(makeMessage("CANCEL", { requestId, reason }));
  }

  onMessage(message) {
    if (!message || message.v !== 1 || !message.requestId) {
      return;
    }

    const pending = this.pending.get(message.requestId);
    if (!pending) {
      return;
    }

    if (message.type === "PROGRESS") {
      pending.onProgress?.(message.progress || { completed: 0, total: 1, message: "Running" });
      return;
    }

    if (message.type === "ACK") {
      return;
    }

    pending.cleanup?.();
    this.pending.delete(message.requestId);

    if (message.type === "DONE") {
      pending.resolve(message.result);
      return;
    }

    if (message.type === "FAILED") {
      if (message.error?.code === "CANCELLED") {
        pending.reject(new CancelledError(message.error.message || "Cancelled"));
        return;
      }

      const err = new Error(message.error?.message || "Worker operation failed");
      err.name = message.error?.name || "WorkerError";
      err.code = message.error?.code;
      err.details = message.error?.details;
      pending.reject(err);
      return;
    }

    if (message.type === "PONG") {
      pending.resolve(true);
    }
  }

  onWorkerError(event) {
    const error = event?.error || new Error("Worker crashed");
    for (const pending of this.pending.values()) {
      pending.cleanup?.();
      pending.reject(error);
    }
    this.pending.clear();
  }

  createRequestId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}
