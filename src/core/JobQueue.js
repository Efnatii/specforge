const STATUS = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  DONE: "DONE",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED"
};

export class JobQueue {
  constructor({ stateStore, maxAttempts = 2 }) {
    this.stateStore = stateStore;
    this.maxAttempts = maxAttempts;
    this.pendingItems = [];
    this.activeItem = null;
  }

  enqueue(jobDefinition) {
    const jobId = this.createJobId();
    const attemptsLimit = Number.isInteger(jobDefinition.maxAttempts)
      ? Math.max(1, jobDefinition.maxAttempts)
      : this.maxAttempts;

    const jobState = {
      id: jobId,
      type: jobDefinition.type,
      title: jobDefinition.title,
      status: STATUS.QUEUED,
      progress: {
        completed: 0,
        total: 1
      },
      message: "Queued",
      error: null,
      attempts: 0,
      maxAttempts: attemptsLimit
    };

    this.setJobState(jobState);

    const promise = new Promise((resolve, reject) => {
      this.pendingItems.push({
        id: jobId,
        definition: jobDefinition,
        attemptsLimit,
        resolve,
        reject,
        cancelled: false
      });
      this.processQueue();
    });

    return { jobId, promise };
  }

  cancel(jobId) {
    if (this.activeItem && this.activeItem.id === jobId) {
      this.activeItem.controller.abort();
      return true;
    }

    const queuedItem = this.pendingItems.find((item) => item.id === jobId);
    if (!queuedItem) {
      return false;
    }

    queuedItem.cancelled = true;
    this.patchJob(jobId, {
      status: STATUS.CANCELLED,
      message: "Cancelled before start"
    });
    queuedItem.reject(new Error("Job cancelled"));
    return true;
  }

  async processQueue() {
    if (this.activeItem) {
      return;
    }

    let nextItem = this.pendingItems.shift();
    while (nextItem && nextItem.cancelled) {
      nextItem = this.pendingItems.shift();
    }

    if (!nextItem) {
      return;
    }

    const controller = new AbortController();
    this.activeItem = {
      ...nextItem,
      controller,
      progress: {
        completed: 0,
        total: 1
      }
    };

    const { id, definition, attemptsLimit, resolve, reject } = nextItem;

    let attempt = 0;
    while (attempt < attemptsLimit) {
      attempt += 1;
      this.patchJob(id, {
        status: STATUS.RUNNING,
        attempts: attempt,
        message: attempt === 1 ? "Running" : `Running (attempt ${attempt}/${attemptsLimit})`,
        error: null
      });

      try {
        const reportProgress = (progressPatch) => this.handleProgress(id, progressPatch);
        const result = await definition.run(
          {
            jobId: id,
            type: definition.type,
            title: definition.title,
            attempt,
            maxAttempts: attemptsLimit
          },
          controller.signal,
          reportProgress
        );

        this.patchJob(id, {
          status: STATUS.DONE,
          progress: {
            completed: this.activeItem.progress.total,
            total: this.activeItem.progress.total
          },
          message: "Done"
        });

        resolve(result);
        this.activeItem = null;
        this.processQueue();
        return;
      } catch (error) {
        if (controller.signal.aborted) {
          this.patchJob(id, {
            status: STATUS.CANCELLED,
            message: "Cancelled",
            error: "Job was cancelled"
          });
          reject(new Error("Job cancelled"));
          this.activeItem = null;
          this.processQueue();
          return;
        }

        if (attempt < attemptsLimit) {
          this.patchJob(id, {
            status: STATUS.QUEUED,
            message: `Retry queued (${attempt + 1}/${attemptsLimit})`
          });
          continue;
        }

        const errorMessage = error instanceof Error ? error.message : "Unknown job error";
        this.patchJob(id, {
          status: STATUS.FAILED,
          message: "Failed",
          error: errorMessage
        });
        reject(error);
        this.activeItem = null;
        this.processQueue();
        return;
      }
    }
  }

  handleProgress(jobId, progressPatch) {
    if (!this.activeItem || this.activeItem.id !== jobId) {
      return;
    }

    const current = this.activeItem.progress;
    const requestedTotal = Number(progressPatch.total);
    const requestedCompleted = Number(progressPatch.completed);

    const total = Number.isFinite(requestedTotal) && requestedTotal > 0
      ? Math.max(requestedTotal, current.total)
      : current.total;

    const boundedCompleted = Number.isFinite(requestedCompleted)
      ? Math.min(Math.max(requestedCompleted, current.completed), total)
      : current.completed;

    this.activeItem.progress = {
      completed: boundedCompleted,
      total
    };

    this.patchJob(jobId, {
      progress: this.activeItem.progress,
      message: progressPatch.message || "Running"
    });
  }

  createJobId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  getJobs() {
    return this.stateStore.getState().jobs;
  }

  patchJob(jobId, patch) {
    const jobs = this.getJobs();
    const current = jobs[jobId] || {};
    this.setJobState({
      ...current,
      ...patch,
      id: jobId
    });
  }

  setJobState(jobState) {
    this.stateStore.update({
      jobs: {
        [jobState.id]: jobState
      }
    });
  }
}

export { STATUS as JOB_STATUS };
