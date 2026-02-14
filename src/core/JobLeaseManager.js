const KEY = "jobLeases";

export class JobLeaseManager {
  constructor({ idbStore, leaseMs = 15000 }) {
    this.idbStore = idbStore;
    this.leaseMs = leaseMs;
    this.leases = {};
    this.loaded = false;
  }

  async load() {
    if (this.loaded) {
      return;
    }
    this.leases = await this.idbStore.get(KEY) || {};
    this.loaded = true;
  }

  async start(jobId, jobRecord) {
    await this.load();
    this.leases[jobId] = {
      jobId,
      status: "RUNNING",
      startedTs: Date.now(),
      leaseUntilTs: Date.now() + this.leaseMs,
      progress: jobRecord.progress || { completed: 0, total: 1 },
      attempts: jobRecord.attempt || 1
    };
    await this.idbStore.set(KEY, this.leases);
  }

  async heartbeat(jobId, progress) {
    await this.load();
    if (!this.leases[jobId]) {
      return;
    }
    this.leases[jobId].leaseUntilTs = Date.now() + this.leaseMs;
    this.leases[jobId].progress = progress;
    await this.idbStore.set(KEY, this.leases);
  }

  async stop(jobId) {
    await this.load();
    delete this.leases[jobId];
    await this.idbStore.set(KEY, this.leases);
  }

  async list() {
    await this.load();
    return { ...this.leases };
  }
}
