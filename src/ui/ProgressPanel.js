import { Icon } from "./Icon.js";
import { Tooltip } from "./Tooltip.js";

const STATUS_ORDER = ["RUNNING", "QUEUED", "FAILED", "CANCELLED", "DONE"];

export class ProgressPanel {
  constructor({ container, onCancel, i18n }) {
    this.container = container;
    this.onCancel = onCancel;
    this.i18n = i18n;
  }

  render(jobsMap) {
    this.container.innerHTML = "";

    const jobs = Object.values(jobsMap || {});
    if (jobs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "jobs-empty";
      empty.textContent = this.i18n.t("jobs.empty");
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
    const item = document.createElement("article");
    item.className = `job-item status-${String(job.status || "").toLowerCase()}`;

    const header = document.createElement("div");
    header.className = "job-header";

    const title = document.createElement("div");
    title.className = "job-title";
    title.textContent = this.resolveJobTitle(job);

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = this.translateStatus(job.status);

    const left = document.createElement("div");
    left.className = "job-head-left";
    left.append(title, badge);

    header.appendChild(left);

    if (job.status === "RUNNING" || job.status === "QUEUED") {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "btn-icon job-cancel";
      cancelButton.setAttribute("aria-label", this.i18n.t("jobs.cancel"));
      cancelButton.appendChild(Icon({ name: "x", size: 14 }));
      cancelButton.addEventListener("click", () => this.onCancel(job.id));
      header.appendChild(Tooltip.wrap(cancelButton, { text: this.i18n.t("jobs.cancel") }));
    }

    const completed = Number(job.progress?.completed || 0);
    const total = Math.max(1, Number(job.progress?.total || 1));
    const percent = Math.max(0, Math.min(100, Math.round((completed / total) * 100)));

    const progressWrap = document.createElement("div");
    progressWrap.className = "job-progress-wrap";

    const progressBar = document.createElement("div");
    progressBar.className = "job-progress-bar";

    const progressFill = document.createElement("div");
    progressFill.className = "job-progress-fill";
    progressFill.style.width = `${percent}%`;

    progressBar.appendChild(progressFill);

    const progressText = document.createElement("div");
    progressText.className = "job-progress";
    progressText.textContent = `${completed}/${total} - ${job.message || ""}`;

    progressWrap.append(progressBar, progressText);
    item.append(header, progressWrap);

    if (job.error) {
      const error = document.createElement("div");
      error.className = "job-error warning-like";
      error.textContent = job.error;
      item.appendChild(error);
    }

    return item;
  }

  resolveJobTitle(job) {
    return job.title || job.type || "JOB";
  }

  translateStatus(status) {
    const key = String(status || "").toLowerCase();
    return this.i18n.t(`jobs.${key}`);
  }
}
