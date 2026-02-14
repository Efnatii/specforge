export const WORKER_PROTOCOL_VERSION = 1;

export class CancelledError extends Error {
  constructor(message = "Cancelled") {
    super(message);
    this.name = "CancelledError";
    this.code = "CANCELLED";
  }
}

export function makeMessage(type, data = {}) {
  return { v: WORKER_PROTOCOL_VERSION, type, ...data };
}

export function ensureMonotonicProgress(prev, next) {
  const total = Math.max(Number(prev?.total || 1), Number(next?.total || 1));
  const completed = Math.min(total, Math.max(Number(prev?.completed || 0), Number(next?.completed || 0)));
  return { completed, total, message: next?.message || prev?.message || "" };
}
