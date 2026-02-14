export class RecoveryPolicy {
  constructor({ maxAttempts = 2, maxTotalTimeMs = 10 * 60 * 1000 }) {
    this.maxAttempts = maxAttempts;
    this.maxTotalTimeMs = maxTotalTimeMs;
  }

  apply(jobs = {}, nowTs = Date.now()) {
    const nextJobs = { ...jobs };
    let requeued = 0;
    let failed = 0;

    for (const [jobId, job] of Object.entries(jobs || {})) {
      if (job.status !== "RUNNING") {
        continue;
      }

      const attempts = Number(job.attempts || 1);
      const startedTs = Number(job.startedTs || nowTs);
      const elapsed = nowTs - startedTs;
      const canRetry = attempts < Number(job.maxAttempts || this.maxAttempts) && elapsed < this.maxTotalTimeMs;

      if (canRetry) {
        nextJobs[jobId] = {
          ...job,
          status: "QUEUED",
          attempts: attempts + 1,
          message: "Recovered after reload, re-queued",
          recoverReason: "RECOVER_REQUEUE",
          progress: {
            completed: Number(job.progress?.completed || 0),
            total: Number(job.progress?.total || 1)
          }
        };
        requeued += 1;
      } else {
        nextJobs[jobId] = {
          ...job,
          status: "FAILED",
          message: "Failed during recovery",
          error: "RECOVER_FAIL",
          recoverReason: "RECOVER_FAIL"
        };
        failed += 1;
      }
    }

    return { jobs: nextJobs, summary: { requeued, failed } };
  }
}
