import { CancelledError, ensureMonotonicProgress } from "../workers/WorkerProtocol.js";

export class JobRunner {
  constructor({ workerPool, leaseManager = null }) {
    this.workerPool = workerPool;
    this.leaseManager = leaseManager;
    this.controllers = new Map();
  }

  async runJob(jobRecord, { onProgress }) {
    const client = await this.workerPool.acquire();
    const controller = new AbortController();
    this.controllers.set(jobRecord.jobId, controller);
    await this.leaseManager?.start(jobRecord.jobId, jobRecord);

    try {
      const result = await client.run(jobRecord.op, jobRecord.payload, {
        signal: controller.signal,
        transfer: jobRecord.transfer || [],
        onProgress: (progress) => {
          const merged = ensureMonotonicProgress(jobRecord.progress || { completed: 0, total: 1 }, progress || {});
          onProgress(merged);
          this.leaseManager?.heartbeat(jobRecord.jobId, merged).catch(() => null);
        }
      });
      await this.leaseManager?.stop(jobRecord.jobId);
      return result;
    } catch (error) {
      await this.leaseManager?.stop(jobRecord.jobId);
      if (error instanceof CancelledError) {
        throw error;
      }
      throw error;
    } finally {
      this.controllers.delete(jobRecord.jobId);
      this.workerPool.release(client);
    }
  }

  cancel(jobId) {
    const controller = this.controllers.get(jobId);
    if (!controller) {
      return false;
    }
    controller.abort();
    this.leaseManager?.stop(jobId).catch(() => null);
    return true;
  }
}
