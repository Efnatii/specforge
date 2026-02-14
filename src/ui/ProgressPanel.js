const STATUS_ORDER = ["RUNNING", "QUEUED", "FAILED", "CANCELLED", "DONE"];

export class ProgressPanel {
  constructor({ container, onCancel }) {
    this.container = container;
    this.onCancel = onCancel;
  }

  render(jobsMap) {
    this.container.innerHTML = "";

    const jobs = Object.values(jobsMap || {});
    if (jobs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "jobs-empty";
      empty.textContent = "No jobs yet";
      this.container.appendChild(empty);
      return;
    }

    jobs.sort((a, b) => {
      const aOrder = STATUS_ORDER.indexOf(a.status);
      const bOrder = STATUS_ORDER.indexOf(b.status);
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return (b.attempts || 0) - (a.attempts || 0);
    });

    for (const job of jobs) {
      this.container.appendChild(this.renderJob(job));
    }
  }

  renderJob(job) {
    const item = document.createElement("div");
    item.className = `job-item status-${String(job.status || "").toLowerCase()}`;

    const header = document.createElement("div");
    header.className = "job-header";

    const title = document.createElement("div");
    title.className = "job-title";
    title.textContent = `${job.title || job.type || "JOB"} [${job.status}]`;

    header.appendChild(title);

    if (job.status === "RUNNING" || job.status === "QUEUED") {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "job-cancel";
      cancelButton.textContent = "Cancel";
      cancelButton.addEventListener("click", () => this.onCancel(job.id));
      header.appendChild(cancelButton);
    }

    const progress = document.createElement("div");
    progress.className = "job-progress";
    const completed = Number(job.progress?.completed || 0);
    const total = Math.max(1, Number(job.progress?.total || 1));
    progress.textContent = `${completed}/${total} - ${job.message || ""}`;

    item.append(header, progress);

    if (job.error) {
      const error = document.createElement("div");
      error.className = "job-error";
      error.textContent = job.error;
      item.appendChild(error);
    }

    return item;
  }
}
