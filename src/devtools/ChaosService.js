export class ChaosService {
  constructor({ jobQueue, stateStore, scheduler }) {
    this.jobQueue = jobQueue;
    this.stateStore = stateStore;
    this.scheduler = scheduler;
    this.delayMs = 0;
    this.failNext = false;
  }

  startLongJob() {
    const { promise } = this.jobQueue.enqueue({
      type: "CHAOS_LONG_JOB",
      title: "Долгая chaos-задача",
      run: async (_, signal, progress) => {
        const total = 5000;
        for (let i = 0; i <= total; i += 1) {
          if (signal.aborted) {
            throw new Error("Job aborted");
          }
          if (this.failNext) {
            this.failNext = false;
            throw new Error("Chaos fail-next triggered");
          }
          progress({ completed: i, total, message: "Simulating load" });
          if (i % 100 === 0) {
            await this.scheduler.yieldToUi();
          }
          if (this.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.delayMs));
          }
        }
        return true;
      }
    });
    return promise;
  }

  reloadWhileRunning() {
    this.startLongJob();
    setTimeout(() => location.reload(), 2000);
  }

  setThrottle(delayMs) {
    this.delayMs = Math.max(0, Number(delayMs || 0));
  }

  failNextJobAttempt() {
    this.failNext = true;
  }

  exportDebugBundle() {
    const state = this.stateStore.getState();
    const payload = {
      ts: Date.now(),
      versions: { app: "specforge", protocol: 1 },
      jobs: state.jobs,
      audit: state.audit,
      template: state.template,
      workbook: state.workbook
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `specforge-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

