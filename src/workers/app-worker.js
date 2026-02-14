import { makeMessage } from "./WorkerProtocol.js";
import { opsRegistry } from "./ops/ops-registry.js";

const running = new Map();

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.v !== 1) {
    return;
  }

  if (message.type === "PING") {
    self.postMessage(makeMessage("PONG", { requestId: message.requestId }));
    return;
  }

  if (message.type === "CANCEL") {
    const task = running.get(message.requestId);
    task?.controller.abort();
    return;
  }

  if (message.type !== "RUN") {
    return;
  }

  const { requestId, op, payload } = message;
  const handler = opsRegistry[op];
  if (!handler) {
    self.postMessage(makeMessage("FAILED", {
      requestId,
      error: { name: "UnknownOperation", message: `Unknown op: ${op}`, code: "UNKNOWN_OP" }
    }));
    return;
  }

  const controller = new AbortController();
  running.set(requestId, { controller });
  self.postMessage(makeMessage("ACK", { requestId }));

  let monotonic = { completed: 0, total: 1, message: "" };
  const reportProgress = (next) => {
    const total = Math.max(monotonic.total, Number(next?.total || 1));
    const completed = Math.min(total, Math.max(monotonic.completed, Number(next?.completed || 0)));
    monotonic = { completed, total, message: next?.message || monotonic.message };
    self.postMessage(makeMessage("PROGRESS", { requestId, progress: monotonic }));
  };

  try {
    const result = await handler({ payload, signal: controller.signal, reportProgress });
    self.postMessage(makeMessage("DONE", { requestId, result }));
  } catch (error) {
    const cancelled = controller.signal.aborted || error?.code === "CANCELLED";
    self.postMessage(makeMessage("FAILED", {
      requestId,
      error: {
        name: error?.name || (cancelled ? "CancelledError" : "WorkerOperationError"),
        message: error?.message || (cancelled ? "Cancelled" : "Worker operation failed"),
        stack: error?.stack,
        code: cancelled ? "CANCELLED" : (error?.code || "WORKER_FAILED"),
        details: error?.details || null
      }
    }));
  } finally {
    running.delete(requestId);
  }
};
